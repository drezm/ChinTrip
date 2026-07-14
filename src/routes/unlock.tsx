import { FormEvent, useState } from 'react'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { KeyRound, Loader2, LockKeyhole } from 'lucide-react'

import { getSessionStatus, unlockTrip } from '../server/functions'

export const Route = createFileRoute('/unlock')({
  loader: async () => {
    const status = await getSessionStatus()
    if (status.unlocked) {
      throw redirect({ to: '/' })
    }
  },
  component: UnlockPage,
})

function UnlockPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const result = await unlockTrip({ data: pin })
      if (!result.ok) {
        setError('PIN не подошёл')
        return
      }
      await router.navigate({ to: '/' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="unlock-screen">
      <section className="unlock-panel" aria-labelledby="unlock-title">
        <div className="unlock-mark">
          <LockKeyhole size={32} />
        </div>
        <p className="eyebrow">China Trip</p>
        <h1 id="unlock-title">Общий PIN</h1>
        <form onSubmit={handleSubmit} className="unlock-form">
          <label>
            <span>PIN-код</span>
            <input
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••"
              autoFocus
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-button" disabled={isSubmitting} type="submit">
            {isSubmitting ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
            <span>Разблокировать</span>
          </button>
        </form>
      </section>
    </main>
  )
}
