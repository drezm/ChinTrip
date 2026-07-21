import { ZodError } from 'zod'

import type { ServerError } from '../../types/trip'

export class AppServerError extends Error {
  code: string
  fieldErrors?: Record<string, string[]>

  constructor(error: ServerError) {
    super(error.message)
    this.name = 'AppServerError'
    this.code = error.code
    this.fieldErrors = error.fieldErrors
  }

  toJSON(): ServerError {
    return {
      code: this.code,
      message: this.message,
      fieldErrors: this.fieldErrors,
    }
  }
}

export function notFound(message = 'Запись не найдена') {
  return new AppServerError({ code: 'NOT_FOUND', message })
}

export function forbidden(message = 'Нужно разблокировать поездку PIN-кодом') {
  return new AppServerError({ code: 'UNAUTHORIZED', message })
}

export function validationError(error: ZodError): AppServerError {
  const fieldErrors = error.flatten().fieldErrors
  return new AppServerError({
    code: 'VALIDATION_ERROR',
    message: 'Проверь поля формы',
    fieldErrors,
  })
}

export function toServerError(error: unknown): ServerError {
  if (error instanceof AppServerError) return error.toJSON()
  if (error instanceof ZodError) return validationError(error).toJSON()
  if (error instanceof Error) {
    try {
      const parsed = JSON.parse(error.message) as ServerError
      if (parsed.code && parsed.message) return parsed
    } catch {
      // Regular runtime error, normalize below.
    }
    return { code: 'SERVER_ERROR', message: error.message }
  }
  return { code: 'SERVER_ERROR', message: 'Неизвестная ошибка' }
}

export function throwServerError(error: unknown): never {
  const normalized = toServerError(error)
  throw new Error(JSON.stringify(normalized))
}

