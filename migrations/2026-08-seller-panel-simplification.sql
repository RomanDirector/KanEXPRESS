-- ============================================================================
-- KanEXpress — упрощение панели продавца под структуру Dream Delivery
-- (roman/landing-fixed, август 2026)
-- ============================================================================
-- Продавцу закрыт доступ к Зонам, Ящикам, Персоналу и Сканеру — эта
-- функциональность теперь целиком живёт в админке (app/admin/zones,
-- app/admin/boxes, app/admin/couriers). Миграция 2026-08-admin-panel.sql уже
-- дала admin_* select/update на zones и courier_zones; здесь — недостающие
-- insert/delete на zones, полный CRUD на delivery_boxes для админки,
-- delete на couriers и точечный update на orders (нужен только для
-- "Определить районы заказов" — простановка zone_id/courier_name/courier_stage
-- при разбросе заказов по зонам, раньше это делал сам продавец на своей
-- странице /delivery-zones).
--
-- Как и в 2026-08-admin-panel.sql, весь скрипт идемпотентен
-- (DROP POLICY IF EXISTS + CREATE POLICY) и ничего не удаляет из
-- существующей схемы — только добавляет новое поверх.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. zones: недостающие insert/delete для админки — раньше зоны рисовал и
--    удалял сам продавец на /delivery-zones (seller_id = auth.uid()), теперь
--    это делает админ за выбранного продавца (app/admin/zones + ZoneMapEditor
--    с явным sellerId).
-- ----------------------------------------------------------------------------
drop policy if exists admin_insert_zones on public.zones;
create policy admin_insert_zones
  on public.zones
  for insert
  with check (public.is_admin());

drop policy if exists admin_delete_zones on public.zones;
create policy admin_delete_zones
  on public.zones
  for delete
  using (public.is_admin());


-- ----------------------------------------------------------------------------
-- 2. delivery_boxes: полный доступ для админки (app/admin/boxes) — раньше
--    ящики продавец создавал/удалял сам на /boxes (seller_id = auth.uid()).
-- ----------------------------------------------------------------------------
drop policy if exists admin_select_delivery_boxes on public.delivery_boxes;
create policy admin_select_delivery_boxes
  on public.delivery_boxes
  for select
  using (public.is_admin());

drop policy if exists admin_insert_delivery_boxes on public.delivery_boxes;
create policy admin_insert_delivery_boxes
  on public.delivery_boxes
  for insert
  with check (public.is_admin());

drop policy if exists admin_delete_delivery_boxes on public.delivery_boxes;
create policy admin_delete_delivery_boxes
  on public.delivery_boxes
  for delete
  using (public.is_admin());


-- ----------------------------------------------------------------------------
-- 3. couriers: удаление курьера из админки (app/admin/couriers) — раньше
--    было доступно продавцу на /staff.
-- ----------------------------------------------------------------------------
drop policy if exists admin_delete_couriers on public.couriers;
create policy admin_delete_couriers
  on public.couriers
  for delete
  using (public.is_admin());


-- ----------------------------------------------------------------------------
-- 4. orders: точечный update для админки — раньше admin_select_orders был
--    read-only по дизайну (см. 2026-08-admin-panel.sql, п.6). Теперь
--    "Определить районы заказов" в app/admin/zones (lib/zones.ts
--    assignZonesToOrders) должен проставлять zone_id/courier_name/
--    courier_stage за выбранного продавца — той же операции, что раньше
--    выполнял сам продавец на /delivery-zones.
-- ----------------------------------------------------------------------------
drop policy if exists admin_update_orders on public.orders;
create policy admin_update_orders
  on public.orders
  for update
  using (public.is_admin())
  with check (public.is_admin());
