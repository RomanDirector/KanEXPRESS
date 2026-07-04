import type { Handler } from '@netlify/functions'
import { syncKaspiOrders } from '../../lib/kaspi-sync'

// Netlify Scheduled Function — расписание задано в netlify.toml
// ([functions."kaspi-sync"].schedule), а не через schedule() из
// '@netlify/functions', чтобы не дублировать cron-выражение в двух местах.
// Импорт lib/kaspi-sync — относительный: эта функция бандлится Netlify
// отдельно от Next.js (esbuild, без tsconfig paths), поэтому алиас '@/...'
// здесь не резолвится.
export const handler: Handler = async () => {
  const results = await syncKaspiOrders()

  for (const result of results) {
    if (result.error) {
      console.error(`[kaspi-sync] продавец ${result.sellerId}: ${result.error}`)
    } else {
      console.log(`[kaspi-sync] продавец ${result.sellerId}: синхронизировано ${result.synced}`)
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ results }),
  }
}
