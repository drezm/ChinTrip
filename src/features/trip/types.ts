import type { Dispatch, SetStateAction } from 'react'

import type { TravelerId, TripState } from '../../types/trip'

export type SaveStatus = 'saved' | 'saving' | 'error'

export interface FeatureProps {
  state: TripState
  setState: Dispatch<SetStateAction<TripState>>
  currentTravelerId: TravelerId
  mutate: (
    label: string,
    request: Promise<unknown>,
    apply: (state: TripState, result: any) => TripState,
    optimistic?: (state: TripState) => TripState,
  ) => Promise<any | null>
}
