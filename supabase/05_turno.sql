-- =====================================================================
-- FRATERNIDAD — NUEVO CAMPO: TURNO (paso 5)
-- -----------------------------------------------------------------------
-- Agrega a cada socio un campo "Turno", con doce valores posibles: los
-- meses del año abreviados (Ene, Feb, Mar, Abr, May, Jun, Jul, Ago, Sep,
-- Oct, Nov, Dic). Queda opcional (puede estar vacío).
--
-- Seguro de volver a ejecutar. Pégalo completo en:
-- tu proyecto de Supabase → SQL Editor → New query → RUN.
-- =====================================================================

alter table public.socios add column if not exists turno text;

alter table public.socios drop constraint if exists socios_turno_check;
alter table public.socios add constraint socios_turno_check
  check (turno is null or turno in ('Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'));

-- =====================================================================
-- LISTO. No hace falta tocar nada más.
-- =====================================================================
