import * as React from 'react'
import { cn } from '@/lib/utils'

const Dialog = ({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false)
  const isOpen = open ?? internalOpen
  const setOpen = onOpenChange ?? setInternalOpen

  return (
    <DialogContext.Provider value={{ open: isOpen, setOpen }}>
      {children}
    </DialogContext.Provider>
  )
}

interface DialogContextValue {
  open: boolean
  setOpen: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

const useDialog = () => {
  const ctx = React.useContext(DialogContext)
  if (!ctx) throw new Error('Dialog parts must be used inside <Dialog>')
  return ctx
}

const DialogTrigger = ({
  children,
  asChild,
}: {
  children: React.ReactNode
  asChild?: boolean
}) => {
  const { setOpen } = useDialog()
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement, {
      onClick: () => setOpen(true),
    })
  }
  return <button onClick={() => setOpen(true)}>{children}</button>
}

const DialogContent = React.forwardRef<
  HTMLDialogElement,
  React.DialogHTMLAttributes<HTMLDialogElement>
>(({ className, children, ...props }, ref) => {
  const { open, setOpen } = useDialog()
  const dialogRef = React.useRef<HTMLDialogElement>(null)

  React.useImperativeHandle(ref, () => dialogRef.current as HTMLDialogElement)

  React.useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        'rounded-lg border bg-background p-0 text-foreground shadow-lg [&::backdrop]:bg-black/50',
        className
      )}
      onClick={(e) => {
        if (e.target === dialogRef.current) setOpen(false)
      }}
      onClose={() => setOpen(false)}
      {...props}
    >
      <div className="p-6">{children}</div>
    </dialog>
  )
})
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
DialogDescription.displayName = 'DialogDescription'

export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
