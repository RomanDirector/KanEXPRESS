'use client'

import { createContext, useContext, useState } from 'react'

export type Lang = 'ru' | 'kz'

const translations = {
  ru: {
    dashboard: 'Мои заказы',
    dashboardSub: 'Управляйте заказами и накладными',
    invoices: 'Накладные',
    stats: 'Статистика',
    archive: 'Архив',
    staff: 'Персонал',
    map: 'Карта',
    tracking: 'Отслеживание',
    pending: 'Не отгружено',
    in_transit: 'В пути',
    delivered: 'Доставлено',
    search: 'Поиск по номеру, телефону, адресу...',
    allStatuses: 'Все статусы',
    reset: 'Сбросить',
    downloadInvoices: 'Скачать накладные',
    downloadSelected: 'Скачать выбранные',
    orderNum: '№ Заказа',
    phone: 'Телефон',
    address: 'Адрес',
    date: 'Дата',
    status: 'Статус',
    price: 'Стоимость',
    courier: 'Курьер',
    comment: 'Комментарий',
    invoice: 'Накладная',
    shown: 'Показано',
    of: 'из',
    orders: 'заказов',
    loading: 'Загрузка...',
    notFound: 'Заказов не найдено',
    selectAll: 'Выбрать все',
    massActions: 'Массовые действия',
    sellerPanel: 'Панель продавца',
    exportExcel: 'Экспорт в Excel',
    couriersTable: 'Таблица курьеров',
    earned: 'Получил (₸)',
    debt: 'Долг (₸)',
    pay: 'Оплатить',
    delete: 'Удалить',
    active: 'Активен',
    inactive: 'Неактивен',
    total: 'Всего',
    deliveryRate: 'Процент доставки',
    ordersByDate: 'Заказы по датам',
    avgCheck: 'Средний чек',
    revenue: 'Выручка',
    totalRevenue: 'Общая выручка',
    week: 'Неделя',
    month: 'Месяц',
    allTime: 'Всё время',
    finance: 'Финансы',
    distribute: 'Распределить',
    whatsappBroadcast: 'WhatsApp рассылка',
    mapTitle: 'Карта заказов',
    mapSub: 'Точки доставки на карте Алматы',
    trackingTitle: 'Отслеживание',
    trackingSub: 'Где сейчас курьер с вашим товаром',
    orderDetails: 'Детали заказа',
    revenueByDate: 'Выручка по датам',
    ordersMap: 'Карта заказов',
    noCoordinates: 'У этого заказа нет координат',
    couriersOnMap: 'Курьеры на карте',
    orderPoints: 'Точки заказов',
    financePage: 'Финансы',
    financeSub: 'Аналитика и доходы',
  },
  kz: {
    dashboard: 'Менің тапсырыстарым',
    dashboardSub: 'Тапсырыстар мен жүкқұжаттарды басқарыңыз',
    invoices: 'Жүкқұжаттар',
    stats: 'Статистика',
    archive: 'Мұрағат',
    staff: 'Қызметкерлер',
    map: 'Карта',
    tracking: 'Бақылау',
    pending: 'Жөнелтілмеген',
    in_transit: 'Жолда',
    delivered: 'Жеткізілді',
    search: 'Нөмір, телефон, мекенжай бойынша іздеу...',
    allStatuses: 'Барлық мәртебелер',
    reset: 'Тазалау',
    downloadInvoices: 'Жүкқұжаттарды жүктеу',
    downloadSelected: 'Таңдалғандарды жүктеу',
    orderNum: 'Тапсырыс №',
    phone: 'Телефон',
    address: 'Мекенжай',
    date: 'Күні',
    status: 'Мәртебе',
    price: 'Құны',
    courier: 'Курьер',
    comment: 'Түсініктеме',
    invoice: 'Жүкқұжат',
    shown: 'Көрсетілген',
    of: '/',
    orders: 'тапсырыс',
    loading: 'Жүктелуде...',
    notFound: 'Тапсырыстар табылмады',
    selectAll: 'Барлығын таңдау',
    massActions: 'Жаппай әрекеттер',
    sellerPanel: 'Сатушы панелі',
    exportExcel: 'Excel-ге экспорт',
    couriersTable: 'Курьерлер кестесі',
    earned: 'Алды (₸)',
    debt: 'Қарыз (₸)',
    pay: 'Төлеу',
    delete: 'Жою',
    active: 'Белсенді',
    inactive: 'Белсенді емес',
    total: 'Барлығы',
    deliveryRate: 'Жеткізу пайызы',
    ordersByDate: 'Күндер бойынша тапсырыстар',
    avgCheck: 'Орташа чек',
    revenue: 'Табыс',
    totalRevenue: 'Жалпы табыс',
    week: 'Апта',
    month: 'Ай',
    allTime: 'Барлық уақыт',
    finance: 'Қаржы',
    distribute: 'Бөлу',
    whatsappBroadcast: 'WhatsApp хабарлама',
    mapTitle: 'Тапсырыстар картасы',
    mapSub: 'Алматыдағы жеткізу нүктелері',
    trackingTitle: 'Бақылау',
    trackingSub: 'Курьер қазір сіздің тауарыңызбен қайда',
    orderDetails: 'Тапсырыс мәліметтері',
    revenueByDate: 'Күндер бойынша табыс',
    ordersMap: 'Тапсырыстар картасы',
    noCoordinates: 'Бұл тапсырыста координаттар жоқ',
    couriersOnMap: 'Картадағы курьерлер',
    orderPoints: 'Тапсырыс нүктелері',
    financePage: 'Қаржы',
    financeSub: 'Аналитика және кіріс',
  },
}

type TranslationKey = keyof typeof translations.ru

const LangContext = createContext<{
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey) => string
}>({
  lang: 'ru',
  setLang: () => {},
  t: (key) => key,
})

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('ru')
  const t = (key: TranslationKey) => translations[lang][key] || key
  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}