import { supabase } from '@/lib/supabase';

export async function getSellerPlan(sellerId: string): Promise<'free' | 'pro'> {
  const { data } = await supabase
    .from('seller_subscriptions')
    .select('plan')
    .eq('seller_id', sellerId)
    .maybeSingle();

  return data?.plan === 'pro' ? 'pro' : 'free';
}
