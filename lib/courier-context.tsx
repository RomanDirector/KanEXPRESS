'use client'

import { createContext, useContext } from 'react'

export interface CourierProfile {
  id: string
  full_name: string
  phone: string
  status: string
  earned: number
  debt: number
  created_at: string
  vehicle_type: string | null
  car_number: string | null
  zone: string | null
}

export const CourierContext = createContext<CourierProfile | null>(null)

export function useCourier() {
  const courier = useContext(CourierContext)
  if (!courier) {
    throw new Error('useCourier must be used within app/(courier)/layout.tsx')
  }
  return courier
}
