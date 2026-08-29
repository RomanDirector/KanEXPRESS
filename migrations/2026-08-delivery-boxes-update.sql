-- ============================================================================
-- KanEXpress — недостающая admin UPDATE-политика на delivery_boxes
-- ============================================================================
-- 2026-08-seller-panel-simplification.sql переносил ящики под управление
-- админки и обещал "полный CRUD" (admin_select/insert/delete_delivery_boxes),
-- но политику UPDATE не добавил. В результате смена зоны у уже созданного
-- ящика (app/admin/boxes) не сохранялась: RLS молча отбрасывал обновляемые
-- строки. Добавляем недостающую policy — как и остальные, идемпотентно.
-- ============================================================================

drop policy if exists admin_update_delivery_boxes on public.delivery_boxes;
create policy admin_update_delivery_boxes
  on public.delivery_boxes
  for update
  using (public.is_admin())
  with check (public.is_admin());

