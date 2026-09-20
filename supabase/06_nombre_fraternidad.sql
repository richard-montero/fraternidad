-- =====================================================================
-- FRATERNIDAD — NOMBRE EDITABLE (paso 6)
-- -----------------------------------------------------------------------
-- Agrega una tabla de ajustes generales (clave/valor) para que el título
-- "Fraternidad" que se ve en el menú y en la pantalla de ingreso pueda
-- cambiarse a cualquier texto, solo por el súper administrador.
--
-- La lectura es pública (incluso sin haber iniciado sesión) porque la
-- pantalla de ingreso necesita mostrar el nombre ANTES de que la persona
-- entre — no expone nada sensible, solo el nombre visible de la
-- fraternidad. Escribir sigue restringido al súper administrador.
--
-- Seguro de volver a ejecutar. Pégalo completo en:
-- tu proyecto de Supabase → SQL Editor → New query → RUN.
-- =====================================================================

create table if not exists public.ajustes_generales (
  clave text primary key,
  valor text not null,
  actualizado_en timestamptz not null default now()
);

alter table public.ajustes_generales enable row level security;

drop policy if exists "ajustes_generales_select" on public.ajustes_generales;
create policy "ajustes_generales_select" on public.ajustes_generales
  for select to anon, authenticated using (true);

drop policy if exists "ajustes_generales_upsert" on public.ajustes_generales;
create policy "ajustes_generales_upsert" on public.ajustes_generales
  for insert to authenticated with check (public.es_superadmin());

drop policy if exists "ajustes_generales_update" on public.ajustes_generales;
create policy "ajustes_generales_update" on public.ajustes_generales
  for update to authenticated using (public.es_superadmin()) with check (public.es_superadmin());

insert into public.ajustes_generales (clave, valor)
values ('nombre_fraternidad', 'Fraternidad')
on conflict (clave) do nothing;

-- =====================================================================
-- LISTO. No hace falta tocar nada más.
-- =====================================================================
