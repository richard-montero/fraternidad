-- =====================================================================
-- FRATERNIDAD — PERMISOS DE STORAGE PARA EL BUCKET "qr-pagos"
-- -----------------------------------------------------------------------
-- El bucket "qr-pagos" necesita sus propias reglas de seguridad (RLS)
-- en storage.objects para poder subir y leer las imágenes — no basta
-- con crearlo como privado desde la pantalla de Storage.
--
-- Seguro de volver a ejecutar. Pégalo completo en:
-- tu proyecto de Supabase → SQL Editor → New query → RUN.
-- =====================================================================

drop policy if exists "qr_pagos_select" on storage.objects;
create policy "qr_pagos_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'qr-pagos');

drop policy if exists "qr_pagos_insert" on storage.objects;
create policy "qr_pagos_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'qr-pagos' and public.es_admin());

drop policy if exists "qr_pagos_update" on storage.objects;
create policy "qr_pagos_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'qr-pagos' and public.es_admin())
  with check (bucket_id = 'qr-pagos' and public.es_admin());

-- =====================================================================
-- LISTO.
-- =====================================================================
