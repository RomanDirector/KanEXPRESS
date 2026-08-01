В app/api/kaspi/request-delivery-code/route.ts и app/api/kaspi/confirm-delivery-code/route.ts
добавь проверку сессии, используя тот же паттерн, что уже применён в app/api/kaspi/price 
(или другом уже пофикшенном роуте с сессией) — НЕ createAdminClient() для проверки, 
а серверный клиент, который читает auth-cookie текущего запроса.

Логика для обоих роутов:

1. Получи текущего пользователя через серверный supabase-клиент (getUser()).
   Если пользователя нет — верни 401 { error: 'Не авторизован' }.

2. Проверь, что это курьер: найди строку в couriers, где id = user.id.
   Если не найдена — верни 403 { error: 'Доступ запрещён' }.

3. Только ПОСЛЕ этого используй createAdminClient(), чтобы прочитать заказ по orderId
   (нужен admin-доступ, т.к. дальше идёт кросс-табличный джойн с sellers.kaspi_token).

4. Сверь принадлежность заказа: order.courier_name (после trim/lowercase) должен совпадать
   с courier.full_name (тоже после trim/lowercase) из шага 2.
   Если не совпадает — верни 403 { error: 'Этот заказ не назначен вам' }, 
   НИКАКИХ запросов к Kaspi API в этом случае не делать.

5. Дальше — существующая логика (поиск kaspi_order_id, seller.kaspi_token, вызов
   requestDeliveryCode/confirmDeliveryCode).

Примени идентично к обоим файлам, различается только вызов (requestDeliveryCode 
vs confirmDeliveryCode).