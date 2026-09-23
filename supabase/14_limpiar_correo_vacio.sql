-- =====================================================================
-- FRATERNIDAD — CORRECCIÓN: CORREO VACÍO GUARDADO COMO TEXTO (paso 14)
-- -----------------------------------------------------------------------
-- "Editar datos" guardaba un correo vacío como texto vacío ('') en vez
-- de "sin valor" (NULL) — como la columna exige correos únicos, el
-- segundo socio que se guardara sin correo chocaba contra el primero
-- que ya tenía '' guardado ahí ("duplicate key value violates unique
-- constraint socios_email_key"). Esto limpia los que ya quedaron así.
--
-- Seguro de volver a ejecutar. Pégalo completo en:
-- tu proyecto de Supabase → SQL Editor → New query → RUN.
-- =====================================================================

update public.socios set email = null where email = '';

-- =====================================================================
-- LISTO. No hace falta tocar nada más.
-- =====================================================================
