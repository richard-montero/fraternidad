-- =====================================================================
-- FRATERNIDAD — HISTORIAL DE CUOTAS + PAGOS CON QR (paso 9)
-- -----------------------------------------------------------------------
-- 1) config_anual pasa de "una cuota por año" a un HISTORIAL: se puede
--    definir más de una cuota para el mismo año, y siempre se usa la
--    última que se guardó (para generar mensualidades y para mostrar la
--    cuota vigente).
-- 2) Permite que un administrador (no solo el súper administrador) suba
--    las dos imágenes de QR de pago, guardando su ruta en
--    ajustes_generales junto al nombre de la fraternidad, pero SOLO para
--    esas dos claves puntuales — el nombre de la fraternidad sigue
--    siendo exclusivo del súper administrador.
--
-- Seguro de volver a ejecutar. Pégalo completo en:
-- tu proyecto de Supabase → SQL Editor → New query → RUN.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) config_anual: de "una fila por año" a historial completo
-- ---------------------------------------------------------------------
alter table public.config_anual add column if not exists id uuid default gen_random_uuid();
alter table public.config_anual add column if not exists creado_en timestamptz not null default now();
update public.config_anual set id = gen_random_uuid() where id is null;
alter table public.config_anual alter column id set not null;

alter table public.config_anual drop constraint if exists config_anual_pkey;
alter table public.config_anual add primary key (id);
create index if not exists idx_config_anual_anio on public.config_anual(anio, creado_en desc);

-- ---------------------------------------------------------------------
-- 2) Pagos con QR: un administrador (no solo súper admin) puede subir
--    las dos imágenes, guardando su ruta en ajustes_generales.
-- ---------------------------------------------------------------------
drop policy if exists "ajustes_generales_insert_qr" on public.ajustes_generales;
create policy "ajustes_generales_insert_qr" on public.ajustes_generales
  for insert to authenticated
  with check (public.es_admin() and clave in ('qr_alquiler_ruta', 'qr_patrimonial_ruta'));

drop policy if exists "ajustes_generales_update_qr" on public.ajustes_generales;
create policy "ajustes_generales_update_qr" on public.ajustes_generales
  for update to authenticated
  using (public.es_admin() and clave in ('qr_alquiler_ruta', 'qr_patrimonial_ruta'))
  with check (public.es_admin() and clave in ('qr_alquiler_ruta', 'qr_patrimonial_ruta'));

-- =====================================================================
-- LISTO. Falta un paso manual (no se puede hacer por SQL): crear el
-- bucket de Storage para las imágenes de QR. Ve a Storage → New bucket →
-- nombre exacto "qr-pagos" → déjalo privado (igual que
-- "comprobantes-gastos") → Save.
-- =====================================================================
