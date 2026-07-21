import type { ComponentProps, ReactNode } from 'react'

import { cn } from '../../lib/utils'

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('grid gap-1.5 p-4', className)} {...props} />
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-4 pt-0', className)} {...props} />
}

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-full border border-border bg-secondary px-2.5 text-xs font-medium text-secondary-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-11 min-w-0 max-w-full rounded-2xl border border-input bg-background px-3 text-base text-foreground shadow-xs outline-none transition-[border,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'min-h-24 min-w-0 max-w-full resize-y rounded-2xl border border-input bg-background px-3 py-2 text-base text-foreground shadow-xs outline-none transition-[border,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-20 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export function SelectField({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-11 min-w-0 max-w-full rounded-2xl border border-input bg-background px-3 text-base text-foreground shadow-xs outline-none transition-[border,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export function Field({
  label,
  error,
  className,
  children,
}: {
  label: string
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('grid min-w-0 gap-1.5 text-sm', className)}>
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
      {error ? <span className="text-xs font-medium text-destructive">{error}</span> : null}
    </label>
  )
}

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-2xl bg-muted', className)}
      {...props}
    />
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="grid justify-items-start gap-3 pt-4">
        <div className="grid size-10 place-items-center rounded-2xl bg-muted text-muted-foreground">
          {icon}
        </div>
        <div className="grid gap-1">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  )
}
