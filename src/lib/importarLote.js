import { supabase } from "./supabaseClient.js";

// =====================================================================
// Inserciones EN LOTE — usadas por la importación de Excel.
// Procesar fila por fila (una llamada de red por fila) es lento: con
// miles de filas puede tardar muchos minutos, y si el navegador queda
// en segundo plano o hay un corte de red, el proceso se detiene a la
// mitad sin avisar. Insertar en bloques de hasta CHUNK filas por llamada
// hace que todo el proceso tome segundos, no minutos.
//
// IMPORTANTE: si un bloque falla, los demás bloques igual se intentan
// — nunca se abandona el resto del archivo por un solo tropiezo. Cada
// función devuelve cuántas filas entraron y el detalle de lo que falló.
// =====================================================================

const CHUNK = 500;

function trozos(lista, tam = CHUNK) {
  const out = [];
  for (let i = 0; i < lista.length; i += tam) out.push(lista.slice(i, i + tam));
  return out;
}

function generarCodigoSocio() {
  return "S-" + Math.random().toString(36).slice(2, 10).toUpperCase();
}

// Inserta `filas` en `tabla`, en bloques. Un bloque que falla no impide
// que seʼ intenten los siguientes. Devuelve cuántas filas entraron y los
// mensajes de error de los bloques que fallaron (si los hubo).
async function insertarEnLotes(tabla, filas) {
  let insertadas = 0;
  const errores = [];
  for (const grupo of trozos(filas)) {
    const { error } = await supabase.from(tabla).insert(grupo);
    if (error) errores.push(`${grupo.length} fila(s): ${error.message}`);
    else insertadas += grupo.length;
  }
  return { insertadas, errores };
}

// ---------- Socios ----------
// entradas: [{ nombre, celular, email, fechaNacimiento, turno, estado, rol }]
// Devuelve { creados: [{ id, celular }], errores }. Nunca crea cuenta de
// acceso (igual que antes): se activa después, una por una.
export async function crearSociosEnLote(entradas) {
  const creados = [];
  const errores = [];
  for (const grupo of trozos(entradas)) {
    const payload = grupo.map((f) => ({
      auth_user_id: null,
      nombre: f.nombre.trim(),
      celular: f.celular.trim(),
      email: f.email?.trim() || null,
      fecha_nacimiento: f.fechaNacimiento || null,
      turno: f.turno || null,
      codigo: generarCodigoSocio(),
      estado: f.estado,
      rol: f.rol,
      requiere_configuracion_inicial: false,
    }));
    const { data, error } = await supabase.from("socios").insert(payload).select("id, celular");
    if (error) errores.push(`${grupo.length} socio(s): ${error.message}`);
    else creados.push(...data);
  }
  return { creados, errores };
}

// ---------- Obligación patrimonial acordada ----------
// entradas: [{ socioId, monto, fecha }] — suma al monto ya acordado de
// cada socio (si varias filas apuntan al mismo socio, se suman primero).
export async function sumarObligacionesPatrimonialesEnLote(entradas) {
  if (entradas.length === 0) return { errores: [] };
  const idsUnicos = [...new Set(entradas.map((e) => e.socioId))];
  const errores = [];

  const previos = {};
  for (const grupoIds of trozos(idsUnicos, 200)) {
    const { data, error } = await supabase.from("obligaciones_patrimoniales").select("socio_id, monto").in("socio_id", grupoIds);
    if (error) { errores.push(`No se pudo leer el saldo previo de ${grupoIds.length} socio(s): ${error.message}`); continue; }
    (data || []).forEach((d) => { previos[d.socio_id] = Number(d.monto); });
  }

  const sumaPorSocio = {};
  entradas.forEach((e) => { sumaPorSocio[e.socioId] = (sumaPorSocio[e.socioId] || 0) + Number(e.monto); });

  const upserts = idsUnicos.map((id) => ({ socio_id: id, monto: (previos[id] || 0) + sumaPorSocio[id] }));
  for (const grupo of trozos(upserts)) {
    const { error } = await supabase.from("obligaciones_patrimoniales").upsert(grupo, { onConflict: "socio_id" });
    if (error) errores.push(`${grupo.length} obligación(es) patrimonial(es): ${error.message}`);
  }

  const movimientos = entradas.map((e) => ({ socio_id: e.socioId, fecha: e.fecha, concepto: "Aporte patrimonial acordado", debe: e.monto, haber: 0 }));
  const rMov = await insertarEnLotes("movimientos_patrimoniales", movimientos);
  errores.push(...rMov.errores);
  return { errores };
}

// ---------- Movimientos (mayor patrimonial / mensual) ----------
// filas: [{ socio_id, fecha, concepto, debe, haber }]
export async function registrarMovimientosEnLote(tabla, filas) {
  return insertarEnLotes(tabla, filas);
}

// ---------- Obligaciones mensuales generadas (Debe) ----------
// entradas: [{ socioId, anio, mes, monto, concepto, fecha }]
// Usa la función importar_obligaciones_mensuales (ver
// supabase/08_importacion_robusta.sql), que inserta la obligación y su
// movimiento en una sola operación atómica por bloque, y descarta sola
// (con ON CONFLICT, a nivel de base de datos) las que ya estaban
// generadas para ese socio y mes — no hace falta consultarlo antes.
export async function crearObligacionesMensualesEnLote(entradas) {
  if (entradas.length === 0) return { creadas: 0, errores: [] };
  let creadas = 0;
  const errores = [];
  for (const grupo of trozos(entradas, 1000)) {
    const payload = grupo.map((e) => ({ socio_id: e.socioId, anio: e.anio, mes: e.mes, monto: e.monto, concepto: e.concepto, fecha: e.fecha }));
    const { data, error } = await supabase.rpc("importar_obligaciones_mensuales", { payload });
    if (error) errores.push(`${grupo.length} obligación(es) mensual(es): ${error.message}`);
    else creadas += data ?? 0;
  }
  // yaExistian: filas que no se insertaron porque ya existían (se descartan
  // solas por ON CONFLICT dentro de la función) — es una aproximación,
  // ya que las filas de bloques con error tampoco se cuentan como creadas.
  const yaExistian = Math.max(0, entradas.length - creadas);
  return { creadas, yaExistian, errores };
}

// ---------- Aportes voluntarios ----------
// filas: [{ socio_id, monto, fecha, concepto, observaciones }]
export async function registrarAportesVoluntariosEnLote(filas) {
  return insertarEnLotes("aportes_voluntarios", filas);
}

// ---------- Ingresos institucionales ----------
// filas: [{ fecha, tipo, concepto, origen, monto, observaciones }]
export async function registrarIngresosExternosEnLote(filas) {
  return insertarEnLotes("ingresos_externos", filas);
}

// ---------- Gastos ----------
// filas: [{ fecha, categoria, concepto, beneficiario, monto, forma_pago }]
// (la importación masiva nunca adjunta comprobante — eso se hace a mano)
export async function registrarGastosEnLote(filas) {
  return insertarEnLotes("gastos", filas);
}
