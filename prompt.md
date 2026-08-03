1. В app/(courier)/courier-map/page.tsx, в fetchZonesAndWarehouses(), 
   добавь organization_name в select и в маппинг:

   .select('id, organization_name, warehouse_address, warehouse_lat, warehouse_lng')
   ...
   .map((s: any) => ({ id: s.id, lat: s.warehouse_lat, lng: s.warehouse_lng, 
     address: s.warehouse_address, name: s.organization_name }))

2. В components/MapGL.tsx добавь поле в WarehousePoint:
   export interface WarehousePoint {
     id: string
     lat: number
     lng: number
     address: string | null
     name: string | null
   }

3. В попапе warehouse-маркера замени заголовок "Склад" на название магазина:
   <p className="font-bold">{warehouse.name || 'Склад'}</p>
   (адрес и ссылку на 2ГИС оставь как есть, только заголовок меняется)