// supabase/functions/enviar-avisos/index.ts
//
// Envía los avisos por correo de la fraternidad (Resend). La puede
// llamar: (a) un administrador logueado desde la app, o (b) un trabajo
// programado (cron) que manda la clave secreta en el encabezado
// "x-clave-cron". Nunca se manda nada al correo temporal de un socio
// que todavía no completó su primer ingreso.
//
// Variables de entorno que necesita (Supabase → Edge Functions → Secrets):
//   RESEND_API_KEY   — tu llave de Resend
//   CLAVE_CRON       — una clave inventada por ti, solo para los envíos
//                       automáticos programados (no la comparte nadie)
//   REMITENTE        — opcional, ej. "Fraternidad <avisos@tudominio.com>"
//                       (si no lo defines, usa el remitente de prueba de Resend)
//
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY ya los provee Supabase solo,
// no hace falta configurarlos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CLAVE_CRON = Deno.env.get("CLAVE_CRON") ?? "";
const REMITENTE = Deno.env.get("REMITENTE") ?? "Fraternidad <onboarding@resend.dev>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-clave-cron",
};

function bs(monto: number) {
  return "Bs " + Number(monto).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function respuesta(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function enviarCorreo(destinatario: string, asunto: string, html: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: REMITENTE, to: [destinatario], subject: asunto, html }),
  });
  if (!resp.ok) throw new Error(`Resend respondió ${resp.status}: ${await resp.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const { tipo } = body;
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // ---------------- Autorización ----------------
    const auth = req.headers.get("Authorization") || "";
    const claveCronRecibida = req.headers.get("x-clave-cron") || "";
    let autorizado = false;

    if (claveCronRecibida && CLAVE_CRON && claveCronRecibida === CLAVE_CRON) {
      autorizado = true;
    } else if (auth.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      if (userData?.user) {
        const { data: socio } = await supabaseAdmin
          .from("socios")
          .select("rol,estado")
          .eq("auth_user_id", userData.user.id)
          .maybeSingle();
        if (socio && socio.estado !== "de_baja" && (socio.rol === "admin" || socio.rol === "superadmin")) autorizado = true;
      }
    }
    if (!autorizado) return respuesta({ error: "No autorizado." }, 401);

    // ---------------- Helpers ----------------
    async function sociosConCorreoReal() {
      const { data } = await supabaseAdmin
        .from("socios")
        .select("id,nombre,email,fecha_nacimiento")
        .not("auth_user_id", "is", null)
        .eq("requiere_configuracion_inicial", false)
        .neq("estado", "de_baja");
      return data ?? [];
    }
    async function yaEnviado(tipoAviso: string, socioId: string, fecha: string) {
      const { data } = await supabaseAdmin
        .from("avisos_log").select("id")
        .eq("tipo", tipoAviso).eq("socio_id", socioId).eq("fecha", fecha).maybeSingle();
      return !!data;
    }
    async function marcarEnviado(tipoAviso: string, socioId: string, fecha: string, detalle: string) {
      await supabaseAdmin.from("avisos_log").insert({ tipo: tipoAviso, socio_id: socioId, fecha, detalle });
    }

    const hoy = new Date().toISOString().slice(0, 10);
    let enviados = 0;
    const errores: string[] = [];

    // ==================================================================
    // Confirmación de un pago puntual (la llama la app justo después de
    // registrar el pago, con el socio y el monto)
    // ==================================================================
    if (tipo === "confirmacion_pago") {
      const { socioId, monto, concepto, cuenta } = body;
      const { data: socio } = await supabaseAdmin
        .from("socios").select("nombre,email,requiere_configuracion_inicial,auth_user_id")
        .eq("id", socioId).maybeSingle();
      if (socio?.email && socio.auth_user_id && !socio.requiere_configuracion_inicial) {
        await enviarCorreo(
          socio.email,
          "Confirmación de pago recibido",
          `<p>Hola ${socio.nombre},</p><p>Confirmamos que registramos tu pago de <b>${bs(monto)}</b> (${concepto}) en la cuenta <b>${cuenta}</b>.</p><p>Gracias.</p>`
        );
        enviados++;
      }
    }

    // ==================================================================
    // Recordatorio de saldo pendiente (patrimonial y/o mensual)
    // ==================================================================
    else if (tipo === "recordatorio_pendientes") {
      const socios = await sociosConCorreoReal();
      for (const s of socios) {
        try {
          const { data: movP } = await supabaseAdmin.from("movimientos_patrimoniales").select("debe,haber").eq("socio_id", s.id);
          const { data: movM } = await supabaseAdmin.from("movimientos_mensuales").select("debe,haber").eq("socio_id", s.id);
          const saldoPatrimonial = (movP ?? []).reduce((a: number, m: any) => a + Number(m.debe) - Number(m.haber), 0);
          const saldoMensual = (movM ?? []).reduce((a: number, m: any) => a + Number(m.debe) - Number(m.haber), 0);
          if (saldoPatrimonial <= 0 && saldoMensual <= 0) continue;
          if (await yaEnviado("recordatorio_pendientes", s.id, hoy)) continue;

          const filas: string[] = [];
          if (saldoPatrimonial > 0) filas.push(`<li>Aporte patrimonial: <b>${bs(saldoPatrimonial)}</b></li>`);
          if (saldoMensual > 0) filas.push(`<li>Aportes mensuales: <b>${bs(saldoMensual)}</b></li>`);

          await enviarCorreo(s.email, "Recordatorio de saldo pendiente", `<p>Hola ${s.nombre},</p><p>Tienes los siguientes saldos pendientes:</p><ul>${filas.join("")}</ul>`);
          await marcarEnviado("recordatorio_pendientes", s.id, hoy, `Patrimonial ${saldoPatrimonial} / Mensual ${saldoMensual}`);
          enviados++;
        } catch (e) {
          errores.push(`${s.nombre}: ${e.message}`);
        }
      }
    }

    // ==================================================================
    // Aviso general (reuniones, eventos, anuncios) — a todos los socios
    // con correo real confirmado
    // ==================================================================
    else if (tipo === "aviso_general") {
      const { asunto, mensaje } = body;
      const socios = await sociosConCorreoReal();
      for (const s of socios) {
        try {
          await enviarCorreo(s.email, asunto, `<p>Hola ${s.nombre},</p><p>${String(mensaje).replace(/\n/g, "<br/>")}</p>`);
          enviados++;
        } catch (e) {
          errores.push(`${s.nombre}: ${e.message}`);
        }
      }
    }

    // ==================================================================
    // Saludo de cumpleaños a quien cumpla años hoy
    // ==================================================================
    else if (tipo === "cumpleanos_hoy") {
      const ahora = new Date();
      const diaHoy = ahora.getDate();
      const mesHoy = ahora.getMonth() + 1;
      const socios = await sociosConCorreoReal();
      for (const s of socios) {
        if (!s.fecha_nacimiento) continue;
        const mes = Number(s.fecha_nacimiento.slice(5, 7));
        const dia = Number(s.fecha_nacimiento.slice(8, 10));
        if (mes !== mesHoy || dia !== diaHoy) continue;
        if (await yaEnviado("cumpleanos", s.id, hoy)) continue;
        try {
          await enviarCorreo(s.email, "¡Feliz cumpleaños! 🎉", `<p>Hola ${s.nombre},</p><p>¡Todo el equipo de la fraternidad te desea un muy feliz cumpleaños!</p>`);
          await marcarEnviado("cumpleanos", s.id, hoy, "");
          enviados++;
        } catch (e) {
          errores.push(`${s.nombre}: ${e.message}`);
        }
      }
    }

    else {
      return respuesta({ error: "Tipo de aviso no reconocido." }, 400);
    }

    return respuesta({ enviados, errores });
  } catch (e) {
    return respuesta({ error: e.message }, 500);
  }
});
