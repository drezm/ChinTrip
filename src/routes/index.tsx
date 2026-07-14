import { createFileRoute, redirect } from '@tanstack/react-router'

import { TripApp } from '../components/TripApp'
import { getSessionStatus, getTripState } from '../server/functions'

export const Route = createFileRoute('/')({
  loader: async () => {
    const status = await getSessionStatus()
    if (!status.unlocked) {
      throw redirect({ to: '/unlock' })
    }
    return getTripState()
  },
  component: HomePage,
})

function HomePage() {
  const state = Route.useLoaderData()
  return <TripApp initialState={state} />
}
