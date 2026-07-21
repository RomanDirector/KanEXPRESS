Добавь третью роль "admin" в систему авторизации, по аналогии с уже 
существующими courier/seller.

1. В app/(auth)/login/page.tsx (или где сейчас логика редиректа после 
   supabase.auth.signInWithPassword) — добавь проверку таблицы admins 
   ПЕРЕД проверкой couriers и sellers:
   
   const { data: adminProfile } = await supabase
     .from('admins')
     .select('id')
     .eq('id', user.id)
     .single()
   
   if (adminProfile) {
     router.push('/admin')
     return
   }
   // дальше уже существующая проверка couriers, затем sellers

2. Создай app/admin/layout.tsx — общий layout для админки:
   - Проверяет сессию через supabase.auth.getUser()
   - Проверяет что user.id есть в таблице admins (через createAdminClient(), 
     не через обычный клиентский supabase — таблица admins не должна быть 
     читаема напрямую с клиента)
   - Если не админ — редирект на /login
   - Простой sidebar: "Меню разработчика" с пунктами (пока один: 
     "Ключи геокодера" → /admin/geocode-keys)

3. Создай app/admin/page.tsx — стартовая страница меню разработчика, 
   просто список доступных инструментов карточками (пока одна карточка 
   на geocode-keys, задел на будущее для других служебных инструментов)

4. Обнови app/admin/geocode-keys/page.tsx и app/api/admin/geocode-keys/route.ts — 
   убери проверку по ADMIN_EMAILS, замени на ту же проверку через таблицу 
   admins (id пользователя есть в admins), консистентно с остальной админкой

5. Кнопка "Выйти" в sidebar /admin — обычный supabase.auth.signOut(), 
   редирект на /login (тот же общий логин, никакого отдельного входа)

Удали упоминания ADMIN_EMAILS/NEXT_PUBLIC_ADMIN_EMAILS если они остались 
в коде с прошлых правок — переходим полностью на таблицу admins.