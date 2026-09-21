import { supabase } from "./supabaseClient.js";

// =====================================================================
// Inserciones EN LOTE — usadas por la importación de Excel.
// Procesar fila por fila (una llamada de red por fila) es lento: con
// miles de filas puede tardar muchos minutos, y si el navegador queda
// en segundo plano o hay un corte de red, el proceso se detiene a la
// mitad sin avisar. Insertar en bloques de hasta CHUNK filas por llamada
// hace que todo el proceso tome segundos, no minutos.
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

// ---------- Socios ----------
// entradas: [{ nombre, celular, email, fechaNacimiento, turno, estado, rol }]
// Devuelve [{ id, celular }] de los socios creados. Nunca crea cuenta de
// acceso (igual que antes): se activa después, una por una.
export async function crearSociosEnLote(entradas) {
  const creados = [];
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
    if (error) throw error;
    creados.push(...data);
  }
  return creados;
}

// ---------- Obligación patrimonial acordada ----------
// entradas: [{ socioId, monto, fecha }] — suma al monto ya acordado de
// cada socio (si varias filas apuntan al mismo socio, se suman primero).
export async function sumarObligacionesPatrimonialesEnLote(entradas) {
  if (entradas.length === 0) return;
  const idsUnicos = [...new Set(entradas.map((e) => e.socioId))];

  const { data: existentes, error: errExistentes } = await supabase
    .from("obligaciones_patrimoniales")
    .select("socio_id, monto")
    .in("socio_id", idsUnicos);
  if (errExistentes) throw errExistentes;
  const previos = Object.fromEntries((existentes || []).map((e) => [e.socio_id, Number(e.monto)]));

  const sumaPorSocio = {};
  entradas.forEach((e) => { sumaPorSocio[e.socioId] = (sumaPorSocio[e.socioId] || 0) + Number(e.monto); });

  const upserts = idsUnicos.map((id) => ({ socio_id: id, monto: (previos[id] || 0) + sumaPorSocio[id] }));
  for (const grupo of trozos(upserts)) {
    const { error } = await supabase.from("obligaciones_patrimoniales").upsert(grupo, { onConflict: "socio_id" });
    if (error) throw error;
  }

  const movimientos = entradas.map((e) => ({ socio_id: e.socioId, fecha: e.fecha, concepto: "Aporte patrimonial acordado", debe: e.monto, haber: 0 }));
  await registrarMovimientosEnLote("movimientos_patrimoniales", movimientos);
}

// ---------- Movimientos (mayor patrimonial / mensual) ----------
// filas: [{ socio_id, fecha, concepto, debe, haber }]
export async function registrarMovimientosEnLote(tabla, filas) {
  for (const grupo of trozos(filas)) {
    const { error } = await supabase.from(tabla).insert(grupo);
    if (error) throw error;
  }
}

// ---------- Obligaciones mensuales generadas (Debe) ----------
// entradas: [{ socioId, anio, mes, monto, concepto, fecha }]
// Se descartan (sin error) las que ya estaban generadas para ese socio y
// mes, o repetidas dentro del mismo archivo.
export async function crearObligacionesMensualesEnLote(entradas) {
  if (entradas.length === 0) return { creadas: 0, yaExistian: 0 };
  const idsUnicos = [...new Set(entradas.map((e) => e.socioId))];

  const { data: existentes, error: errExistentes } = await supabase
    .from("obligaciones_mensuales_generadas")
    .select("socio_id, anio, mes")
    .in("socio_id", idsUnicos);
  if (errExistentes) throw errExistentes;
  const yaGeneradas = new Set((existentes || []).map((e) => `${e.socio_id}|${e.anio}|${e.mes}`));

  const nuevas = [];
  let yaExistian = 0;
  const vistasEnEsteLote = new Set();
  for (const e of entradas) {
    const clave = `${e.socioId}|${e.anio}|${e.mes}`;
    if (yaGeneradas.has(clave) || vistasEnEsteLote.has(clave)) { yaExistian++; continue; }
    vistasEnEsteLote.add(clave);
    nuevas.push(e);
  }

  for (const grupo of trozos(nuevas)) {
    const { error } = await supabase.from("obligaciones_mensuales_generadas").insert(grupo.map((e) => ({ socio_id: e.socioId, anio: e.anio, mes: e.mes })));
    if (error) throw error;
  }

  const movimientos = nuevas.map((e) => ({ socio_id: e.socioId, fecha: e.fecha, concepto: e.concepto, debe: e.monto, haber: 0 }));
  await registrarMovimientosEnLote("movimientos_mensuales", movimientos);

  return { creadas: nuevas.length, yaExistian };
}

// ---------- Aportes voluntarios ----------
// filas: [{ socio_id, monto, fecha, concepto, observaciones }]
export async function registrarAportesVoluntariosEnLote(filas) {
  for (const grupo of trozos(filas)) {
    const { error } = await supabase.from("aportes_voluntarios").insert(grupo);
    if (error) throw error;
  }
}

// ---------- Ingresos institucionales ----------
// filas: [{ fecha, tipo, concepto, origen, monto, observaciones }]
export async function registrarIngresosExternosEnLote(filas) {
  for (const grupo of trozos(filas)) {
    const { error } = await supabase.from("ingresos_externos").insert(grupo);
    if (error) throw error;
  }
}

// ---------- Gastos ----------
// filas: [{ fecha, categoria, concepto, beneficiario, monto, forma_pago }]
// (la importación masiva nunca adjunta comprobante — eso se hace a mano)
export async function registrarGastosEnLote(filas) {
  for (const grupo of trozos(filas)) {
    const { error } = await supabase.from("gastos").insert(grupo);
    if (error) throw error;
  }
}
