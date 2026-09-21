import * as XLSX from "xlsx";
import {
  crearSociosEnLote,
  sumarObligacionesPatrimonialesEnLote,
  registrarMovimientosEnLote,
  crearObligacionesMensualesEnLote,
  registrarAportesVoluntariosEnLote,
  registrarIngresosExternosEnLote,
  registrarGastosEnLote,
} from "./importarLote.js";

// =====================================================================
// Importación masiva desde un Excel con hasta 4 hojas: "Socios",
// "Aportes", "Ingresos institucionales" y "Gastos" (ver
// descargarPlantillaImportacion en excel.js).
//
// Primero se valida y arma todo en memoria, y recién al final se escribe
// en la base de datos EN BLOQUES (unas pocas llamadas de red en vez de
// una por fila) — así una importación de miles de filas toma segundos,
// no minutos, y es mucho más difícil que quede a medias por un corte de
// red o porque el navegador quedó en segundo plano.
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

/**
 * Ejecuta la importación completa.
 * - libro: el resultado de leerLibroExcel().
 * - socios: la lista actual de ctx.socios (para no duplicar por celular).
 * - esSuperadmin: si es false, todo socio nuevo se crea como
 *   Patrimonial / Socio, sin importar lo que diga el Excel (misma regla
 *   que en el formulario manual).
 * - estados / roles / turnos / categoriasGasto: las listas de la app
 *   (ESTADOS_SOCIO, ROLES_ACCESO, TURNOS, CATEGORIAS_GASTO) para traducir
 *   las etiquetas del Excel.
 * - onProgreso(paso, totalPasos, etiqueta): callback opcional para una
 *   barra de avance — avanza por ETAPA (Socios, Aportes, Ingresos,
 *   Gastos...), no por fila, porque ahora se escribe todo en bloques.
 */
export async function importarDatos({ libro, socios, esSuperadmin, estados, roles, turnos, categoriasGasto, onProgreso }) {
  const resultado = {
    sociosCreados: 0, sociosSinAcceso: 0, sociosExistentes: 0,
    obligacionesCreadas: 0, obligacionesMensualesGeneradas: 0, obligacionesMensualesYaExistian: 0,
    aportesCreados: 0, ingresosExternosCreados: 0, gastosCreados: 0,
    errores: [],
  };

  const TOTAL_PASOS = 8;
  let paso = 0;
  const avanzarPaso = (etiqueta) => onProgreso?.(++paso, TOTAL_PASOS, etiqueta);

  const mapaCelular = new Map();
  socios.forEach((s) => mapaCelular.set(normalizar(s.celular), s.id));

  const filasSocios = hojaComoFilas(libro, ["Socios"]);
  const filasAportes = hojaComoFilas(libro, ["Aportes", "Aportes de socios", "Pagos"]);
  const filasIngresosExternos = hojaComoFilas(libro, ["Ingresos institucionales", "Ingresos externos", "Otros ingresos"]);
  const filasGastos = hojaComoFilas(libro, ["Gastos"]);

  // =====================================================================
  // 1) Socios — validar, armar el lote y crearlos todos de una vez
  // =====================================================================
  avanzarPaso("Validando socios…");
  const candidatosSocio = [];
  const aportesAcordados = []; // { celular, monto } — se resuelve el socioId después de crearlos
  const vistosEnArchivo = new Set();

  filasSocios.forEach((fila, i) => {
    const nombre = String(campo(fila, "Nombre completo", "Nombre")).trim();
    const celular = String(campo(fila, "Celular", "Numero de celular")).trim();
    const email = String(campo(fila, "Correo electronico", "Correo", "Email")).trim();

    if (!celular) {
      resultado.errores.push(`Socios, fila ${i + 2}: falta el celular — se omitió esta fila.`);
      return;
    }
    const claveCel = normalizar(celular);
    if (mapaCelular.has(claveCel) || vistosEnArchivo.has(claveCel)) {
      resultado.sociosExistentes++;
      return;
    }
    vistosEnArchivo.add(claveCel);

    const estadoValor = estados.find((e) => normalizar(e.label) === normalizar(campo(fila, "Estado")))?.value || "patrimonial";
    const rolValor = roles.find((r) => normalizar(r.label) === normalizar(campo(fila, "Rol", "Rol de acceso")))?.value || "socio";
    const aporteAcordado = Number(campo(fila, "Aporte patrimonial acordado", "Aporte acordado")) || 0;
    const turnoTxt = String(campo(fila, "Turno")).trim();
    const turnoValor = (turnos || []).find((t) => normalizar(t) === normalizar(turnoTxt)) || null;

    candidatosSocio.push({
      celular,
      nombre: nombre || celular,
      email: email || null,
      fechaNacimiento: convertirFecha(campo(fila, "Fecha de nacimiento", "Nacimiento")),
      turno: turnoValor,
      estado: esSuperadmin ? estadoValor : "patrimonial",
      rol: esSuperadmin ? rolValor : "socio",
    });
    if (aporteAcordado > 0) aportesAcordados.push({ celular: claveCel, monto: aporteAcordado });
  });

  avanzarPaso(`Creando ${candidatosSocio.length} socios…`);
  if (candidatosSocio.length > 0) {
    const r = await crearSociosEnLote(candidatosSocio);
    r.creados.forEach((s) => mapaCelular.set(normalizar(s.celular), s.id));
    resultado.sociosCreados = r.creados.length;
    resultado.sociosSinAcceso = r.creados.length;
    resultado.errores.push(...r.errores.map((e) => `Socios: ${e}`));
  }

  if (aportesAcordados.length > 0) {
    const entradas = aportesAcordados
      .map((a) => ({ socioId: mapaCelular.get(a.celular), monto: a.monto, fecha: hoyISO() }))
      .filter((e) => e.socioId);
    const r = await sumarObligacionesPatrimonialesEnLote(entradas);
    resultado.obligacionesCreadas = entradas.length;
    resultado.errores.push(...r.errores.map((e) => `Aporte patrimonial acordado: ${e}`));
  }

  // =====================================================================
  // 2) Aportes — validar y separar por tipo
  // =====================================================================
  avanzarPaso("Validando aportes…");
  const pagosPatrimoniales = [];
  const pagosMensuales = [];
  const voluntarios = [];
  const obligacionesMensuales = [];

  filasAportes.forEach((fila, i) => {
    const celularOriginal = String(campo(fila, "Celular", "Celular del socio")).trim();
    const socioId = mapaCelular.get(normalizar(celularOriginal));
    const tipoTxt = normalizar(campo(fila, "Tipo"));
    const monto = Number(campo(fila, "Monto"));
    const fecha = convertirFecha(campo(fila, "Fecha")) || hoyISO();
    const concepto = String(campo(fila, "Concepto")).trim() || "Pago";
    const observaciones = String(campo(fila, "Observaciones")).trim();

    if (!socioId) {
      resultado.errores.push(`Aportes, fila ${i + 2}: no se encontró ningún socio con celular "${celularOriginal}".`);
      return;
    }
    if (!monto || monto <= 0) {
      resultado.errores.push(`Aportes, fila ${i + 2}: el monto no es válido.`);
      return;
    }

    if (tipoTxt === "patrimonial") pagosPatrimoniales.push({ socio_id: socioId, fecha, concepto, debe: 0, haber: monto });
    else if (tipoTxt === "mensual") pagosMensuales.push({ socio_id: socioId, fecha, concepto, debe: 0, haber: monto });
    else if (tipoTxt === "voluntario") voluntarios.push({ socio_id: socioId, fecha, concepto, monto, observaciones });
    else if (tipoTxt === "obligacion mensual" || tipoTxt === "cargo mensual" || tipoTxt === "mensualidad generada") {
      const [anioStr, mesStr] = fecha.split("-");
      obligacionesMensuales.push({ socioId, anio: Number(anioStr), mes: Number(mesStr), monto, concepto, fecha });
    } else {
      resultado.errores.push(`Aportes, fila ${i + 2}: el tipo "${campo(fila, "Tipo")}" no se reconoce (usa Patrimonial, Mensual, Voluntario u Obligación mensual).`);
    }
  });

  avanzarPaso(`Registrando ${pagosPatrimoniales.length + pagosMensuales.length} pagos…`);
  if (pagosPatrimoniales.length > 0) {
    const r = await registrarMovimientosEnLote("movimientos_patrimoniales", pagosPatrimoniales);
    resultado.aportesCreados += r.insertadas;
    resultado.errores.push(...r.errores.map((e) => `Aportes (pagos patrimoniales): ${e}`));
  }
  if (pagosMensuales.length > 0) {
    const r = await registrarMovimientosEnLote("movimientos_mensuales", pagosMensuales);
    resultado.aportesCreados += r.insertadas;
    resultado.errores.push(...r.errores.map((e) => `Aportes (pagos mensuales): ${e}`));
  }

  if (voluntarios.length > 0) {
    const r = await registrarAportesVoluntariosEnLote(voluntarios);
    resultado.aportesCreados += r.insertadas;
    resultado.errores.push(...r.errores.map((e) => `Aportes voluntarios: ${e}`));
  }

  avanzarPaso(`Registrando ${obligacionesMensuales.length} obligaciones mensuales…`);
  if (obligacionesMensuales.length > 0) {
    const r = await crearObligacionesMensualesEnLote(obligacionesMensuales);
    resultado.obligacionesMensualesGeneradas = r.creadas;
    resultado.obligacionesMensualesYaExistian = r.yaExistian;
    resultado.errores.push(...r.errores.map((e) => `Obligaciones mensuales: ${e}`));
  }

  // =====================================================================
  // 3) Ingresos institucionales
  // =====================================================================
  avanzarPaso("Validando ingresos institucionales…");
  const ingresosExternos = [];
  filasIngresosExternos.forEach((fila, i) => {
    const tipoTxt = normalizar(campo(fila, "Tipo"));
    const monto = Number(campo(fila, "Monto"));
    const fecha = convertirFecha(campo(fila, "Fecha")) || hoyISO();
    const concepto = String(campo(fila, "Concepto")).trim();
    const origen = String(campo(fila, "Origen")).trim();
    const observaciones = String(campo(fila, "Observaciones")).trim();
    const tipoValor = tipoTxt === "alquiler" ? "alquiler" : tipoTxt === "donacion" ? "donacion" : tipoTxt === "otro" || tipoTxt === "otros" ? "otro" : null;

    if (!tipoValor) {
      resultado.errores.push(`Ingresos institucionales, fila ${i + 2}: el tipo "${campo(fila, "Tipo")}" no se reconoce (usa Alquiler, Donación u Otro).`);
      return;
    }
    if (!concepto || !monto || monto <= 0) {
      resultado.errores.push(`Ingresos institucionales, fila ${i + 2}: falta el concepto o el monto no es válido.`);
      return;
    }
    ingresosExternos.push({ fecha, tipo: tipoValor, concepto, origen: origen || null, monto, observaciones: observaciones || null });
  });

  avanzarPaso(`Registrando ${ingresosExternos.length} ingresos institucionales…`);
  if (ingresosExternos.length > 0) {
    const r = await registrarIngresosExternosEnLote(ingresosExternos);
    resultado.ingresosExternosCreados = r.insertadas;
    resultado.errores.push(...r.errores.map((e) => `Ingresos institucionales: ${e}`));
  }

  // =====================================================================
  // 4) Gastos
  // =====================================================================
  const gastos = [];
  filasGastos.forEach((fila, i) => {
    const categoria = categoriasGasto.find((c) => normalizar(c.label) === normalizar(campo(fila, "Categoria", "Categoría")))?.value || "otros";
    const monto = Number(campo(fila, "Monto"));
    const fecha = convertirFecha(campo(fila, "Fecha")) || hoyISO();
    const concepto = String(campo(fila, "Concepto")).trim();
    const beneficiario = String(campo(fila, "Beneficiario")).trim();
    const formaPago = String(campo(fila, "Forma de pago")).trim();

    if (!concepto || !monto || monto <= 0) {
      resultado.errores.push(`Gastos, fila ${i + 2}: falta el concepto o el monto no es válido.`);
      return;
    }
    gastos.push({ fecha, categoria, concepto, beneficiario: beneficiario || null, monto, forma_pago: formaPago || null });
  });

  avanzarPaso(`Registrando ${gastos.length} gastos…`);
  if (gastos.length > 0) {
    const r = await registrarGastosEnLote(gastos);
    resultado.gastosCreados = r.insertadas;
    resultado.errores.push(...r.errores.map((e) => `Gastos: ${e}`));
  }

  return resultado;
}
