import { Package, Truck, CheckCircle, RotateCcw, MapPin } from 'lucide-react'

export type CourierStage = 'not_started' | 'departed' | 'arrived' | 'delivered' | 'returned'

export interface Order {
  id: string
  order_number: string
  client_phone: string
  client_address: string
  courier_stage: CourierStage
  courier_fee: number
  courier_name: string
  seller_id: string
  zone: string
  status: string
  created_at: string
  lat: number
  lng: number
}

export const SELLER_NAMES: Record<string, string> = {
  'seller-1': 'Магазин "Электроника Плюс"',
  'seller-2': 'Магазин "ЭкоТовары"',
}

export const STAGE_CONFIG: Record<
  CourierStage,
  { label: string; icon: typeof Package; className: string }
> = {
  not_started: { label: 'Не начато', icon: Package, className: 'border-gray-200 bg-gray-50 text-gray-600' },
  departed:    { label: 'Выехал',    icon: Truck,    className: 'border-blue-200 bg-blue-50 text-blue-700' },
  arrived:     { label: 'На месте',  icon: MapPin,   className: 'border-amber-200 bg-amber-50 text-amber-700' },
  delivered:   { label: 'Доставлено', icon: CheckCircle, className: 'border-green-200 bg-green-50 text-green-700' },
  returned:    { label: 'Возврат',   icon: RotateCcw, className: 'border-red-200 bg-red-50 text-red-700' },
}

// Цвета маркеров на карте — тот же смысл, что и STAGE_CONFIG, но в hex для CircleMarker
export const STAGE_MARKER_COLORS: Record<CourierStage, string> = {
  not_started: '#9ca3af',
  departed: '#3b82f6',
  arrived: '#f59e0b',
  delivered: '#22c55e',
  returned: '#ef4444',
}

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()

const TODAY = daysAgo(0)
const YESTERDAY = daysAgo(1)

export const MOCK_ORDERS: Order[] = [
  {
    id: '1',
    order_number: 'ORD-1042',
    client_phone: '+7 (701) 234-56-78',
    client_address: 'Алматы, ул. Абая 10',
    courier_stage: 'not_started',
    courier_fee: 1200,
    courier_name: 'Тестовый Курьер',
    seller_id: 'seller-1',
    zone: 'Алматы',
    status: 'in_transit',
    created_at: TODAY,
    lat: 43.238383,
    lng: 76.945465,
  },
  {
    id: '2',
    order_number: 'ORD-1043',
    client_phone: '+7 (702) 345-67-89',
    client_address: 'Астана, пр. Туран 25',
    courier_stage: 'departed',
    courier_fee: 1500,
    courier_name: 'Тестовый Курьер',
    seller_id: 'seller-1',
    zone: 'Астана',
    status: 'in_transit',
    created_at: TODAY,
    lat: 51.169392,
    lng: 71.449074,
  },
  {
    id: '3',
    order_number: 'ORD-1044',
    client_phone: '+7 (703) 456-78-90',
    client_address: 'Алматы, ул. Достык 5',
    courier_stage: 'arrived',
    courier_fee: 900,
    courier_name: 'Тестовый Курьер',
    seller_id: 'seller-2',
    zone: 'Алматы',
    status: 'in_transit',
    created_at: YESTERDAY,
    lat: 43.235000,
    lng: 76.955000,
  },
  {
    id: '4',
    order_number: 'ORD-1045',
    client_phone: '+7 (704) 567-89-01',
    client_address: 'Шымкент, ул. Байтурсынова 3',
    courier_stage: 'delivered',
    courier_fee: 1800,
    courier_name: 'Тестовый Курьер',
    seller_id: 'seller-2',
    zone: 'Шымкент',
    status: 'delivered',
    created_at: TODAY,
    lat: 42.317058,
    lng: 69.586935,
  },
  {
    id: '5',
    order_number: 'ORD-1046',
    client_phone: '+7 (705) 678-90-12',
    client_address: 'Алматы, ул. Сатпаева 22',
    courier_stage: 'delivered',
    courier_fee: 1100,
    courier_name: 'Тестовый Курьер',
    seller_id: 'seller-1',
    zone: 'Алматы',
    status: 'delivered',
    created_at: YESTERDAY,
    lat: 43.225000,
    lng: 76.910000,
  },
  {
    id: '6',
    order_number: 'ORD-1047',
    client_phone: '+7 (706) 789-01-23',
    client_address: 'Астана, ул. Кенесары 15',
    courier_stage: 'returned',
    courier_fee: 1300,
    courier_name: 'Тестовый Курьер',
    seller_id: 'seller-2',
    zone: 'Астана',
    status: 'returned',
    created_at: TODAY,
    lat: 51.180000,
    lng: 71.430000,
  },
  // Более старые заказы — нужны только для проверки переключателя периода на /courier-stats
  {
    id: '7',
    order_number: 'ORD-1038',
    client_phone: '+7 (707) 111-22-33',
    client_address: 'Алматы, ул. Жандосова 58',
    courier_stage: 'delivered',
    courier_fee: 1400,
    courier_name: 'Тестовый Курьер',
    seller_id: 'seller-1',
    zone: 'Алматы',
    status: 'delivered',
    created_at: daysAgo(3),
    lat: 43.222000,
    lng: 76.890000,
  },
  {
    id: '8',
    order_number: 'ORD-1035',
    client_phone: '+7 (708) 222-33-44',
    client_address: 'Астана, ул. Кабанбай батыра 12',
    courier_stage: 'returned',
    courier_fee: 1000,
    courier_name: 'Тестовый Курьер',
    seller_id: 'seller-2',
    zone: 'Астана',
    status: 'returned',
    created_at: daysAgo(5),
    lat: 51.128207,
    lng: 71.430411,
  },
  {
    id: '9',
    order_number: 'ORD-0987',
    client_phone: '+7 (709) 333-44-55',
    client_address: 'Алматы, ул. Розыбакиева 40',
    courier_stage: 'delivered',
    courier_fee: 1600,
    courier_name: 'Тестовый Курьер',
    seller_id: 'seller-1',
    zone: 'Алматы',
    status: 'delivered',
    created_at: daysAgo(20),
    lat: 43.229000,
    lng: 76.900000,
  },
  {
    id: '10',
    order_number: 'ORD-0951',
    client_phone: '+7 (710) 444-55-66',
    client_address: 'Шымкент, ул. Кунаева 8',
    courier_stage: 'returned',
    courier_fee: 1250,
    courier_name: 'Тестовый Курьер',
    seller_id: 'seller-2',
    zone: 'Шымкент',
    status: 'returned',
    created_at: daysAgo(25),
    lat: 42.320000,
    lng: 69.590000,
  },
  {
    id: '11',
    order_number: 'ORD-0812',
    client_phone: '+7 (711) 555-66-77',
    client_address: 'Астана, ул. Сарыарка 30',
    courier_stage: 'delivered',
    courier_fee: 2000,
    courier_name: 'Тестовый Курьер',
    seller_id: 'seller-1',
    zone: 'Астана',
    status: 'delivered',
    created_at: daysAgo(60),
    lat: 51.150000,
    lng: 71.420000,
  },
  {
    id: '12',
    order_number: 'ORD-0745',
    client_phone: '+7 (712) 666-77-88',
    client_address: 'Алматы, ул. Толе би 15',
    courier_stage: 'returned',
    courier_fee: 1150,
    courier_name: 'Тестовый Курьер',
    seller_id: 'seller-2',
    zone: 'Алматы',
    status: 'returned',
    created_at: daysAgo(90),
    lat: 43.255000,
    lng: 76.928000,
  },
]
