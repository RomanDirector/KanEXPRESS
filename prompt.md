В app/(courier)/layout.tsx:

1. Сделай <aside> (боковое меню) скрытым на мобильном и видимым от md:
   className: "hidden md:flex w-60 ... fixed h-full ..."

2. Добавь нижнее меню, видимое ТОЛЬКО на мобильном (md:hidden), 
   fixed снизу, с теми же 6 пунктами (иконка + маленький текст), 
   например:

   <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border 
     flex justify-around py-2 z-50">
     {navItems.map((item) => {
       const Icon = item.icon
       const isActive = pathname === item.href
       return (
         <Link key={item.href} href={item.href} 
           className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium 
             ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
           <Icon size={20} />
           {item.label}
         </Link>
       )
     })}
   </nav>

3. У <main> убери фиксированный ml-60 на мобильном, оставь только от md:
   className: "md:ml-60 flex-1 min-h-screen pb-16 md:pb-0"
   (pb-16 — отступ снизу под нижнее меню, чтобы контент не перекрывался)