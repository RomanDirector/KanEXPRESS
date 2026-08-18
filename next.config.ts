import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Явно фиксируем корень проекта. В родительской директории лежит сторонний
    // package-lock.json, из-за которого Next при автоопределении корня выдаёт на
    // каждом билде варнинг про несколько lockfile. Никакие lockfile не трогаем и
    // не удаляем — просто убираем неоднозначность выбора корня.
    root: __dirname,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
