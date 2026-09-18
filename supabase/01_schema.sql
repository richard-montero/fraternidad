-- =====================================================================
-- FRATERNIDAD — SCRIPT ÚNICO DE BASE DE DATOS
-- -----------------------------------------------------------------------
-- Copia TODO este archivo y pégalo en: tu proyecto de Supabase →
-- SQL Editor → New query → pega esto → RUN.
-- Se ejecuta una sola vez. Es seguro volver a ejecutarlo si algo falla,
-- porque usa "if not exists" / "or replace" en todas partes.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- TABLA: socios ----------
create table if not exists public.socios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  nombre text not null,
  celular text not null unique,
  email text unique,
  codigo text not null unique,
  estado text not null default 'activo' check (estado in ('activo','inactivo')),
  rol text not null default 'socio' check (rol in ('socio','admin','superadmin')),
  created_at timestamptz not null default now()
);

-- ---------- TABLA: configuración de cuota anual ----------
create table if not exists public.config_anual (
  anio int primary key,
  cuota numeric(12,2) not null
);

-- ---------- TABLA: obligación patrimonial acordada por socio ----------
create table if not exists public.obligaciones_patrimoniales (
  socio_id uuid primary key references public.socios(id) on delete cascade,
  monto numeric(12,2) not null default 0
);

-- ---------- TABLA: movimientos del mayor patrimonial ----------
create table if not exists public.movimientos_patrimoniales (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references public.socios(id) on delete cascade,
  fecha date not null,
  concepto text not null,
  debe numeric(12,2) not null default 0,
  haber numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- TABLA: movimientos del mayor de mensualidades ----------
create table if not exists public.movimientos_mensuales (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references public.socios(id) on delete cascade,
  fecha date not null,
  concepto text not null,
  debe numeric(12,2) not null default 0,
  haber numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- TABLA: registro de qué mensualidades ya se generaron ----------
create table if not exists public.obligaciones_mensuales_generadas (
  socio_id uuid not null references public.socios(id) on delete cascade,
  anio int not null,
  mes int not null check (mes between 1 and 12),
  primary key (socio_id, anio, mes)
);

-- ---------- TABLA: aportes voluntarios ----------
create table if not exists public.aportes_voluntarios (
  id uuid primary key default gen_random_uuid(),
  socio_id uuid not null references public.socios(id) on delete cascade,
  fecha date not null,
  monto numeric(12,2) not null,
  concepto text not null,
  observaciones text,
  created_at timestamptz not null default now()
);

-- ---------- TABLA: gastos ----------
create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  categoria text not null,
  concepto text not null,
  beneficiario text,
  monto numeric(12,2) not null,
  forma_pago text,
  comprobante_ruta text,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- FUNCIONES AUXILIARES DE SEGURIDAD
-- (determinan si quien está conectado es admin, según la tabla socios)
-- =====================================================================
create or replace function public.socio_actual_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.socios where auth_user_id = auth.uid();
$$;

create or replace function public.es_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.socios
    where auth_user_id = auth.uid() and estado = 'activo' and rol in ('admin','superadmin')
  );
$$;

create or replace function public.es_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.socios
    where auth_user_id = auth.uid() and estado = 'activo' and rol = 'superadmin'
  );
$$;

-- =====================================================================
-- SEGURIDAD A NIVEL DE FILA (RLS) — protege los datos aunque alguien
-- intente leer la base directamente con la llave pública.
-- =====================================================================
alter table public.socios enable row level security;
alter table public.config_anual enable row level security;
alter table public.obligaciones_patrimoniales enable row level security;
alter table public.movimientos_patrimoniales enable row level security;
alter table public.movimientos_mensuales enable row level security;
alter table public.obligaciones_mensuales_generadas enable row level security;
alter table public.aportes_voluntarios enable row level security;
alter table public.gastos enable row level security;

drop policy if exists "socios_select" on public.socios;
create policy "socios_select" on public.socios for select to authenticated using (true);
drop policy if exists "socios_insert" on public.socios;
create policy "socios_insert" on public.socios for insert to authenticated with check (public.es_admin());
drop policy if exists "socios_update" on public.socios;
create policy "socios_update" on public.socios for update to authenticated using (public.es_admin());

drop policy if exists "config_anual_select" on public.config_anual;
create policy "config_anual_select" on public.config_anual for select to authenticated using (true);
drop policy if exists "config_anual_write" on public.config_anual;
create policy "config_anual_write" on public.config_anual for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "oblig_patrimoniales_select" on public.obligaciones_patrimoniales;
create policy "oblig_patrimoniales_select" on public.obligaciones_patrimoniales for select to authenticated using (public.es_admin() or socio_id = public.socio_actual_id());
drop policy if exists "oblig_patrimoniales_write" on public.obligaciones_patrimoniales;
create policy "oblig_patrimoniales_write" on public.obligaciones_patrimoniales for all to authenticated using (public.es_admin()) with check (public.es_admin());

drop policy if exists "mov_patrimoniales_select" on public.movimientos_patrimoniales;
create policy "mov_patrimoniales_select" on public.movimientos_patrimoniales for select to authenticated using (public.es_admin() or socio_id = public.socio_actual_id());
drop policy if exists "mov_patrimoniales_write" on public.movimientos_patrimoniales;
create policy "mov_patrimoniales_write" on public.movimientos_patrimoniales for insert to authenticated with check (public.es_admin());

drop policy if exists "mov_mensuales_select" on public.movimientos_mensuales;
create policy "mov_mensuales_select" on public.movimientos_mensuales for select to authenticated using (public.es_admin() or socio_id = public.socio_actual_id());
drop policy if exists "mov_mensuales_write" on public.movimientos_mensuales;
create policy "mov_mensuales_write" on public.movimientos_mensuales for insert to authenticated with check (public.es_admin());

drop policy if exists "oblig_mensuales_gen_select" on public.obligaciones_mensuales_generadas;
create policy "oblig_mensuales_gen_select" on public.obligaciones_mensuales_generadas for select to authenticated using (public.es_admin() or socio_id = public.socio_actual_id());
drop policy if exists "oblig_mensuales_gen_write" on public.obligaciones_mensuales_generadas;
create policy "oblig_mensuales_gen_write" on public.obligaciones_mensuales_generadas for insert to authenticated with check (public.es_admin());

drop policy if exists "aportes_vol_select" on public.aportes_voluntarios;
create policy "aportes_vol_select" on public.aportes_voluntarios for select to authenticated using (public.es_admin() or socio_id = public.socio_actual_id());
drop policy if exists "aportes_vol_write" on public.aportes_voluntarios;
create policy "aportes_vol_write" on public.aportes_voluntarios for insert to authenticated with check (public.es_admin());

drop policy if exists "gastos_select" on public.gastos;
create policy "gastos_select" on public.gastos for select to authenticated using (public.es_admin());
drop policy if exists "gastos_write" on public.gastos;
create policy "gastos_write" on public.gastos for insert to authenticated with check (public.es_admin());

-- =====================================================================
-- LISTO. Ahora sigue con el paso 2: crea tu usuario administrador en
-- Authentication > Users, y luego ejecuta "02_crear_admin.sql".
-- =====================================================================
