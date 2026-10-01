import Link from "next/link"
import { breadcrumbJsonLd, jsonLdScript } from "@/lib/seo"

type Crumb = { name: string; path: string }

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const all = [{ name: "Home", path: "/" }, ...items]

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-1">
          {all.map((item, index) => {
            const isLast = index === all.length - 1
            return (
              <li key={item.path} className="flex items-center">
                {index > 0 && (
                  <span aria-hidden="true" className="mx-2">
                    /
                  </span>
                )}
                {isLast ? (
                  <span aria-current="page" className="text-foreground">
                    {item.name}
                  </span>
                ) : (
                  <Link href={item.path} className="hover:text-foreground">
                    {item.name}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(all)) }}
      />
    </>
  )
}
