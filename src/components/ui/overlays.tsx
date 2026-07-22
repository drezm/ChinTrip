import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { Drawer } from 'vaul'
import { X } from 'lucide-react'

import { cn } from '../../lib/utils'
import { Button } from './button'

export function ResponsiveModal({
  open,
  title,
  description,
  children,
  footer,
  onOpenChange,
}: {
  open: boolean
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  onOpenChange: (open: boolean) => void
}) {
  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 hidden bg-black/45 data-[state=open]:animate-in data-[state=closed]:animate-out md:block" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 hidden w-[min(720px,calc(100vw-32px))] max-h-[min(760px,calc(100vh-32px))] -translate-x-1/2 -translate-y-1/2 overflow-x-hidden overflow-y-auto rounded-3xl border border-border bg-popover p-4 text-popover-foreground shadow-xl outline-none md:grid md:gap-4">
            <div className="flex min-w-0 items-start justify-between gap-4">
              <div className="grid min-w-0 flex-1 gap-1">
                <DialogPrimitive.Title className="text-xl font-semibold">
                  {title}
                </DialogPrimitive.Title>
                {description ? (
                  <DialogPrimitive.Description className="text-sm text-muted-foreground">
                    {description}
                  </DialogPrimitive.Description>
                ) : null}
              </div>
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Закрыть">
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </div>
            {children}
            {footer}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/45 md:hidden" />
          <Drawer.Content
            className="fixed inset-x-0 z-50 min-w-0 max-w-full overflow-hidden rounded-t-3xl border border-border bg-popover p-4 pb-[var(--drawer-shell-bottom-padding)] text-popover-foreground shadow-xl outline-none transition-[bottom,max-height] duration-150 md:hidden"
            style={{
              bottom: 'var(--drawer-keyboard-inset, 0px)',
              maxHeight: 'calc(var(--visual-viewport-height, 100svh) - 12px)',
            }}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" />
            <div className="mb-4 flex min-w-0 items-start justify-between gap-4">
              <div className="grid min-w-0 flex-1 gap-1">
                <Drawer.Title className="text-lg font-semibold">{title}</Drawer.Title>
                {description ? (
                  <Drawer.Description className="text-sm text-muted-foreground">
                    {description}
                  </Drawer.Description>
                ) : null}
              </div>
              <Drawer.Close asChild>
                <Button variant="ghost" size="icon" aria-label="Закрыть">
                  <X />
                </Button>
              </Drawer.Close>
            </div>
            <div
              className="min-w-0 max-w-full overflow-x-hidden overflow-y-auto pb-[var(--drawer-scroll-bottom-padding)] pr-1"
              style={{
                maxHeight: 'calc(var(--visual-viewport-height, 100svh) - 132px)',
              }}
            >
              {children}
            </div>
            {footer}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}

export function ConfirmDeleteDialog({
  open,
  title,
  description = 'Действие нельзя отменить. Данные будут удалены после подтверждения.',
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  title: string
  description?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <AlertDialogPrimitive.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 grid w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-3xl border border-border bg-popover p-4 text-popover-foreground shadow-xl outline-none',
          )}
        >
          <div className="grid gap-2">
            <AlertDialogPrimitive.Title className="text-lg font-semibold">
              {title}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-sm leading-6 text-muted-foreground">
              {description}
            </AlertDialogPrimitive.Description>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary">Отмена</Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button variant="destructive" onClick={onConfirm}>
                Удалить
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}
