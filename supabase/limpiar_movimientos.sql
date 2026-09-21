-- =====================================================================
-- FRATERNIDAD — BORRAR TODOS LOS MOVIMIENTOS FINANCIEROS
-- -----------------------------------------------------------------------
-- Deja intactos: socios (con su estado, rol, turno, fecha de nacimiento,
-- acceso), configuración anual (cuotas) y el nombre de la fraternidad.
--
-- Borra: todo el historial de ingresos (patrimoniales, mensuales,
-- voluntarios, institucionales), obligaciones generadas, y todos los
-- gastos.
--
-- ⚠️  ESTO NO SE PUEDE DESHACER. Si no tienes un respaldo y quieres uno
-- antes de continuar, dime y te vuelvo a pasar el comando de pg_dump.
--
-- Pégalo completo en: tu proyecto de Supabase → SQL Editor → New query
-- → RUN.
-- =====================================================================

truncate table
  public.movimientos_patrimoniales,
  public.movimientos_mensuales,
  public.obligaciones_mensuales_generadas,
  public.obligaciones_patrimoniales,
  public.aportes_voluntarios,
  public.ingresos_externos,
  public.gastos;

-- =====================================================================
-- LISTO. Ya puedes volver a subir tu Excel completo (Socios, Aportes,
-- Ingresos institucionales, Gastos) desde Configuración anual →
-- Importar datos desde Excel.
--
-- Nota: si algún gasto borrado tenía un comprobante adjunto (PDF/foto),
-- ese archivo queda huérfano en Storage (bucket "comprobantes-gastos")
-- — no se borra solo, pero tampoco molesta ni se puede ver desde la
-- app. Si quieres, puedes borrar manualmente el contenido de ese bucket
-- desde Supabase → Storage.
-- =====================================================================
