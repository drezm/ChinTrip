import { createServerFn } from '@tanstack/react-start'

export const lockTrip = createServerFn({ method: 'POST' }).handler(async () => {
  const { lockSession } = await import('./auth')
  await lockSession()
  return { ok: true }
})

