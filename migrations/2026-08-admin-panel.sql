-- ============================================================================
-- KanEXpress — релиз "Админ-панель" (salmas/seller-dashboard, август 2026)
-- ============================================================================
-- Это ФИКСАЦИЯ в git схемы, которая уже применена в боевой БД вручную/через
-- Supabase Studio. Файл описывает то, что реально стоит за новым
-- app/(admin)/*, app/admin/* и app/(seller)/returns — чтобы схема была
-- воспроизводима и ревьюабельна, а не только в голове у того, кто её накатил.
--
-- Весь скрипт написан идемпотентно (IF NOT EXISTS / DROP POLICY IF EXISTS +
-- CREATE POLICY / проверки по pg_constraint) — его безопасно запускать
-- повторно на уже актуальной БД, ничего не сломает и не задвоит.
--
-- Ничего из существующей схемы (таблицы, колонки, старые RLS-политики,
-- seller_id-фильтры) этот файл не удаляет и не переопределяет — только
-- добавляет новое поверх.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. zones.display_number — номер зоны для печати на накладных (app/(seller)/invoices)
--    и сортировки коробок на складе. Глобально уникален (не per-seller):
--    склад общий на всех продавцов, поэтому номера не должны пересекаться.
-- ----------------------------------------------------------------------------
alter table public.zones
  add column if not exists display_number integer;

create unique index if not exists zones_display_number_unique
  on public.zones (display_number)
  where display_number is not null;


-- ----------------------------------------------------------------------------
-- 2. courier_zones — один курьер на зону (админка "Зоны" переводит привязку
--    из старой many-to-many модели в 1:1: сначала delete по zone_id, потом
--    insert новой пары). Таблица и её базовые колонки уже существовали —
--    здесь только новый unique index, фиксирующий инвариант 1:1.
-- ----------------------------------------------------------------------------
create unique index if not exists courier_zones_zone_id_unique
  on public.courier_zones (zone_id);


-- ----------------------------------------------------------------------------
-- 3. access_status для sellers и couriers — модерация регистраций
--    (app/admin/access). pending -> approved -> banned (см. lib/access-status.ts).
--    Бэкофилл существующих строк в 'approved' — иначе все уже работающие
--    продавцы/курьеры разом потеряли бы доступ при добавлении default 'pending'.
-- ----------------------------------------------------------------------------
alter table public.sellers
  add column if not exists access_status text;

update public.sellers
  set access_status = 'approved'
  where access_status is null;

alter table public.sellers
  alter column access_status set default 'pending',
  alter column access_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sellers_access_status_check'
  ) then
    alter table public.sellers
      add constraint sellers_access_status_check
      check (access_status in ('pending', 'approved', 'banned'));
  end if;
end $$;

alter table public.couriers
  add column if not exists access_status text;

update public.couriers
  set access_status = 'approved'
  where access_status is null;

alter table public.couriers
  alter column access_status set default 'pending',
  alter column access_status set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'couriers_access_status_check'
  ) then
    alter table public.couriers
      add constraint couriers_access_status_check
      check (access_status in ('pending', 'approved', 'banned'));
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 4. return_requests — заявки на возврат (app/(seller)/returns создаёт их
--    из app/(seller)/dashboard, app/admin/returns их разбирает).
-- ----------------------------------------------------------------------------
create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  reason text not null,
  status text not null default 'new' check (status in ('new', 'in_progress', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists return_requests_seller_id_idx on public.return_requests (seller_id);
create index if not exists return_requests_order_id_idx on public.return_requests (order_id);
create index if not exists return_requests_status_idx on public.return_requests (status);

alter table public.return_requests enable row level security;

-- Продавец видит и создаёт только свои заявки (seller_id = auth.uid()) —
-- тот же паттерн, что и в lib/zones.ts / lib/kaspi.ts.
drop policy if exists seller_select_return_requests on public.return_requests;
create policy seller_select_return_requests
  on public.return_requests
  for select
  using (seller_id = auth.uid());

drop policy if exists seller_insert_return_requests on public.return_requests;
create policy seller_insert_return_requests
  on public.return_requests
  for insert
  with check (seller_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 5. is_admin() — проверка "текущий пользователь есть в таблице admins".
--    security definer + фиксированный search_path, чтобы политики на других
--    таблицах могли обращаться к admins без рекурсии и лишних прав на неё.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admins where id = auth.uid()
  );
$$;


-- ----------------------------------------------------------------------------
-- 6. admin_* RLS-политики — доступ ролям из admins поверх существующих
--    seller_id/courier-фильтров (permissive-политики в Postgres RLS
--    комбинируются через OR, так что старые политики продавцов/курьеров
--    не трогаются и продолжают работать как есть).
-- ----------------------------------------------------------------------------

-- admins: пользователь должен уметь прочитать свою собственную строку, чтобы
-- app/(admin)/layout.tsx и app/admin/layout.tsx могли пройти гейт логина.
drop policy if exists admins_self_select on public.admins;
create policy admins_self_select
  on public.admins
  for select
  using (id = auth.uid());

drop policy if exists admin_select_admins on public.admins;
create policy admin_select_admins
  on public.admins
  for select
  using (public.is_admin());

-- sellers: чтение всех продавцов (app/admin/sellers, app/admin/access,
-- app/admin/subscriptions, app/admin/zones) + обновление access_status
-- (app/admin/access) и seller_subscriptions через отдельную join-таблицу.
drop policy if exists admin_select_sellers on public.sellers;
create policy admin_select_sellers
  on public.sellers
  for select
  using (public.is_admin());

drop policy if exists admin_update_sellers on public.sellers;
create policy admin_update_sellers
  on public.sellers
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- couriers: чтение всех курьеров + модерация access_status (app/admin/access,
-- app/admin/couriers).
drop policy if exists admin_select_couriers on public.couriers;
create policy admin_select_couriers
  on public.couriers
  for select
  using (public.is_admin());

drop policy if exists admin_update_couriers on public.couriers;
create policy admin_update_couriers
  on public.couriers
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- orders: только чтение — вся статистика и карты в админке read-only
-- (app/admin/orders, app/admin/cancelled, app/admin/archive, app/admin/map,
-- app/admin/sellers/[id], app/admin/couriers/[id]).
drop policy if exists admin_select_orders on public.orders;
create policy admin_select_orders
  on public.orders
  for select
  using (public.is_admin());

-- zones: чтение всех зон всех продавцов + простановка display_number
-- (app/admin/zones).
drop policy if exists admin_select_zones on public.zones;
create policy admin_select_zones
  on public.zones
  for select
  using (public.is_admin());

drop policy if exists admin_update_zones on public.zones;
create policy admin_update_zones
  on public.zones
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- courier_zones: полное управление привязкой курьер <-> зона (app/admin/zones
-- снимает/ставит привязку через delete+insert).
drop policy if exists admin_select_courier_zones on public.courier_zones;
create policy admin_select_courier_zones
  on public.courier_zones
  for select
  using (public.is_admin());

drop policy if exists admin_insert_courier_zones on public.courier_zones;
create policy admin_insert_courier_zones
  on public.courier_zones
  for insert
  with check (public.is_admin());

drop policy if exists admin_delete_courier_zones on public.courier_zones;
create policy admin_delete_courier_zones
  on public.courier_zones
  for delete
  using (public.is_admin());

-- return_requests: чтение всех заявок + перевод статуса (app/admin/returns).
drop policy if exists admin_select_return_requests on public.return_requests;
create policy admin_select_return_requests
  on public.return_requests
  for select
  using (public.is_admin());

drop policy if exists admin_update_return_requests on public.return_requests;
create policy admin_update_return_requests
  on public.return_requests
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- seller_subscriptions: продление подписки продавцу (app/admin/subscriptions,
-- upsertExpiresAt — update с fallback на insert, если строки ещё нет).
drop policy if exists admin_select_seller_subscriptions on public.seller_subscriptions;
create policy admin_select_seller_subscriptions
  on public.seller_subscriptions
  for select
  using (public.is_admin());

drop policy if exists admin_update_seller_subscriptions on public.seller_subscriptions;
create policy admin_update_seller_subscriptions
  on public.seller_subscriptions
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_insert_seller_subscriptions on public.seller_subscriptions;
create policy admin_insert_seller_subscriptions
  on public.seller_subscriptions
  for insert
  with check (public.is_admin());
