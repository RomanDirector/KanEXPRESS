-- ============================================================================
-- KanEXpress — ON DELETE CASCADE для courier_sellers.courier_id
-- ============================================================================
-- courier_sellers — рудимент более старой схемы связи курьер<->продавец
-- (заменена на courier_zones -> zones.seller_id, см. lib/couriers.ts, где
-- прямо написано "courier_sellers в проекте не существует" — на деле таблица
-- осталась в БД). Ни один код в репозитории её не читает и не пишет: 7 строк,
-- все с одним created_at (единоразовая вставка 2026-07-31) на одного и того
-- же тестового продавца. FK без ON DELETE CASCADE блокировал удаление
-- курьера из app/admin/couriers, если у него оставалась строка в этой мёртвой
-- таблице ("update or delete on table couriers violates foreign key
-- constraint courier_sellers_courier_id_fkey").
-- ============================================================================

alter table public.courier_sellers
  drop constraint if exists courier_sellers_courier_id_fkey,
  add constraint courier_sellers_courier_id_fkey
    foreign key (courier_id) references public.couriers(id) on delete cascade;
