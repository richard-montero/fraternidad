import * as XLSX from "xlsx";
import * as api from "./data.js";

// =====================================================================
// Importación masiva desde un Excel con hasta 3 hojas: "Socios",
// "Aportes" y "Gastos" (ver descargarPlantillaImportacion en excel.js).
// Reutiliza exactamente las mismas funciones que usa el resto de la
// aplicación (crearSocio, registrarPagoPatrimonial, etc.), así que
// respeta las mismas reglas y permisos que un registro manual.
// =====================================================================

export function leerLibroExcel(file) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = (e) => {
      try {
        resolve(XLSX.read(e.target.result, { type: "array", cellDates: true }));
      } catch (err) {
        reject(new Error("No se pudo leer el archivo. ¿Es un archivo .xlsx válido?"));
      }
    };
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.readAsArrayBuffer(file);
  });
}

function normalizar(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function hojaComoFilas(libro, nombresPosibles) {
  const nombreReal = libro.SheetNames.find((n) => nombresPosibles.some((p) => normalizar(n) === normalizar(p)));
  if (!nombreReal) return [];
  return XLSX.utils.sheet_to_json(libro.Sheets[nombreReal], { defval: "" });
}

function campo(fila, ...nombres) {
  const claves = Object.keys(fila);
  for (const nombre of nombres) {
    const encontrada = claves.find((k) => normalizar(k) === normalizar(nombre));
    if (encontrada !== undefined) return fila[encontrada];
  }
  return "";
}

function convertirFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  const s = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return s || null;
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Ejecuta la importación completa.
 * - libro: el resultado de leerLibroExcel().
 * - socios: la lista actual de ctx.socios (para no duplicar por celular).
 * - esSuperadmin: si es false, todo socio nuevo se crea como
 *   Patrimonial / Socio, sin importar lo que diga el Excel (misma regla
 *   que en el formulario manual).
 * - estados / roles / categoriasGasto: las listas de la app (ESTADOS_SOCIO,
 *   ROLES_ACCESO, CATEGORIAS_GASTO) para traducir las etiquetas del Excel.
 * - onProgreso(hechos, total): callback opcional para una barra de avance.
 */
export async function importarDatos({ libro, socios, esSuperadmin, estados, roles, turnos, categoriasGasto, onProgreso }) {
  const resultado = { sociosCreados: 0, sociosExistentes: 0, obligacionesCreadas: 0, obligacionesMensualesGeneradas: 0, aportesCreados: 0, gastosCreados: 0, errores: [] };

  const mapaCelular = new Map();
  socios.forEach((s) => mapaCelular.set(normalizar(s.celular), s.id));

  const filasSocios = hojaComoFilas(libro, ["Socios"]);
  const filasAportes = hojaComoFilas(libro, ["Aportes", "Aportes de socios", "Pagos"]);
  const filasGastos = hojaComoFilas(libro, ["Gastos"]);

  const total = filasSocios.length + filasAportes.length + filasGastos.length;
  let hechos = 0;
  const avanzar = () => { hechos++; onProgreso?.(hechos, total); };

  // ---------- 1) Socios ----------
  for (let i = 0; i < filasSocios.length; i++) {
    const fila = filasSocios[i];
    const nombre = String(campo(fila, "Nombre completo", "Nombre")).trim();
    const celular = String(campo(fila, "Celular", "Numero de celular")).trim();
    const email = String(campo(fila, "Correo electronico", "Correo", "Email")).trim();

    if (!celular || !email) {
      resultado.errores.push(`Socios, fila ${i + 2}: falta el celular o el correo — se omitió esta fila.`);
      avanzar();
      continue;
    }
    const claveCel = normalizar(celular);
    if (mapaCelular.has(claveCel)) {
      resultado.sociosExistentes++;
      avanzar();
      continue;
    }

    const estadoValor = estados.find((e) => normalizar(e.label) === normalizar(campo(fila, "Estado")))?.value || "patrimonial";
    const rolValor = roles.find((r) => normalizar(r.label) === normalizar(campo(fila, "Rol", "Rol de acceso")))?.value || "socio";
    const password = String(campo(fila, "Contraseña inicial", "Contrasena inicial", "Password")).trim();
    const aporteAcordado = Number(campo(fila, "Aporte patrimonial acordado", "Aporte acordado")) || 0;
    const turnoTxt = String(campo(fila, "Turno")).trim();
    const turnoValor = (turnos || []).find((t) => normalizar(t) === normalizar(turnoTxt)) || null;

    try {
      const socio = await api.crearSocio({
        nombre: nombre || celular,
        celular,
        email,
        fechaNacimiento: convertirFecha(campo(fila, "Fecha de nacimiento", "Nacimiento")),
        turno: turnoValor,
        estado: esSuperadmin ? estadoValor : "patrimonial",
        rol: esSuperadmin ? rolValor : "socio",
        password,
      });
      mapaCelular.set(claveCel, socio.id);
      resultado.sociosCreados++;
      if (aporteAcordado > 0) {
        await api.crearObligacionPatrimonial(socio.id, aporteAcordado, hoyISO());
        resultado.obligacionesCreadas++;
      }
      await esperar(350); // evita saturar el registro de usuarios de Supabase Auth
    } catch (err) {
      resultado.errores.push(`Socios, fila ${i + 2} (${nombre || celular}): ${err.message}`);
    }
    avanzar();
  }

  // ---------- 2) Aportes ----------
  for (let i = 0; i < filasAportes.length; i++) {
    const fila = filasAportes[i];
    const celularOriginal = String(campo(fila, "Celular", "Celular del socio")).trim();
    const socioId = mapaCelular.get(normalizar(celularOriginal));
    const tipoTxt = normalizar(campo(fila, "Tipo"));
    const monto = Number(campo(fila, "Monto"));
    const fecha = convertirFecha(campo(fila, "Fecha")) || hoyISO();
    const concepto = String(campo(fila, "Concepto")).trim() || "Pago";
    const observaciones = String(campo(fila, "Observaciones")).trim();

    if (!socioId) {
      resultado.errores.push(`Aportes, fila ${i + 2}: no se encontró ningún socio con celular "${celularOriginal}".`);
      avanzar();
      continue;
    }
    if (!monto || monto <= 0) {
      resultado.errores.push(`Aportes, fila ${i + 2}: el monto no es válido.`);
      avanzar();
      continue;
    }

    try {
      if (tipoTxt === "patrimonial") await api.registrarPagoPatrimonial(socioId, monto, fecha, concepto);
      else if (tipoTxt === "mensual") await api.registrarPagoMensual(socioId, monto, fecha, concepto);
      else if (tipoTxt === "voluntario") await api.registrarAporteVoluntario(socioId, monto, fecha, concepto, observaciones);
      else if (tipoTxt === "obligacion mensual" || tipoTxt === "cargo mensual" || tipoTxt === "mensualidad generada") {
        const [anioStr, mesStr] = fecha.split("-");
        const r = await api.crearObligacionMensualHistorica(socioId, Number(anioStr), Number(mesStr), monto, concepto);
        if (r.yaExistia) {
          resultado.errores.push(`Aportes, fila ${i + 2}: ese socio ya tenía una obligación mensual generada para ${mesStr}/${anioStr} — se omitió para no duplicar.`);
          avanzar();
          continue;
        }
        resultado.obligacionesMensualesGeneradas++;
        avanzar();
        continue;
      } else {
        resultado.errores.push(`Aportes, fila ${i + 2}: el tipo "${campo(fila, "Tipo")}" no se reconoce (usa Patrimonial, Mensual, Voluntario u Obligación mensual).`);
        avanzar();
        continue;
      }
      resultado.aportesCreados++;
    } catch (err) {
      resultado.errores.push(`Aportes, fila ${i + 2}: ${err.message}`);
    }
    avanzar();
  }

  // ---------- 3) Gastos ----------
  for (let i = 0; i < filasGastos.length; i++) {
    const fila = filasGastos[i];
    const categoria = categoriasGasto.find((c) => normalizar(c.label) === normalizar(campo(fila, "Categoria", "Categoría")))?.value || "otros";
    const monto = Number(campo(fila, "Monto"));
    const fecha = convertirFecha(campo(fila, "Fecha")) || hoyISO();
    const concepto = String(campo(fila, "Concepto")).trim();
    const beneficiario = String(campo(fila, "Beneficiario")).trim();
    const formaPago = String(campo(fila, "Forma de pago")).trim();

    if (!concepto || !monto || monto <= 0) {
      resultado.errores.push(`Gastos, fila ${i + 2}: falta el concepto o el monto no es válido.`);
      avanzar();
      continue;
    }
    try {
      await api.registrarGasto({ fecha, categoria, concepto, beneficiario, monto, formaPago }, null);
      resultado.gastosCreados++;
    } catch (err) {
      resultado.errores.push(`Gastos, fila ${i + 2}: ${err.message}`);
    }
    avanzar();
  }

  return resultado;
}
