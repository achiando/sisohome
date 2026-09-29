"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@workspace/ui/lib/utils"

import { Eye, EyeOff, X } from "lucide-react"
import { Loader } from "./loader"

// Input variants matching Button & Material 3 system
const inputVariants = cva(
  "flex w-full min-w-0 rounded-xl border border-input bg-background text-base transition-all outline-none file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      size: {
        sm: "h-9 px-3 text-sm", // 36px height
        md: "h-11 px-4 text-base", // 44px height (mobile touch target standard)
        default: "h-11 px-4 text-base",
        lg: "h-13 px-5 text-lg", // 52px height
      },
      state: {
        default: "border-input",
        error: "border-destructive focus-visible:ring-destructive/30",
        success: "border-green-500 focus-visible:ring-green-500/30",
      },
    },
    defaultVariants: {
      size: "md",
      state: "default",
    },
  }
)

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {
  inputSize?: "sm" | "md" | "lg" | "default"
  state?: "default" | "error" | "success"
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  loading?: boolean
  showPasswordToggle?: boolean
  label?: string
  helperText?: string
  description?: string
  error?: string
  clearable?: boolean
  onClear?: () => void
  containerClassName?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      inputSize,
      size,
      state,
      leftIcon,
      rightIcon,
      loading = false,
      showPasswordToggle,
      label,
      helperText,
      description,
      error,
      clearable,
      onClear,
      disabled,
      type,
      id,
      value,
      ...props
    },
    ref
  ) => {
    const inputId = id || React.useId()
    const errorId = `${inputId}-error`
    const descId = `${inputId}-desc`
    const [showPassword, setShowPassword] = React.useState(false)

    const effectiveSize = inputSize || size || "md"
    const effectiveState = error ? "error" : state || "default"
    const helperMessage = error || helperText || description
    const hasValue = value !== undefined && value !== ""

    const showClearButton = clearable && hasValue && !disabled && !loading
    const showRightSlot =
      loading || rightIcon || showPasswordToggle || showClearButton

    const inputElement = (
      <div className="relative w-full">
        {leftIcon && (
          <div className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 transform text-muted-foreground">
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          type={showPassword ? "text" : type || "text"}
          data-slot="input"
          value={value}
          className={cn(
            inputVariants({ size: effectiveSize, state: effectiveState }),
            leftIcon && "pl-11",
            showRightSlot && "pr-11",
            className
          )}
          ref={ref}
          disabled={disabled || loading}
          aria-invalid={!!error || effectiveState === "error"}
          aria-describedby={
            error ? errorId : helperMessage ? descId : undefined
          }
          {...props}
        />

        {showRightSlot && (
          <div className="absolute top-1/2 right-3 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
            {loading ? (
              <Loader size="sm" />
            ) : (
              <>
                {showClearButton && (
                  <button
                    type="button"
                    onClick={onClear}
                    className="rounded-full p-1 hover:bg-muted text-muted-foreground/80 hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label="Clear input"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}

                {showPasswordToggle && (
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="rounded-full p-1 hover:bg-muted text-muted-foreground/80 hover:text-foreground transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                )}

                {rightIcon}
              </>
            )}
          </div>
        )}
      </div>
    )

    if (!label && !helperMessage) {
      return inputElement
    }

    return (
      <div className={cn("flex flex-col gap-1.5 w-full", containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold text-foreground/90 select-none tracking-wide"
          >
            {label}
          </label>
        )}
        {inputElement}
        {helperMessage && (
          <p
            id={error ? errorId : descId}
            className={cn(
              "text-xs leading-relaxed",
              error ? "text-destructive font-medium" : "text-muted-foreground"
            )}
          >
            {helperMessage}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input, inputVariants }
