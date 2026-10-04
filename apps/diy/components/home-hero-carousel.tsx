"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { ChevronLeft, ChevronRight, Tag } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"

export interface HeroDeal {
  href: string
  name: string
  category: string
  price: string | null
  imageUrl: string | null
  imageAlt: string
}

export interface HeroSlide {
  eyebrow: string
  title: string
  body: string
  gradient: string
  backgroundImageUrl?: string | null
  primary: { label: string; href: string }
  secondary?: { label: string; href: string; external?: boolean }
  deals?: HeroDeal[]
}

const AUTOPLAY_MS = 6000

function CtaButtons({ slide }: { slide: HeroSlide }) {
  const secondary = slide.secondary
  const primary = (
    <Button variant="primary" size="lg" className="h-12 w-full px-8 sm:w-auto">
      {slide.primary.label}
    </Button>
  )
  const secondaryButton = secondary && (
    <Button
      variant="outline"
      size="lg"
      className="h-12 w-full border-white/30 bg-transparent px-8 text-white hover:bg-white/10 sm:w-auto"
    >
      {secondary.label}
    </Button>
  )

  return (
    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
      <Link href={slide.primary.href} className="w-full sm:w-auto">
        {primary}
      </Link>
      {secondary &&
        secondaryButton &&
        (secondary.external ? (
          <a
            href={secondary.href}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto"
          >
            {secondaryButton}
          </a>
        ) : (
          <Link href={secondary.href} className="w-full sm:w-auto">
            {secondaryButton}
          </Link>
        ))}
    </div>
  )
}

export function HomeHeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = slides.length

  useEffect(() => {
    if (count < 2 || paused) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const id = setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS)
    return () => clearInterval(id)
  }, [count, paused])

  if (count === 0) return null

  const goTo = (next: number) => setIndex((next + count) % count)

  return (
    <div
      className="relative overflow-hidden rounded-3xl bg-slate-900"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured promotions"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${(index * 100) / count}%)` }}
      >
        {slides.map((slide, i) => (
          <div
            key={slide.title}
            className={cn("relative w-full shrink-0", slide.gradient)}
            aria-hidden={i !== index}
            inert={i !== index}
          >
            {slide.backgroundImageUrl && (
              <div className="absolute inset-0" aria-hidden="true">
                <Image
                  src={slide.backgroundImageUrl}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover opacity-30"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
              </div>
            )}
            <div
              className={cn(
                "relative z-10 grid min-h-[340px] items-center gap-6 px-5 pb-14 pt-6 sm:px-10 sm:pt-9 md:min-h-[420px]",
                slide.deals?.length ? "md:grid-cols-2" : "md:grid-cols-1",
              )}
            >
              <div className={cn(slide.deals?.length ? "" : "max-w-2xl")}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary">
                  <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                  {slide.eyebrow}
                </span>
                {i === 0 ? (
                  <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                    {slide.title}
                  </h1>
                ) : (
                  <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                    {slide.title}
                  </h2>
                )}
                <p className="mt-4 max-w-xl text-base text-slate-300 sm:text-lg">
                  {slide.body}
                </p>
                <CtaButtons slide={slide} />
              </div>

              {slide.deals && slide.deals.length > 0 && (
                <div className="hidden flex-col gap-3 md:flex">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Featured picks
                  </p>
                  {slide.deals.map((deal) => (
                    <Link
                      key={deal.href}
                      href={deal.href}
                      className="group flex items-center gap-3 rounded-2xl bg-background p-3 shadow-sm transition-shadow hover:shadow-md"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-20">
                        {deal.imageUrl && (
                          <Image
                            src={deal.imageUrl}
                            alt={deal.imageAlt}
                            fill
                            sizes="80px"
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs text-muted-foreground">
                          {deal.category}
                        </p>
                        <p className="truncate text-sm font-semibold text-foreground">
                          {deal.name}
                        </p>
                        {deal.price && (
                          <p className="text-base font-bold text-primary">
                            {deal.price}
                          </p>
                        )}
                      </div>
                      <span
                        className="pr-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      >
                        →
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Previous slide"
            onClick={() => goTo(index - 1)}
            className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Next slide"
            onClick={() => goTo(index + 1)}
            className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/30 text-white hover:bg-black/50 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </Button>

          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-1.5">
            {slides.map((slide, i) => (
              <Button
                key={slide.title}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => goTo(i)}
                className="rounded-full"
              >
                <span
                  className={cn(
                    "block h-2 w-2 rounded-full transition-colors",
                    i === index ? "bg-white" : "bg-white/40",
                  )}
                />
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
