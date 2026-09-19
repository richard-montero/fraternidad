-- =====================================================================
-- FRATERNIDAD — MEJORAS (paso 3, opcional pero recomendado)
-- -----------------------------------------------------------------------
-- Este script agrega lo necesario para las funciones nuevas de la
-- aplicación actualizada:
--   • Permite a un SÚPER ADMINISTRADOR editar o eliminar un gasto ya
--     registrado (antes no se podía corregir un error de tipeo).
--   • Agrega índices para que los libros (mayor patrimonial, mensual,
--     gastos) carguen más rápido a medida que crece el historial.
--
-- Es seguro volver a ejecutarlo si algo falla: usa "if not exists" /
-- "drop policy if exists" en todas partes. Pégalo completo en:
-- tu proyecto de Supabase → SQL Editor → New query → RUN.
-- =====================================================================

-- ---------- Editar / eliminar gastos (solo súper administrador) ----------
drop policy if exists "gastos_update" on public.gastos;
create policy "gastos_update" on public.gastos for update to authenticated
  using (public.es_superadmin()) with check (public.es_superadmin());

drop policy if exists "gastos_delete" on public.gastos;
create policy "gastos_delete" on public.gastos for delete to authenticated
  using (public.es_superadmin());

-- ---------- Índices de rendimiento ----------
create index if not exists idx_mov_patrimoniales_socio on public.movimientos_patrimoniales(socio_id);
create index if not exists idx_mov_patrimoniales_fecha on public.movimientos_patrimoniales(fecha);
create index if not exists idx_mov_mensuales_socio on public.movimientos_mensuales(socio_id);
create index if not exists idx_mov_mensuales_fecha on public.movimientos_mensuales(fecha);
create index if not exists idx_gastos_fecha on public.gastos(fecha);
create index if not exists idx_aportes_vol_socio on public.aportes_voluntarios(socio_id);
create index if not exists idx_aportes_vol_fecha on public.aportes_voluntarios(fecha);

-- =====================================================================
-- LISTO. No hace falta tocar nada más: el resto de la aplicación
-- (socios, aportes, mensualidades, reportes) sigue funcionando con el
-- esquema de 01_schema.sql sin cambios.
-- =====================================================================
