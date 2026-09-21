-- =====================================================================
-- FRATERNIDAD — IMPORTACIÓN DE OBLIGACIONES MENSUALES MÁS ROBUSTA
-- -----------------------------------------------------------------------
-- Reemplaza la forma en que la importación de Excel carga las
-- obligaciones mensuales (Debe) por una función en la base de datos que
-- inserta la obligación y su movimiento correspondiente EN UNA SOLA
-- OPERACIÓN ATÓMICA, con el control de duplicados resuelto por la propia
-- base de datos (ON CONFLICT) en vez de una consulta previa desde el
-- navegador — más rápido, y no puede quedar a medias.
--
-- Seguro de volver a ejecutar. Pégalo completo en:
-- tu proyecto de Supabase → SQL Editor → New query → RUN.
-- =====================================================================

create or replace function public.importar_obligaciones_mensuales(payload jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  insertados int;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede importar datos.';
  end if;

  with datos as (
    select
      (elem->>'socio_id')::uuid as socio_id,
      (elem->>'anio')::int as anio,
      (elem->>'mes')::int as mes,
      (elem->>'monto')::numeric as monto,
      (elem->>'concepto')::text as concepto,
      (elem->>'fecha')::date as fecha
    from jsonb_array_elements(payload) as elem
  ),
  insertadas_obl as (
    insert into public.obligaciones_mensuales_generadas (socio_id, anio, mes)
    select socio_id, anio, mes from datos
    on conflict (socio_id, anio, mes) do nothing
    returning socio_id, anio, mes
  ),
  insertados_mov as (
    insert into public.movimientos_mensuales (socio_id, fecha, concepto, debe, haber)
    select d.socio_id, d.fecha, d.concepto, d.monto, 0
    from datos d
    join insertadas_obl io using (socio_id, anio, mes)
    returning 1
  )
  select count(*) into insertados from insertados_mov;

  return insertados;
end;
$$;

grant execute on function public.importar_obligaciones_mensuales(jsonb) to authenticated;

-- =====================================================================
-- LISTO. No hace falta tocar nada más.
-- =====================================================================
