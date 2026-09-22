-- =====================================================================
-- FRATERNIDAD — AVISOS POR CORREO (paso 11)
-- -----------------------------------------------------------------------
-- Tabla de control para no mandar el mismo aviso dos veces el mismo día
-- (por ejemplo, un recordatorio de saldo pendiente o un saludo de
-- cumpleaños). La función en la nube (Edge Function) la usa antes de
-- enviar cada correo.
--
-- Seguro de volver a ejecutar. Pégalo completo en:
-- tu proyecto de Supabase → SQL Editor → New query → RUN.
-- =====================================================================

create table if not exists public.avisos_log (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  socio_id uuid references public.socios(id) on delete cascade,
  fecha date not null default current_date,
  detalle text,
  creado_en timestamptz not null default now(),
  unique (tipo, socio_id, fecha)
);

alter table public.avisos_log enable row level security;

drop policy if exists "avisos_log_select" on public.avisos_log;
create policy "avisos_log_select" on public.avisos_log
  for select to authenticated using (public.es_admin());

-- Las escrituras las hace la función en la nube directamente, con la
-- llave de servicio (no pasa por RLS), así que no hace falta una
-- política de escritura aquí.

-- =====================================================================
-- LISTO (de esta parte). Sigue con la Edge Function — no se puede
-- instalar por SQL, requiere la Supabase CLI (ver instrucciones).
-- =====================================================================
