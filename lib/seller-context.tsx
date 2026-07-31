'use client'

import { createContext, useContext } from 'react'

export interface SellerProfile {
  id: string
  full_name: string
  phone: string
  email: string | null
  organization_name: string
  organization_address: string
  kaspi_token: string | null
  kaspi_shop_id: string | null
  created_at: string
  company_logo_url: string | null
}

export const SellerContext = createContext<SellerProfile | null>(null)

export function useSeller() {
  const seller = useContext(SellerContext)
  if (!seller) {
    throw new Error('useSeller must be used within app/(seller)/layout.tsx')
  }
  return seller
}
