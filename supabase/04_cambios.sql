-- =====================================================================
-- FRATERNIDAD — CAMBIOS SOLICITADOS (paso 4)
-- -----------------------------------------------------------------------
-- Implementa, a nivel de base de datos:
--   1) Fecha de nacimiento del socio.
--   1b) Nuevos estados de socio: Patrimonial, Invitado, De baja
--       (reemplazan a Activo/Inactivo) — solo el súper administrador
--       puede cambiar el estado o el rol de un socio (se aplica con un
--       trigger, no solo confiando en la interfaz).
--   1c) A los socios "de baja" ya no se les generan mensualidades
--       nuevas (se aplica en la función generarMensualidades del código).
--   2) Nuevo rol: Supervisor (ve todo, genera reportes, no puede
--      crear ni modificar nada).
--   3) Ingresos que no provienen de socios: Alquiler/uso de
--      instalaciones, Donaciones, Otros.
--
-- Seguro de volver a ejecutar: usa "if not exists" / "or replace" /
-- "drop ... if exists" en todas partes. Pégalo completo en:
-- tu proyecto de Supabase → SQL Editor → New query → RUN.
-- Requiere haber ejecutado antes 01_schema.sql, 02_crear_admin.sql y
-- 03_mejoras.sql.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Socios: fecha de nacimiento + nuevos estados + nuevo rol
-- ---------------------------------------------------------------------
alter table public.socios add column if not exists fecha_nacimiento date;

-- IMPORTANTE: primero se quitan las reglas viejas (que solo permitian
-- 'activo'/'inactivo'), y recien despues se traducen los valores -- si se
-- hace al reves, la propia traduccion choca contra la regla vieja.
alter table public.socios drop constraint if exists socios_estado_check;
alter table public.socios drop constraint if exists socios_rol_check;

-- Traducir los valores actuales: todo socio "activo" pasa a "patrimonial"
-- (miembro de pleno derecho), todo socio "inactivo" pasa a "de_baja".
update public.socios set estado = 'patrimonial' where estado = 'activo';
update public.socios set estado = 'de_baja' where estado = 'inactivo';

alter table public.socios add constraint socios_estado_check
  check (estado in ('patrimonial','invitado','de_baja'));
alter table public.socios alter column estado set default 'patrimonial';

alter table public.socios add constraint socios_rol_check
  check (rol in ('socio','supervisor','admin','superadmin'));

-- Solo el super administrador puede cambiar el estado o el rol de un
-- socio DESDE LA APLICACION (se aplica con un disparador, no solo
-- escondiendo el boton en la interfaz). Las ejecuciones directas desde
-- el SQL Editor (como 02_crear_admin.sql) no tienen un usuario de la
-- app conectado (auth.uid() es nulo), asi que no se ven afectadas por
-- esta regla -- quien tiene acceso al SQL Editor ya tiene acceso total a
-- la base de datos de todos modos.
create or replace function public.socios_restringir_cambios_sensibles()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and (new.estado is distinct from old.estado or new.rol is distinct from old.rol)
     and not public.es_superadmin() then
    raise exception 'Solo un super administrador puede cambiar el estado o el rol de un socio.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_socios_restringir_cambios on public.socios;
create trigger trg_socios_restringir_cambios
  before update on public.socios
  for each row execute function public.socios_restringir_cambios_sensibles();

-- ---------------------------------------------------------------------
-- 2) Funciones de acceso: los socios "de baja" no pueden ingresar;
--    se agrega la función es_supervisor() y una función de solo-lectura
--    que incluye también a admin/superadmin.
-- ---------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.socios
    where auth_user_id = auth.uid() and estado <> 'de_baja' and rol in ('admin','superadmin')
  );
$$;

create or replace function public.es_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.socios
    where auth_user_id = auth.uid() and estado <> 'de_baja' and rol = 'superadmin'
  );
$$;

create or replace function public.es_supervisor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.socios
    where auth_user_id = auth.uid() and estado <> 'de_baja' and rol = 'supervisor'
  );
$$;

-- "Puede ver": administradores, súper administradores y supervisores.
-- Se usa en las políticas de SOLO LECTURA. Las políticas de escritura
-- siguen usando únicamente es_admin(), así que un supervisor jamás
-- podrá insertar, editar ni borrar nada — solo consultar.
create or replace function public.puede_ver()
returns boolean language sql stable security definer set search_path = public as $$
  select public.es_admin() or public.es_supervisor();
$$;

-- ---------------------------------------------------------------------
-- 3) Ingresos que no provienen de socios
-- ---------------------------------------------------------------------
create table if not exists public.ingresos_externos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  tipo text not null check (tipo in ('alquiler','donacion','otro')),
  concepto text not null,
  origen text,
  monto numeric(12,2) not null,
  observaciones text,
  created_at timestamptz not null default now()
);

alter table public.ingresos_externos enable row level security;

drop policy if exists "ingresos_externos_select" on public.ingresos_externos;
create policy "ingresos_externos_select" on public.ingresos_externos
  for select to authenticated using (public.puede_ver());

drop policy if exists "ingresos_externos_insert" on public.ingresos_externos;
create policy "ingresos_externos_insert" on public.ingresos_externos
  for insert to authenticated with check (public.es_admin());

drop policy if exists "ingresos_externos_update" on public.ingresos_externos;
create policy "ingresos_externos_update" on public.ingresos_externos
  for update to authenticated using (public.es_superadmin()) with check (public.es_superadmin());

drop policy if exists "ingresos_externos_delete" on public.ingresos_externos;
create policy "ingresos_externos_delete" on public.ingresos_externos
  for delete to authenticated using (public.es_superadmin());

create index if not exists idx_ingresos_externos_fecha on public.ingresos_externos(fecha);

-- ---------------------------------------------------------------------
-- 4) Abrir la lectura a los supervisores en el resto de tablas
--    (las políticas de escritura NO cambian: siguen siendo solo admin).
-- ---------------------------------------------------------------------
drop policy if exists "oblig_patrimoniales_select" on public.obligaciones_patrimoniales;
create policy "oblig_patrimoniales_select" on public.obligaciones_patrimoniales
  for select to authenticated using (public.puede_ver() or socio_id = public.socio_actual_id());

drop policy if exists "mov_patrimoniales_select" on public.movimientos_patrimoniales;
create policy "mov_patrimoniales_select" on public.movimientos_patrimoniales
  for select to authenticated using (public.puede_ver() or socio_id = public.socio_actual_id());

drop policy if exists "mov_mensuales_select" on public.movimientos_mensuales;
create policy "mov_mensuales_select" on public.movimientos_mensuales
  for select to authenticated using (public.puede_ver() or socio_id = public.socio_actual_id());

drop policy if exists "oblig_mensuales_gen_select" on public.obligaciones_mensuales_generadas;
create policy "oblig_mensuales_gen_select" on public.obligaciones_mensuales_generadas
  for select to authenticated using (public.puede_ver() or socio_id = public.socio_actual_id());

drop policy if exists "aportes_vol_select" on public.aportes_voluntarios;
create policy "aportes_vol_select" on public.aportes_voluntarios
  for select to authenticated using (public.puede_ver() or socio_id = public.socio_actual_id());

drop policy if exists "gastos_select" on public.gastos;
create policy "gastos_select" on public.gastos for select to authenticated using (public.puede_ver());

-- =====================================================================
-- LISTO. No hace falta tocar nada más a mano: el resto de la base de
-- datos (01_schema.sql, 02_crear_admin.sql, 03_mejoras.sql) sigue
-- funcionando igual.
-- =====================================================================
