-- ============================================================================
-- KanEXpress — поведение внешних ключей при удалении зоны (app/admin/zones)
-- ============================================================================
-- Кнопка "Удалить зону" в списке (app/admin/zones/page.tsx) падала с
-- foreign key violation (23503) для любой зоны, у которой есть привязки —
-- а таких почти все реальные зоны (courier_zones — привязка курьера,
-- delivery_boxes — привязка ящика, orders.zone_id — история заказов).
--
-- Решение (согласовано с продуктом):
--  - courier_zones и delivery_boxes — это ТЕКУЩИЕ назначения без
--    исторической ценности, поэтому они автоматически подчищаются при
--    удалении зоны:
--      * courier_zones: CASCADE (сама строка привязки курьера теряет смысл
--        без зоны — удаляем вместе с зоной);
--      * delivery_boxes: SET NULL (физический ящик с QR-кодом должен
--        пережить удаление зоны, просто становится неприсвоенным).
--  - orders.zone_id — это ИСТОРИЯ реальных заказов, её нельзя терять молча.
--    FK НАМЕРЕННО остаётся RESTRICT (поведение по умолчанию, не трогаем):
--    зону с привязанными заказами по-прежнему нельзя удалить — это защита,
--    а не баг. Сообщение об этом в UI сделано понятным отдельно
--    (app/admin/zones/page.tsx: проверка количества заказов до удаления).
-- ============================================================================

alter table public.courier_zones
  drop constraint if exists courier_zones_zone_id_fkey,
  add constraint courier_zones_zone_id_fkey
    foreign key (zone_id) references public.zones(id) on delete cascade;

-- На случай, если zone_id объявлен NOT NULL — иначе ON DELETE SET NULL ниже
-- не сработает. Идемпотентно: если ограничения уже нет, ничего не делает.
alter table public.delivery_boxes
  alter column zone_id drop not null;

alter table public.delivery_boxes
  drop constraint if exists delivery_boxes_zone_id_fkey,
  add constraint delivery_boxes_zone_id_fkey
    foreign key (zone_id) references public.zones(id) on delete set null;
