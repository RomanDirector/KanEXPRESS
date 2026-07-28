import { supabase } from '@/lib/supabase';
import { getSellerPlan } from '@/lib/subscription';

export async function checkLimit(
  sellerId: string,
  type: 'demping_rules' | 'zones'
): Promise<{ allowed: boolean; current: number; max: number; error: string | null }> {
  const plan = await getSellerPlan(sellerId);

  const limitColumn = type === 'demping_rules' ? 'max_demping_rules' : 'max_zones';
  const { data: limitData, error: limitError } = await supabase
    .from('plan_limits')
    .select(limitColumn)
    .eq('plan', plan)
    .single();

  if (limitError) {
    console.error(`checkLimit: failed to load plan_limits for plan="${plan}"`, limitError);
    // Fail open: a misconfigured/missing plan_limits row must not silently
    // block sellers from using the product (max would otherwise default to 0).
    return { allowed: true, current: 0, max: 0, error: limitError.message };
  }

  const max = (limitData as Record<string, number> | null)?.[limitColumn] ?? 0;

  const table = type === 'demping_rules' ? 'demping_rules' : 'zones';
  const { count, error: countError } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', sellerId);

  if (countError) {
    console.error(`checkLimit: failed to count ${table}`, countError);
    return { allowed: true, current: 0, max, error: countError.message };
  }

  const current = count ?? 0;

  return { allowed: current < max, current, max, error: null };
}
