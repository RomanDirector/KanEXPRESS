import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { ContactForm } from '@/components/contacts/contact-form'

export const metadata: Metadata = {
  title: 'Контакты — KanExpress',
  description: 'Свяжитесь с командой KanExpress. Отвечаем в WhatsApp и по email.',
}

const INFO = [
  {
    label: 'Адрес',
    value: 'Алматы, ул. Бокеева 1а',
    href: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
  },
  {
    label: 'Email',
    value: 'kaisarkan030490@gmail.com',
    href: 'mailto:kaisarkan030490@gmail.com',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
    ),
  },
  {
    label: 'WhatsApp',
    value: '+7 776 728 6272',
    href: 'https://wa.me/77767286272',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
  },
  {
    label: 'Режим работы',
    value: 'Ежедневно, 13:00–22:00',
    href: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
]

export default function ContactsPage() {
  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 pt-36 pb-24">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs uppercase tracking-widest text-primary">Контакты</p>
          <h1 className="text-4xl font-light tracking-tight text-gray-900">Свяжитесь с нами</h1>
          <p className="mt-3 text-gray-400 text-sm max-w-md mx-auto">
            Ответим в течение часа в рабочее время. В WhatsApp — ещё быстрее.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          {/* Info */}
          <div className="space-y-3 lg:col-span-2">
            {INFO.map((item) => (
              <div key={item.label} className="flex items-center gap-4 rounded-2xl bg-white p-5">
                <div className="flex-shrink-0 text-primary">{item.icon}</div>
                <div>
                  <p className="text-xs text-gray-400">{item.label}</p>
                  {item.href ? (
                    <a href={item.href} className="mt-0.5 text-sm font-light text-gray-900 hover:text-primary transition-colors">
                      {item.value}
                    </a>
                  ) : (
                    <p className="mt-0.5 text-sm font-light text-gray-900">{item.value}</p>
                  )}
                </div>
              </div>
            ))}

            <a
              href="https://wa.me/77767286272"
              className="flex w-full items-center justify-center gap-3 rounded-full bg-[#25D366] py-3.5 text-sm font-semibold text-white transition-all hover:bg-[#22c55e] active:scale-95 wa-pulse"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              Написать в WhatsApp
            </a>
          </div>

          {/* Form */}
          <div className="lg:col-span-3">
            <ContactForm />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
