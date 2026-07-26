import Link from 'next/link'
import { MapPin } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

const tools = [
  {
    href: '/admin/geocode-keys',
    icon: MapPin,
    title: 'Ключи геокодера',
    description: 'Пул ключей 2GIS для геокодирования адресов',
  },
]

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Меню разработчика</h1>
          <p className="text-sm text-gray-500 mt-1">Служебные инструменты для администрирования KanExpress</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <Link key={tool.href} href={tool.href}>
                <Card className="hover:border-primary/40 hover:shadow-md transition-all duration-200 h-full">
                  <CardHeader>
                    <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                      <Icon className="size-4 text-primary" />
                    </div>
                    <CardTitle className="text-base">{tool.title}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
