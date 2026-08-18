-- ============================================================================
-- KanEXpress — общие зоны для всех продавцов (roman/landing-fixed, август 2026)
-- ============================================================================
-- До этой миграции одна строка zones = одна зона одного продавца, и админ на
-- /admin/zones рисовал/редактировал зону за явно выбранного продавца
-- (ZoneMapEditor с sellerId). Теперь админ рисует ОДНУ зону на карте без
-- выбора продавца — под капотом это по-прежнему одна строка zones на
-- продавца (schema не меняем, см. app/admin/zones + ZoneMapEditor), но все
-- строки одной "логической" зоны у разных продавцов должны:
--   1) иметь одинаковые coordinates/name/color,
--   2) обновляться/переименовываться все разом при правке на карте,
--   3) автоматически заводиться для новых продавцов при регистрации.
-- zone_group_id — это и есть связка "одна логическая зона -> N строк zones".
--
-- Идемпотентно (IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS),
-- ничего не удаляет из существующей схемы, кроме одного индекса из п.1
-- (сознательно, см. комментарий там).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. zones.zone_group_id — связывает несколько per-seller строк одной
--    визуальной зоны. default gen_random_uuid() при ALTER TABLE вычисляется
--    ОТДЕЛЬНО для каждой существующей строки (не константа) — то есть все
--    зоны, созданные до этой миграции, становятся "группой из одной строки"
--    сами по себе, ничего не склеивается задним числом.
--
--    display_number раньше был уникален ГЛОБАЛЬНО по всей таблице (один
--    физический склад на всех продавцов). Теперь у одной логической зоны
--    может быть N строк (по продавцу) с ОДНИМ и тем же номером — это
--    ожидаемо и не должно ломать инвариант "разные зоны -> разные номера".
--    Заменяем плоский unique index на триггер, который проверяет уникальность
--    номера в разрезе zone_group_id, а не в разрезе id строки.
-- ----------------------------------------------------------------------------
alter table public.zones
  add column if not exists zone_group_id uuid not null default gen_random_uuid();

create index if not exists idx_zones_zone_group_id on public.zones (zone_group_id);

drop index if exists public.zones_display_number_unique;

create or replace function public.check_zone_display_number_unique()
returns trigger
language plpgsql
as $$
begin
  if new.display_number is null then
    return new;
  end if;
  if exists (
    select 1 from public.zones
    where display_number = new.display_number
      and zone_group_id <> new.zone_group_id
      and id <> new.id
  ) then
    raise exception 'Этот номер уже занят другой зоной'
      using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_zone_display_number_unique on public.zones;
create trigger trg_check_zone_display_number_unique
  before insert or update of display_number, zone_group_id on public.zones
  for each row
  execute function public.check_zone_display_number_unique();


-- ----------------------------------------------------------------------------
-- 2. copy_zones_to_new_seller() — при регистрации нового продавца сразу
--    заводит ему все текущие логические зоны (по одной представительной
--    строке на zone_group_id: те же coordinates/name/color/display_number),
--    чтобы у него не было пусто на карте зон.
--    security definer, т.к. insert в zones вставляется от лица только что
--    зарегистрировавшегося продавца, а RLS на zones разрешает insert только
--    is_admin() (см. admin_insert_zones в 2026-08-seller-panel-simplification.sql) —
--    тот же паттерн, что и у is_admin() в 2026-08-admin-panel.sql.
-- ----------------------------------------------------------------------------
create or replace function public.copy_zones_to_new_seller()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.zones (seller_id, name, color, coordinates, display_number, zone_group_id)
  select distinct on (z.zone_group_id)
    new.id, z.name, z.color, z.coordinates, z.display_number, z.zone_group_id
  from public.zones z
  order by z.zone_group_id, z.created_at asc;
  return new;
end;
$$;

drop trigger if exists trg_copy_zones_to_new_seller on public.sellers;
create trigger trg_copy_zones_to_new_seller
  after insert on public.sellers
  for each row
  execute function public.copy_zones_to_new_seller();
