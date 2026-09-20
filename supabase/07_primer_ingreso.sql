-- =====================================================================
-- FRATERNIDAD — CREDENCIALES TEMPORALES Y PRIMER INGRESO (paso 7)
-- -----------------------------------------------------------------------
-- Permite crear un socio sin conocer su correo real: se genera un
-- correo temporal a partir de su celular (real o un número correlativo
-- inventado, ej. 70000001) y, en su primer ingreso, el propio socio
-- define su correo real y su nueva contraseña.
--
-- Seguro de volver a ejecutar. Pégalo completo en:
-- tu proyecto de Supabase → SQL Editor → New query → RUN.
-- =====================================================================

alter table public.socios add column if not exists requiere_configuracion_inicial boolean not null default false;

-- Un socio puede actualizar SU PROPIA fila (para guardar su correo real
-- al terminar la configuración inicial). El trigger de abajo se encarga
-- de que, si quien edita no es admin, solo pueda tocar el correo y esta
-- misma bandera — todo lo demás (nombre, celular, rol, estado, etc.)
-- sigue protegido igual que antes.
drop policy if exists "socios_update_propio" on public.socios;
create policy "socios_update_propio" on public.socios for update to authenticated
  using (id = public.socio_actual_id())
  with check (id = public.socio_actual_id());

create or replace function public.socios_restringir_cambios_sensibles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Estado y rol: solo el súper administrador, desde la aplicación.
  if auth.uid() is not null
     and (new.estado is distinct from old.estado or new.rol is distinct from old.rol)
     and not public.es_superadmin() then
    raise exception 'Solo un súper administrador puede cambiar el estado o el rol de un socio.';
  end if;

  -- Si quien edita es el propio socio (no un administrador), solo puede
  -- tocar su correo y la bandera de configuración inicial — el resto de
  -- sus datos permanece protegido.
  if auth.uid() is not null and not public.es_admin() then
    if new.nombre is distinct from old.nombre
       or new.celular is distinct from old.celular
       or new.codigo is distinct from old.codigo
       or new.turno is distinct from old.turno
       or new.fecha_nacimiento is distinct from old.fecha_nacimiento
       or new.auth_user_id is distinct from old.auth_user_id
       or new.rol is distinct from old.rol
       or new.estado is distinct from old.estado then
      raise exception 'Solo puedes actualizar tu correo desde aquí.';
    end if;
  end if;

  return new;
end;
$$;

-- =====================================================================
-- LISTO. Además de correr este script, entra a tu proyecto de Supabase →
-- Authentication → Providers → Email y DESACTIVA "Secure email change"
-- (junto con "Confirm email", que ya desactivaste antes) — si no, el
-- cambio de correo pediría confirmar también el correo temporal
-- (inventado), que nunca podría confirmarse porque no existe de verdad.
-- =====================================================================
