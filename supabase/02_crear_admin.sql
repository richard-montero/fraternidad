-- =====================================================================
-- PASO 2 — VINCULAR TU USUARIO ADMINISTRADOR
-- -----------------------------------------------------------------------
-- Antes de ejecutar esto:
--   1. Ve a tu proyecto de Supabase → Authentication → Users → Add user.
--   2. Crea el usuario con el correo y la contraseña que tú definas.
--      Marca la opción "Auto Confirm User" si aparece (para que no
--      necesite confirmar el correo).
--   3. Copia ese mismo correo y reemplázalo en la línea marcada abajo
--      (dentro de las comillas, en los DOS lugares donde aparece).
--   4. Pega este script completo en el SQL Editor y presiona RUN.
-- =====================================================================

insert into public.socios (auth_user_id, nombre, celular, email, codigo, rol)
select
  id,
  'Administrador',
  '00000000',
  'REEMPLAZA-CON-TU-CORREO@ejemplo.com',   -- 👈 cambia este correo
  'S-ADMIN001',
  'superadmin'
from auth.users
where email = 'REEMPLAZA-CON-TU-CORREO@ejemplo.com'   -- 👈 y este también, igual al de arriba
on conflict (auth_user_id) do update set rol = 'superadmin';

-- Si todo salió bien, esta consulta debe mostrar una fila con rol "superadmin":
select nombre, email, rol, estado from public.socios where rol = 'superadmin';
