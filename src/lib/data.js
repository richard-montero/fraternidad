import { supabase } from "./supabaseClient.js";
import { crearUsuarioDeAcceso } from "./crearUsuario.js";

// =====================================================================
// Todas las funciones que hablan con la base de datos viven aquí.
// Los componentes de la interfaz nunca llaman a Supabase directamente:
// siempre pasan por estas funciones.
// =====================================================================

function generarCodigoSocio() {
  return "S-" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

// ---------- Ajustes generales (nombre de la fraternidad, etc.) ----------
// Lectura pública (funciona incluso antes de iniciar sesión, para que la
// pantalla de ingreso muestre el nombre correcto); escritura solo para el
// súper administrador (ver supabase/06_nombre_fraternidad.sql).
export async function obtenerAjuste(clave, valorPorDefecto) {
  const { data, error } = await supabase.from("ajustes_generales").select("valor").eq("clave", clave).maybeSingle();
  if (error || !data) return valorPorDefecto;
  return data.valor;
}

export async function guardarAjuste(clave, valor) {
  const { error } = await supabase.from("ajustes_generales").upsert({ clave, valor: valor.trim() }, { onConflict: "clave" });
  if (error) throw error;
}

// ---------- Sesión ----------
export async function iniciarSesion(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const socio = await obtenerSocioPorAuthId(data.user.id);
  if (!socio) {
    await supabase.auth.signOut();
    throw new Error(
      "Tu usuario existe en Autenticación pero no está vinculado a ningún socio. Pide a un administrador que te registre desde la sección Socios."
    );
  }
  if (socio.estado === "de_baja") {
    await supabase.auth.signOut();
    throw new Error("Tu cuenta está dada de baja. Contacta a un administrador de la fraternidad.");
  }
  return socio;
}

export async function cerrarSesion() {
  await supabase.auth.signOut();
}

export async function obtenerSesionActual() {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return null;
  const socio = await obtenerSocioPorAuthId(data.user.id);
  if (!socio || socio.estado === "de_baja") return null;
  return socio;
}

async function obtenerSocioPorAuthId(authUserId) {
  const { data, error } = await supabase
    .from("socios")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ---------- Socios ----------
export async function listarSocios() {
  const { data, error } = await supabase.from("socios").select("*").order("nombre");
  if (error) throw error;
  return data;
}

// Genera un correo temporal a partir del celular (real o un número
// inventado, ej. 70000001), para socios de los que aún no se conoce su
// correo real.
export function correoTemporalDesdeCelular(celular) {
  return `${celular.trim().replace(/\s+/g, "")}@temporal.fraternidad`;
}

export async function crearSocio({ nombre, celular, email, fechaNacimiento, turno, rol = "socio", estado = "patrimonial", password, crearAcceso = true }) {
  const celularLimpio = celular.trim();
  const correoReal = email?.trim();

  let authUserId = null;
  let correoFinal = correoReal || null;
  let requiereConfig = false;

  if (crearAcceso) {
    const usaCorreoTemporal = !correoReal;
    correoFinal = correoReal || correoTemporalDesdeCelular(celularLimpio);
    const passwordFinal = password && password.trim().length >= 6 ? password.trim() : "123456";
    authUserId = await crearUsuarioDeAcceso(correoFinal, passwordFinal);
    requiereConfig = usaCorreoTemporal;
  }

  const { data, error } = await supabase
    .from("socios")
    .insert({
      auth_user_id: authUserId,
      nombre: nombre.trim(),
      celular: celularLimpio,
      email: correoFinal,
      fecha_nacimiento: fechaNacimiento || null,
      turno: turno || null,
      codigo: generarCodigoSocio(),
      estado,
      rol,
      requiere_configuracion_inicial: requiereConfig,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Crea la cuenta de acceso (auth.users) para un socio que se registró
// SIN una — por ejemplo, uno importado desde Excel. Se llama de a uno
// por vez (nunca en lote), porque Supabase limita cuántas cuentas se
// pueden crear por hora desde el correo integrado (ver README).
export async function activarAccesoSocio(socioId, celular, { email, password }) {
  const correoReal = email?.trim();
  const usaCorreoTemporal = !correoReal;
  const correoFinal = correoReal || correoTemporalDesdeCelular(celular);
  const passwordFinal = password && password.trim().length >= 6 ? password.trim() : "123456";

  const authUserId = await crearUsuarioDeAcceso(correoFinal, passwordFinal);

  const { error } = await supabase
    .from("socios")
    .update({ auth_user_id: authUserId, email: correoFinal, requiere_configuracion_inicial: usaCorreoTemporal })
    .eq("id", socioId);
  if (error) throw error;
}

// Primer ingreso con credenciales temporales: el propio socio define su
// correo real y su nueva contraseña. La contraseña queda activa de
// inmediato; el correo queda pendiente de confirmación (Supabase envía
// un enlace a esa dirección) — ver supabase/07_primer_ingreso.sql.
export async function completarConfiguracionInicial(socioId, { nuevoCorreo, nuevaPassword }) {
  const { error: errPass } = await supabase.auth.updateUser({ password: nuevaPassword });
  if (errPass) throw errPass;

  const { error: errEmail } = await supabase.auth.updateUser({ email: nuevoCorreo.trim() });
  if (errEmail) throw errEmail;

  const { error: errSocio } = await supabase
    .from("socios")
    .update({ email: nuevoCorreo.trim(), requiere_configuracion_inicial: false })
    .eq("id", socioId);
  if (errSocio) throw errSocio;
}

// Cambiar el estado (Patrimonial / Invitado / De baja) — la base de
// datos exige que solo un súper administrador pueda hacerlo (trigger en
// supabase/04_cambios.sql), independientemente de qué muestre la interfaz.
export async function cambiarEstadoSocio(socioId, nuevoEstado) {
  const { error } = await supabase.from("socios").update({ estado: nuevoEstado }).eq("id", socioId);
  if (error) throw error;
}

export async function cambiarRolSocio(socioId, nuevoRol) {
  const { error } = await supabase.from("socios").update({ rol: nuevoRol }).eq("id", socioId);
  if (error) throw error;
}

export async function editarSocio(socioId, { nombre, celular, email, fechaNacimiento, turno }) {
  const { error } = await supabase
    .from("socios")
    .update({ nombre: nombre.trim(), celular: celular.trim(), email: email.trim(), fecha_nacimiento: fechaNacimiento || null, turno: turno || null })
    .eq("id", socioId);
  if (error) throw error;
}

// No existe forma de fijar directamente la contraseña de OTRO usuario usando
// solo la llave pública (eso requeriría una llave secreta / Edge Function,
// que decidimos no usar). En su lugar, enviamos un enlace de restablecimiento
// al correo del socio.
export async function enviarRestablecimientoPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

// ---------- Configuración anual ----------
export async function listarConfigAnual() {
  const { data, error } = await supabase.from("config_anual").select("*").order("anio", { ascending: false });
  if (error) throw error;
  return data;
}

export async function guardarCuotaAnual(anio, cuota) {
  const { error } = await supabase.from("config_anual").upsert({ anio, cuota }, { onConflict: "anio" });
  if (error) throw error;
}

// ---------- Obligaciones patrimoniales ----------
export async function listarObligacionesPatrimoniales() {
  const { data, error } = await supabase.from("obligaciones_patrimoniales").select("*");
  if (error) throw error;
  const mapa = {};
  data.forEach((o) => { mapa[o.socio_id] = Number(o.monto); });
  return mapa;
}

export async function crearObligacionPatrimonial(socioId, monto, fecha) {
  const { data: existente, error: errBusqueda } = await supabase
    .from("obligaciones_patrimoniales")
    .select("monto")
    .eq("socio_id", socioId)
    .maybeSingle();
  if (errBusqueda) throw errBusqueda;

  const nuevoMonto = (existente ? Number(existente.monto) : 0) + Number(monto);
  const { error } = await supabase
    .from("obligaciones_patrimoniales")
    .upsert({ socio_id: socioId, monto: nuevoMonto }, { onConflict: "socio_id" });
  if (error) throw error;

  await registrarMovimiento("movimientos_patrimoniales", socioId, fecha, "Aporte patrimonial acordado", monto, 0);
}

export async function registrarPagoPatrimonial(socioId, monto, fecha, concepto) {
  await registrarMovimiento("movimientos_patrimoniales", socioId, fecha, concepto, 0, monto);
}

// ---------- Movimientos (patrimoniales y mensuales comparten forma) ----------
async function registrarMovimiento(tabla, socioId, fecha, concepto, debe, haber) {
  const { error } = await supabase.from(tabla).insert({ socio_id: socioId, fecha, concepto, debe, haber });
  if (error) throw error;
}

export async function listarMovimientos(tabla) {
  const { data, error } = await supabase.from(tabla).select("*").order("fecha", { ascending: true });
  if (error) throw error;
  const mapa = {};
  data.forEach((m) => {
    if (!mapa[m.socio_id]) mapa[m.socio_id] = [];
    mapa[m.socio_id].push(m);
  });
  return mapa;
}

export async function registrarPagoMensual(socioId, monto, fecha, concepto) {
  await registrarMovimiento("movimientos_mensuales", socioId, fecha, concepto, 0, monto);
}

// Crea la obligación (Debe) de un mes puntual para UN solo socio — a
// diferencia de generarMensualidades(), que genera el mes para todos los
// socios activos a la vez con la cuota configurada. Esta función es para
// cargar historial (por ejemplo, desde la importación de Excel), mes por
// mes y socio por socio, con el monto exacto que corresponda a cada caso.
// Si ese socio ya tiene ese mes marcado como generado, no hace nada (evita
// duplicar) y lo informa con yaExistia: true.
export async function crearObligacionMensualHistorica(socioId, anio, mes, monto, concepto) {
  const { data: existente, error: errCheck } = await supabase
    .from("obligaciones_mensuales_generadas")
    .select("id")
    .eq("socio_id", socioId).eq("anio", anio).eq("mes", mes)
    .maybeSingle();
  if (errCheck) throw errCheck;
  if (existente) return { yaExistia: true };

  const { error: errInsertObl } = await supabase
    .from("obligaciones_mensuales_generadas")
    .insert({ socio_id: socioId, anio, mes });
  if (errInsertObl) throw errInsertObl;

  const fecha = `${anio}-${String(mes).padStart(2, "0")}-01`;
  await registrarMovimiento("movimientos_mensuales", socioId, fecha, concepto, monto, 0);
  return { yaExistia: false };
}

// Ajuste manual (corrección o anulación) sobre el mayor patrimonial o mensual.
// No se editan ni se borran movimientos existentes — se agrega un asiento
// compensatorio, para conservar el historial completo como en un libro
// contable real.
export async function registrarAjuste(tabla, socioId, monto, fecha, concepto, tipo) {
  const debe = tipo === "debe" ? monto : 0;
  const haber = tipo === "haber" ? monto : 0;
  await registrarMovimiento(tabla, socioId, fecha, concepto, debe, haber);
}

// ---------- Mensualidades generadas ----------
export async function listarObligacionesMensualesGeneradas() {
  const { data, error } = await supabase.from("obligaciones_mensuales_generadas").select("*");
  if (error) throw error;
  return data;
}

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

export async function generarMensualidades(anio, mes, socios, configAnual) {
  const cfg = configAnual.find((c) => c.anio === anio);
  if (!cfg) return { ok: false, mensaje: `No existe cuota configurada para el año ${anio}.` };

  const { data: yaGeneradas, error: errGen } = await supabase
    .from("obligaciones_mensuales_generadas")
    .select("socio_id")
    .eq("anio", anio)
    .eq("mes", mes);
  if (errGen) throw errGen;
  const idsConObligacion = new Set(yaGeneradas.map((o) => o.socio_id));

  const activos = socios.filter((s) => s.estado !== "de_baja" && !idsConObligacion.has(s.id));
  if (activos.length === 0) {
    return { ok: true, mensaje: "No se generaron obligaciones nuevas: ya existían para todos los socios (los socios de baja no reciben mensualidades)." };
  }

  const nuevasObligaciones = activos.map((s) => ({ socio_id: s.id, anio, mes }));
  const { error: errInsertObl } = await supabase.from("obligaciones_mensuales_generadas").insert(nuevasObligaciones);
  if (errInsertObl) throw errInsertObl;

  const fecha = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const nuevosMovimientos = activos.map((s) => ({
    socio_id: s.id,
    fecha,
    concepto: `Mensualidad ${MESES[mes - 1]} ${anio}`,
    debe: cfg.cuota,
    haber: 0,
  }));
  const { error: errInsertMov } = await supabase.from("movimientos_mensuales").insert(nuevosMovimientos);
  if (errInsertMov) throw errInsertMov;

  return { ok: true, mensaje: `Se generaron ${activos.length} obligación(es) nueva(s) para ${MESES[mes - 1]} ${anio}.` };
}

// ---------- Aportes voluntarios ----------
export async function listarAportesVoluntarios() {
  const { data, error } = await supabase.from("aportes_voluntarios").select("*").order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function registrarAporteVoluntario(socioId, monto, fecha, concepto, observaciones) {
  const { error } = await supabase
    .from("aportes_voluntarios")
    .insert({ socio_id: socioId, monto, fecha, concepto, observaciones });
  if (error) throw error;
}

// ---------- Ingresos que no provienen de socios ----------
export async function listarIngresosExternos() {
  const { data, error } = await supabase.from("ingresos_externos").select("*").order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function registrarIngresoExterno({ fecha, tipo, concepto, origen, monto, observaciones }) {
  const { error } = await supabase
    .from("ingresos_externos")
    .insert({ fecha, tipo, concepto: concepto.trim(), origen: origen?.trim() || null, monto, observaciones: observaciones?.trim() || null });
  if (error) throw error;
}

// Editar y eliminar requieren la política de supabase/04_cambios.sql
// (solo súper administrador).
export async function editarIngresoExterno(id, { fecha, tipo, concepto, origen, monto, observaciones }) {
  const { error } = await supabase
    .from("ingresos_externos")
    .update({ fecha, tipo, concepto: concepto.trim(), origen: origen?.trim() || null, monto, observaciones: observaciones?.trim() || null })
    .eq("id", id);
  if (error) throw error;
}

export async function eliminarIngresoExterno(id) {
  const { error } = await supabase.from("ingresos_externos").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Gastos ----------
const BUCKET_COMPROBANTES = "comprobantes-gastos";

export async function listarGastos() {
  const { data, error } = await supabase.from("gastos").select("*").order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function registrarGasto(gasto, archivo) {
  let comprobanteRuta = null;
  if (archivo) {
    const nombreArchivo = `${Date.now()}_${archivo.name}`.replace(/\s+/g, "_");
    const { error: errSubida } = await supabase.storage.from(BUCKET_COMPROBANTES).upload(nombreArchivo, archivo);
    if (errSubida) throw errSubida;
    comprobanteRuta = nombreArchivo;
  }

  const { error } = await supabase.from("gastos").insert({
    fecha: gasto.fecha,
    categoria: gasto.categoria,
    concepto: gasto.concepto,
    beneficiario: gasto.beneficiario,
    monto: gasto.monto,
    forma_pago: gasto.formaPago,
    comprobante_ruta: comprobanteRuta,
  });
  if (error) throw error;
}

// Editar y eliminar gasto requieren la política adicional de
// supabase/03_mejoras.sql (solo súper administrador).
export async function editarGasto(gastoId, gasto) {
  const { error } = await supabase
    .from("gastos")
    .update({
      fecha: gasto.fecha,
      categoria: gasto.categoria,
      concepto: gasto.concepto,
      beneficiario: gasto.beneficiario,
      monto: gasto.monto,
      forma_pago: gasto.formaPago,
    })
    .eq("id", gastoId);
  if (error) throw error;
}

export async function eliminarGasto(gastoId) {
  const { error } = await supabase.from("gastos").delete().eq("id", gastoId);
  if (error) throw error;
}

export async function obtenerUrlComprobante(ruta) {
  const { data, error } = await supabase.storage.from(BUCKET_COMPROBANTES).createSignedUrl(ruta, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
