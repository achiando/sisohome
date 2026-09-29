'use client';

import React, { useState } from 'react';
import { Search, Loader2, Plus, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@workspace/ui/components/input';
import { Button } from '@workspace/ui/components/button';
import { InfiniteScrollSentinel } from './infinite-scroll-sentinel';
import {
  ResponsiveMobileCard,
  ResponsiveMobileCardSkeleton,
  type CardDetailField,
  type CardAction,
} from './responsive-mobile-card';
import { cn } from '@workspace/ui/lib/utils';
import { useRipple } from '@workspace/ui/hooks/use-ripple';
import { Skeleton } from '@workspace/ui/components/skeleton';

export interface ColumnDef<T> {
  header: string;
  cell: (item: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface CardMapper<T> {
  id: (item: T) => string;
  title: (item: T) => string;
  subtitle?: (item: T) => string | undefined;
  image?: (item: T) => string | null | undefined;
  fallbackIcon?: (item: T) => React.ReactNode;
  statusBadge?: (item: T) => React.ReactNode;
  amount?: (item: T) => React.ReactNode;
  detailFields?: (item: T) => CardDetailField[];
  description?: (item: T) => string | null | undefined;
  actions?: (item: T) => CardAction[];
  detailHref?: (item: T) => string | undefined;
}

export interface FilterSelectOption {
  label: string;
  value: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterSelectOption[];
  value: string;
  onChange: (value: string) => void;
}

export interface ResponsiveDataListingProps<T> {
  title: string;
  description?: string;
  items: T[];
  columns: ColumnDef<T>[];
  cardMapper: CardMapper<T>;
  loading: boolean;
  skeletonCount?: number;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onSearchSubmit?: () => void;
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  primaryAction?: {
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
  };
  secondaryActions?: Array<{
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    variant?: 'outline' | 'ghost' | 'secondary';
  }>;
  emptyState?: {
    icon?: React.ComponentType<{ className?: string }>;
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  rowKey: (item: T) => string;
}

export function ResponsiveDataListing<T>({
  title,
  description,
  items,
  columns,
  cardMapper,
  loading,
  skeletonCount = 5,
  searchQuery = '',
  onSearchChange,
  onSearchSubmit,
  searchPlaceholder = 'Search...',
  filters = [],
  primaryAction,
  secondaryActions = [],
  emptyState,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  rowKey,
}: ResponsiveDataListingProps<T>) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { ripples, createRipple } = useRipple();

  const activeFiltersCount = filters.filter((f) => f.value !== '').length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {secondaryActions.map((sec, idx) => {
            const Icon = sec.icon;
            return (
              <Button
                key={idx}
                variant={sec.variant || 'outline'}
                onClick={sec.onClick}
                className="border-border gap-2 text-xs sm:text-sm h-9"
              >
                {Icon && <Icon className="h-4 w-4" />}
                <span>{sec.label}</span>
              </Button>
            );
          })}

          {primaryAction && (
            <Button onClick={primaryAction.onClick} className="gap-2 text-xs sm:text-sm h-9 shadow-xs">
              {primaryAction.icon ? (
                <primaryAction.icon className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span>{primaryAction.label}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Search & Filters Controls */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          {onSearchChange && (
            <div className="relative flex-1 group">
              <Search className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground/70 group-focus-within:text-primary transition-colors" />
              <Input
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && onSearchSubmit) {
                    onSearchSubmit();
                  }
                }}
                className="border-border/80 bg-card/50 pl-11 pr-10 h-11 text-sm rounded-xl shadow-sm focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary/50 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    if (onSearchSubmit) onSearchSubmit();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 rounded-full p-1 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}

          {/* Filter Trigger Toggle for Mobile & Desktop Filters */}
          {filters.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={(e) => {
                  createRipple(e);
                  setFiltersOpen(!filtersOpen);
                }}
                className={cn(
                  'border-border/80 h-11 gap-2 text-xs sm:text-sm flex-1 sm:flex-initial justify-between sm:justify-center rounded-xl shadow-sm',
                  activeFiltersCount > 0 && 'border-primary/50 text-primary bg-primary/5 font-medium shadow-sm'
                )}
              >
                <div className="flex items-center gap-1.5">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Filters</span>
                </div>
                {activeFiltersCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Filter Options Drawer / Dropdowns */}
        {filters.length > 0 && filtersOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-2xl border border-border/80 bg-card/95 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
            {filters.map((filter) => (
              <div key={filter.key} className="space-y-2">
                <label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider block">
                  {filter.label}
                </label>
                <select
                  value={filter.value}
                  onChange={(e) => filter.onChange(e.target.value)}
                  className="w-full border-border/70 bg-background text-foreground rounded-xl px-3.5 py-2.5 text-xs sm:text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/50 outline-none transition-all shadow-sm"
                >
                  <option value="">All {filter.label}s</option>
                  {filter.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <>
          {/* Desktop Table Skeleton */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
                  <tr className="border-b border-border/80 bg-muted/50 font-medium text-xs text-muted-foreground uppercase tracking-wider">
                    {columns.map((col, idx) => (
                      <th
                        key={idx}
                        className="px-4 py-4 font-semibold"
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {[...Array(5)].map((_, idx) => (
                    <tr key={idx}>
                      {columns.map((_, cIdx) => (
                        <td key={cIdx} className="px-4 py-4">
                          <Skeleton className="h-4 w-full rounded-lg" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card Skeleton */}
          <div className="space-y-4 md:hidden">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4 rounded-lg" />
                    <Skeleton className="h-3 w-1/2 rounded-lg" />
                  </div>
                  <Skeleton className="h-6 w-16 shrink-0 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-12 rounded-xl" />
                  <Skeleton className="h-12 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 px-4 text-center bg-card">
          {emptyState?.icon ? (
            <emptyState.icon className="h-12 w-12 text-muted-foreground/60" />
          ) : (
            <Search className="h-12 w-12 text-muted-foreground/60" />
          )}
          <h3 className="mt-4 text-base font-semibold text-foreground">{emptyState?.title || 'No items found'}</h3>
          {emptyState?.description && (
            <p className="mt-1 text-xs text-muted-foreground max-w-sm">{emptyState.description}</p>
          )}
          {emptyState?.onAction && (
            <Button variant="outline" onClick={emptyState.onAction} className="mt-4 border-border text-xs gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              {emptyState.actionLabel || 'Create New'}
            </Button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View (lg:block / md:block) */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-border/80 bg-card shadow-md">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
                  <tr className="border-b border-border/80 bg-muted/50 font-medium text-xs text-muted-foreground uppercase tracking-wider">
                    {columns.map((col, idx) => (
                      <th
                        key={idx}
                        className={cn('px-4 py-4 font-semibold', col.headerClassName || col.className)}
                      >
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {items.map((item) => (
                    <tr
                      key={rowKey(item)}
                      className="hover:bg-muted/40 transition-colors group/row cursor-pointer"
                    >
                      {columns.map((col, cIdx) => (
                        <td key={cIdx} className={cn('px-4 py-4 align-middle', col.className)}>
                          {col.cell(item)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile App Cards View (md:hidden) */}
          <div className="space-y-4 md:hidden">
            {items.map((item) => {
              const k = rowKey(item);
              return (
                <ResponsiveMobileCard
                  key={k}
                  id={cardMapper.id(item)}
                  title={cardMapper.title(item)}
                  subtitle={cardMapper.subtitle?.(item)}
                  image={cardMapper.image?.(item)}
                  fallbackIcon={cardMapper.fallbackIcon?.(item)}
                  statusBadge={cardMapper.statusBadge?.(item)}
                  amount={cardMapper.amount?.(item)}
                  detailFields={cardMapper.detailFields?.(item)}
                  description={cardMapper.description?.(item)}
                  actions={cardMapper.actions?.(item)}
                  detailHref={cardMapper.detailHref?.(item)}
                />
              );
            })}
          </div>

          {/* Infinite Scroll Sentinel for Auto Loading */}
          {onLoadMore && (
            <InfiniteScrollSentinel
              onLoadMore={onLoadMore}
              hasMore={hasMore}
              isLoadingMore={isLoadingMore}
            />
          )}
        </>
      )}
    </div>
  );
}
