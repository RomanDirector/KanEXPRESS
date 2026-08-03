import { LangProvider } from '@/lib/i18n'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <LangProvider>{children}</LangProvider>
}
