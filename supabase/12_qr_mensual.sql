-- =====================================================================
-- FRATERNIDAD — TERCER QR: OBLIGACIONES MENSUALES (paso 12)
-- -----------------------------------------------------------------------
-- Agrega la clave del nuevo QR ("Obligaciones Mensuales") a las
-- políticas que ya permitían a un administrador subir los QR de
-- Alquiler/Uso fraternidad y Patrimonial.
--
-- Seguro de volver a ejecutar. Pégalo completo en:
-- tu proyecto de Supabase → SQL Editor → New query → RUN.
-- =====================================================================

drop policy if exists "ajustes_generales_insert_qr" on public.ajustes_generales;
create policy "ajustes_generales_insert_qr" on public.ajustes_generales
  for insert to authenticated
  with check (public.es_admin() and clave in ('qr_mensual_ruta', 'qr_alquiler_ruta', 'qr_patrimonial_ruta'));

drop policy if exists "ajustes_generales_update_qr" on public.ajustes_generales;
create policy "ajustes_generales_update_qr" on public.ajustes_generales
  for update to authenticated
  using (public.es_admin() and clave in ('qr_mensual_ruta', 'qr_alquiler_ruta', 'qr_patrimonial_ruta'))
  with check (public.es_admin() and clave in ('qr_mensual_ruta', 'qr_alquiler_ruta', 'qr_patrimonial_ruta'));

-- =====================================================================
-- LISTO. No hace falta tocar nada más (usa el mismo bucket "qr-pagos"
-- que ya creaste para los otros dos QR).
-- =====================================================================
