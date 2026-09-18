"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

const ToastProvider = ToastPrimitive.Provider

const ToastViewport = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport> & {
    position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"
  }
>(({ className, position = "bottom-center", ...props }, ref) => {
  const positionClasses = {
    "top-left": "top-0 left-0 sm:top-4 sm:left-4",
    "top-center": "top-0 left-1/2 -translate-x-1/2 sm:top-4",
    "top-right": "top-0 right-0 sm:top-4 sm:right-4",
    "bottom-left": "bottom-0 left-0 sm:bottom-4 sm:left-4",
    "bottom-center": "bottom-0 left-1/2 -translate-x-1/2 sm:bottom-4",
    "bottom-right": "bottom-0 right-0 sm:bottom-4 sm:right-4",
  }

  return (
    <ToastPrimitive.Viewport
      ref={ref}
      className={cn(
        "fixed z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:max-w-[420px]",
        positionClasses[position],
        className
      )}
      {...props}
    />
  )
})
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between gap-3 overflow-hidden rounded-2xl border p-4 shadow-lg transition-all select-none data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-bottom-full data-[state=open]:slide-in-from-bottom-full sm:data-[state=open]:slide-in-from-bottom-5",
  {
    variants: {
      variant: {
        default:
          "border-border bg-card text-foreground shadow-md",
        success:
          "border-emerald-500/30 bg-card text-foreground shadow-emerald-500/5",
        error:
          "border-destructive/30 bg-card text-foreground shadow-destructive/5",
        warning:
          "border-amber-500/30 bg-card text-foreground shadow-amber-500/5",
        info:
          "border-blue-500/30 bg-card text-foreground shadow-blue-500/5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Toast = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> &
    VariantProps<typeof toastVariants>
>(({ className, variant, ...props }, ref) => {
  return (
    <ToastPrimitive.Root
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  )
})
Toast.displayName = ToastPrimitive.Root.displayName

const ToastAction = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border bg-transparent px-3 text-xs font-semibold transition-colors hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitive.Action.displayName

const ToastClose = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Close
    ref={ref}
    className={cn(
      "rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
      className
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitive.Close>
))
ToastClose.displayName = ToastPrimitive.Close.displayName

const ToastTitle = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Title
    ref={ref}
    className={cn("text-xs sm:text-sm font-semibold tracking-tight", className)}
    {...props}
  />
))
ToastTitle.displayName = ToastPrimitive.Title.displayName

const ToastDescription = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Description
    ref={ref}
    className={cn("text-xs text-muted-foreground leading-relaxed", className)}
    {...props}
  />
))
ToastDescription.displayName = ToastPrimitive.Description.displayName

// ─── Imperative Toast Dispatcher ───────────────────────────────────────────────

type ToastType = "default" | "success" | "error" | "warning" | "info"

export interface ToastItem {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: ToastType
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
  open?: boolean
}

type ToastSubscriber = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
const listeners = new Set<ToastSubscriber>()

function emit() {
  listeners.forEach((listener) => listener([...toasts]))
}

export function toast(options: {
  title?: React.ReactNode
  description?: React.ReactNode
  variant?: ToastType
  action?: { label: string; onClick: () => void }
  duration?: number
}) {
  const id = Math.random().toString(36).substring(2, 9)
  const item: ToastItem = {
    id,
    open: true,
    duration: options.duration ?? 4000,
    ...options,
  }
  toasts = [item, ...toasts].slice(0, 5)
  emit()
  return id
}

toast.success = (title: React.ReactNode, options?: Omit<Parameters<typeof toast>[0], "title" | "variant">) =>
  toast({ title, variant: "success", ...options })

toast.error = (title: React.ReactNode, options?: Omit<Parameters<typeof toast>[0], "title" | "variant">) =>
  toast({ title, variant: "error", ...options })

toast.warning = (title: React.ReactNode, options?: Omit<Parameters<typeof toast>[0], "title" | "variant">) =>
  toast({ title, variant: "warning", ...options })

toast.info = (title: React.ReactNode, options?: Omit<Parameters<typeof toast>[0], "title" | "variant">) =>
  toast({ title, variant: "info", ...options })

toast.dismiss = (id?: string) => {
  if (id) {
    toasts = toasts.filter((t) => t.id !== id)
  } else {
    toasts = []
  }
  emit()
}

const variantIcons = {
  default: null,
  success: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />,
  error: <AlertCircle className="h-5 w-5 text-destructive shrink-0" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
  info: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
}

export function Toaster({
  position = "bottom-center",
}: {
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right"
}) {
  const [items, setItems] = React.useState<ToastItem[]>([])

  React.useEffect(() => {
    listeners.add(setItems)
    return () => {
      listeners.delete(setItems)
    }
  }, [])

  return (
    <ToastProvider swipeDirection="down">
      {items.map((item) => {
        const Icon = variantIcons[item.variant || "default"]
        return (
          <Toast
            key={item.id}
            variant={item.variant}
            duration={item.duration}
            onOpenChange={(open) => {
              if (!open) toast.dismiss(item.id)
            }}
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {Icon}
              <div className="grid gap-0.5 min-w-0 flex-1">
                {item.title && <ToastTitle>{item.title}</ToastTitle>}
                {item.description && (
                  <ToastDescription>{item.description}</ToastDescription>
                )}
              </div>
            </div>
            {item.action && (
              <ToastAction
                altText={item.action.label}
                onClick={item.action.onClick}
              >
                {item.action.label}
              </ToastAction>
            )}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport position={position} />
    </ToastProvider>
  )
}

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}
