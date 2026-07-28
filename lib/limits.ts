import { supabase } from '@/lib/supabase';
import { getSellerPlan } from '@/lib/subscription';

export async function checkLimit(
  sellerId: string,
  type: 'demping_rules' | 'zones'
): Promise<{ allowed: boolean; current: number; max: number }> {
  const plan = await getSellerPlan(sellerId);

  const limitColumn = type === 'demping_rules' ? 'max_demping_rules' : 'max_zones';
  const { data: limitData } = await supabase
    .from('plan_limits')
    .select(limitColumn)
    .eq('plan', plan)
    .single();

  const max = (limitData as Record<string, number> | null)?.[limitColumn] ?? 0;

  const table = type === 'demping_rules' ? 'demping_rules' : 'zones';
  const { count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', sellerId);

  const current = count ?? 0;

  return { allowed: current < max, current, max };
}
