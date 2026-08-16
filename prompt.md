Задача: добавить оптимизацию маршрута курьера на странице app/(courier)/courier-map/page.tsx 
и поддержку нумерации остановок в components/MapGL.tsx.

1. В app/(courier)/courier-map/page.tsx:
   - Добавь получение живой геолокации курьера через navigator.geolocation.watchPosition 
     (useState<{lat,lng}|null> + useEffect с cleanup через clearWatch). Если геолокация 
     недоступна/не разрешена — используй координаты первого склада из warehouses как 
     точку старта маршрута.
   - Добавь функцию haversineKm(a, b) — расстояние по прямой между двумя точками 
     {lat,lng} в километрах (обычная формула гаверсинуса).
   - Добавь функцию nearestNeighborOrder(start, stops) — жадный алгоритм "ближайший 
     сосед": на каждом шаге ищет ближайшую из оставшихся точек к текущей позиции, 
     переходит туда, повторяет. Возвращает массив stops в порядке объезда.
   - Посчитай через useMemo по массиву orders (зависимость: orders, routeStart):
     * routable = заказы у которых lat и lng не null
     * unroutable = заказы без координат
     * sequence = nearestNeighborOrder(routeStart, routable), если routeStart есть, 
       иначе просто routable как есть
     * routeIndexById: Record<string, number> — номер остановки (1-based) для каждого 
       id из sequence
     * orderedOrders = [...sequence, ...unroutable]
     Верни { orderedOrders, routeIndexById } из useMemo.
   - Замени filteredOrders так, чтобы фильтровать orderedOrders вместо orders 
     (нумерация остановок должна оставаться стабильной независимо от фильтра по статусу).
   - В каждой карточке заказа в списке слева добавь маленький круглый бейдж с номером 
     остановки (routeIndexById[order.id]) перед номером заказа, если номер есть.
   - Прокинь в <MapGL> два новых пропа: routeOrder={routeIndexById} и 
     courierPosition={courierPos}.
   - Над списком (если !courierPos) добавь заметную плашку: "Геолокация недоступна — 
     маршрут строится от склада, разрешите доступ к геолокации для точного порядка объезда".

2. В components/MapGL.tsx:
   - Добавь в MapGLProps: routeOrder?: Record<string, number> и 
     courierPosition?: { lat: number; lng: number } | null.
   - Импортируй Polyline и CircleMarker из react-leaflet.
   - В buildMarkerIcon(color, selected, number?) добавь третий необязательный параметр 
     number — если передан, рисуй его текстом поверх белого кружка в центре пина 
     (вместо пустого белого кружка).
   - Посчитай routeLinePositions через useMemo: отфильтруй validPoints у которых есть 
     routeOrder[id], отсортируй по этому номеру, преврати в массив [lat,lng] пар.
   - Отрендери <Polyline> с этими позициями (если length > 1) — пунктирная синяя линия 
     (dashArray, weight 3, opacity 0.6).
   - В рендере маркеров передавай routeOrder?.[point.id] третьим аргументом в 
     buildMarkerIcon, и добавь номер остановки первой строкой в Popup, если есть.
   - Отрендери <CircleMarker> для courierPosition (если не null) — синий кружок с белой 
     обводкой, radius 8, с Popup "Вы здесь".

Проверь, что "Problems" панель в VS Code очищается после правок (сейчас там 21 ошибка — 
возможно от незакрытого предыдущего редактирования, посмотри что именно ругается перед 
тем как считать задачу выполненной).