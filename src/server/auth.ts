import { timingSafeEqual } from 'node:crypto'

import {
  clearSession,
  getSession,
  setResponseStatus,
  useSession,
} from '@tanstack/react-start/server'

interface GateSession {
  unlocked?: boolean
}

const COOKIE_NAME = 'china_trip_session'
const THIRTY_DAYS = 60 * 60 * 24 * 30
const DEV_SESSION_SECRET =
  'local-development-session-secret-change-before-publish'

function sessionPassword() {
  const secret = process.env.SESSION_SECRET || DEV_SESSION_SECRET
  return secret.length >= 32 ? secret : secret.padEnd(32, '.')
}

function sessionConfig() {
  const secureCookieEnv = process.env.SESSION_COOKIE_SECURE
  const secureCookie =
    secureCookieEnv === 'true'
      ? true
      : secureCookieEnv === 'false'
        ? false
        : process.env.NODE_ENV === 'production'

  return {
    name: COOKIE_NAME,
    password: sessionPassword(),
    maxAge: THIRTY_DAYS,
    cookie: {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: secureCookie,
      path: '/',
    },
  }
}

export function isPinValid(pin: string) {
  const expectedPin = process.env.SITE_PIN || '2580'
  const input = Buffer.from(pin)
  const expected = Buffer.from(expectedPin)
  const length = Math.max(input.length, expected.length)
  const paddedInput = Buffer.alloc(length)
  const paddedExpected = Buffer.alloc(length)

  input.copy(paddedInput)
  expected.copy(paddedExpected)

  return (
    input.length === expected.length &&
    timingSafeEqual(paddedInput, paddedExpected)
  )
}

export async function isUnlocked() {
  const session = await getSession<GateSession>(sessionConfig())
  return session.data.unlocked === true
}

export async function unlockSession() {
  const session = await useSession<GateSession>(sessionConfig())
  await session.update({ unlocked: true })
}

export async function lockSession() {
  await clearSession(sessionConfig())
}

export async function requireUnlocked() {
  if (await isUnlocked()) return
  setResponseStatus(401, 'Unauthorized')
  throw new Error('PIN gate is locked')
}
