'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Eye } from 'lucide-react';
import { cn } from '@workspace/ui/lib/utils';
import { Button, buttonVariants } from '@workspace/ui/components/button';
import { useRipple } from '@workspace/ui/hooks/use-ripple';
import { Skeleton } from '@workspace/ui/components/skeleton';

export interface CardDetailField {
  label: string;
  value: React.ReactNode;
  fullWidth?: boolean;
}

export interface CardAction {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'subtle' | 'default';
  onClick?: () => void;
  href?: string;
}

export interface ResponsiveMobileCardProps {
  id: string;
  title: string;
  subtitle?: string;
  image?: string | null;
  fallbackIcon?: React.ReactNode;
  statusBadge?: React.ReactNode;
  amount?: React.ReactNode;
  detailFields?: CardDetailField[];
  description?: string | null;
  actions?: CardAction[];
  detailHref?: string;
  className?: string;
}

/**
 * Inline Read More / Show Less component for long text block handling.
 */
export function ExpandableText({
  text,
  maxChars = 120,
  className,
}: {
  text: string;
  maxChars?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;
  if (text.length <= maxChars) {
    return <p className={cn('text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed', className)}>{text}</p>;
  }

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed inline">
        {expanded ? text : `${text.slice(0, maxChars)}... `}
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="ml-1 text-xs font-semibold text-primary hover:underline focus:outline-none"
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>
    </div>
  );
}

/**
 * Skeleton placeholder for ResponsiveMobileCard.
 * Matches layout for zero-CLS loading states.
 */
export function ResponsiveMobileCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm space-y-3',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Avatar / Icon placeholder */}
          <Skeleton variant="default" className="h-14 w-14 shrink-0 rounded-xl border border-border/30" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            {/* Title placeholder */}
            <Skeleton variant="text" className="h-4 w-3/4" />
            {/* Subtitle placeholder */}
            <Skeleton variant="text" className="h-3 w-1/2" />
          </div>
        </div>
        {/* Right badge & amount placeholder */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-12 rounded-md" />
        </div>
      </div>
      {/* 2 metadata field placeholders */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Skeleton className="h-12 rounded-xl border border-border/20" />
        <Skeleton className="h-12 rounded-xl border border-border/20" />
      </div>
    </div>
  );
}

/**
 * Material Design 3 inspired responsive app card component.
 * Features stacked status & amount on top-right, touch-friendly tap expansion,
 * metadata key-value list, expandable read-more text, and touch action buttons.
 */
export function ResponsiveMobileCard({
  title,
  subtitle,
  image,
  fallbackIcon,
  statusBadge,
  amount,
  detailFields = [],
  description,
  actions = [],
  detailHref,
  className,
}: ResponsiveMobileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { ripples, createRipple } = useRipple();

  const toggleExpand = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground transition-all duration-300 ease-out shadow-sm hover:shadow-lg hover:border-border/80 active:scale-[0.98]',
        isExpanded && 'ring-2 ring-primary/30 border-primary/50 bg-card shadow-md',
        className
      )}
    >
      {/* Header Row (Always Visible) */}
      <div
        onClick={(e) => {
          createRipple(e);
          toggleExpand();
        }}
        className="relative flex items-start justify-between gap-3 p-4 cursor-pointer select-none overflow-hidden"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleExpand();
          }
        }}
      >
        {/* Ripple Effects */}
        {ripples.map((ripple) => (
          <span
            key={ripple.id}
            className="absolute rounded-full bg-primary/20 animate-ripple pointer-events-none"
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
            }}
          />
        ))}
        {/* Left Side: Avatar/Icon + Title + Subtitle */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {image ? (
            <img
              src={image}
              alt={title}
              className="h-14 w-14 shrink-0 rounded-xl object-cover border border-border/40 shadow-md"
            />
          ) : fallbackIcon ? (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground border border-border/30 shadow-sm">
              {fallbackIcon}
            </div>
          ) : null}

          <div className="min-w-0 flex-1 space-y-1">
            {detailHref ? (
              <a
                href={detailHref}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-sm text-foreground hover:text-primary transition-colors flex items-center gap-1.5 group/title"
              >
                <span className="truncate">{title}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-0 group-hover/title:opacity-100 transition-opacity shrink-0 text-muted-foreground" />
              </a>
            ) : (
              <h4 className="font-semibold text-sm text-foreground truncate">{title}</h4>
            )}

            {subtitle && (
              <p className="text-xs text-muted-foreground/80 font-medium truncate">{subtitle}</p>
            )}
          </div>
        </div>

        {/* Right Side: Stacked Status Badge + Amount */}
        <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
          {statusBadge && <div className="shrink-0">{statusBadge}</div>}
          {amount && <div className="text-sm font-bold text-foreground font-mono tracking-tight">{amount}</div>}
          <div className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors pt-1">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </div>

      {/* Expanded Content Section */}
      {isExpanded && (
        <div className="border-t border-border/40 bg-muted/30 px-4 pt-4 pb-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 ease-out">
          {/* Key-Value Details Grid */}
          {detailFields.length > 0 && (
            <div className="grid grid-cols-2 gap-3 text-xs">
              {detailFields.map((field, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'space-y-1 rounded-xl bg-background/80 p-3 border border-border/40 shadow-sm',
                    field.fullWidth && 'col-span-2'
                  )}
                >
                  <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider block">
                    {field.label}
                  </span>
                  <div className="font-medium text-foreground text-xs break-words leading-relaxed">{field.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Description with Read More */}
          {description && (
            <div className="rounded-xl bg-background/80 p-3 border border-border/40 shadow-sm">
              <span className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider block mb-1.5">
                Description / Notes
              </span>
              <ExpandableText text={description} maxChars={100} />
            </div>
          )}

          {/* Touch-Friendly Action Buttons */}
          {(actions.length > 0 || detailHref) && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              {detailHref && !actions.some((a) => a.href === detailHref) && (
                <a
                  href={detailHref}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'h-9 text-xs font-medium border-border/70 gap-1.5 flex-1 justify-center shadow-sm'
                  )}
                >
                  <Eye className="h-3.5 w-3.5" />
                  View Details
                </a>
              )}

              {actions.map((act, idx) => {
                const Icon = act.icon;
                if (act.href) {
                  return (
                    <a
                      key={idx}
                      href={act.href}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        buttonVariants({ variant: act.variant || 'outline', size: 'sm' }),
                        'h-9 text-xs font-medium gap-1.5 flex-1 justify-center shadow-sm'
                      )}
                    >
                      {Icon && <Icon className="h-3.5 w-3.5" />}
                      {act.label}
                    </a>
                  );
                }

                return (
                  <Button
                    key={idx}
                    variant={act.variant || 'outline'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      act.onClick?.();
                    }}
                    className="h-9 text-xs font-medium gap-1.5 flex-1 shadow-sm"
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {act.label}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
