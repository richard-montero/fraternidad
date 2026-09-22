-- =====================================================================
-- FRATERNIDAD — NUEVO ROL: PASIVO (paso 13)
-- -----------------------------------------------------------------------
-- Agrega "pasivo" a los roles permitidos. Es un rol de solo acceso muy
-- restringido: en la aplicación, un socio Pasivo únicamente ve "Pagar
-- con QR" y "Turno/Cumpleaños" — no ve su propio resumen financiero ni
-- ninguna sección administrativa. Esa restricción se aplica del lado de
-- la aplicación (el menú y las rutas); a nivel de base de datos, un
-- socio Pasivo tiene exactamente los mismos permisos que un Socio
-- normal (nunca administrador), así que no hace falta tocar ninguna
-- política de seguridad además de este check.
--
-- Seguro de volver a ejecutar. Pégalo completo en:
-- tu proyecto de Supabase → SQL Editor → New query → RUN.
-- =====================================================================

alter table public.socios drop constraint if exists socios_rol_check;
alter table public.socios add constraint socios_rol_check
  check (rol in ('socio','pasivo','supervisor','admin','superadmin'));

-- =====================================================================
-- LISTO. No hace falta tocar nada más.
-- =====================================================================
