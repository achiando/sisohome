/* Fetch a second photo for each DIY product so the product page gallery
   shows multiple images. Commons first, Openverse fallback.
   Usage: tsx src/fetch-second-images.mts [--limit N] */
import path from "node:path"
import fs from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { config } from "dotenv"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.join(__dirname, "../../../apps/diy/.env") })

const { prisma } = await import("./index.ts")
const { diyImageQueries } = await import("./seed-diy-data.ts")

const IMAGE_DIR = path.join(__dirname, "../../../apps/diy/public/seed")
const CREDITS_PATH = path.join(IMAGE_DIR, "credits.json")
const COMMONS_API = "https://commons.wikimedia.org/w/api.php"
const OPENVERSE_API = "https://api.openverse.org/v1/images/"
const UA = "TijwaDIYSeedBot/1.0 (https://tijwa.co.ke; contact@tijwa.co.ke)"
const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

const args = process.argv.slice(2)
const LIMIT = args.includes("--limit")
  ? Number(args[args.indexOf("--limit") + 1])
  : Infinity

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const stripHtml = (s = "") => s.replace(/<[^>]*>/g, "").trim()

type Hit = {
  title: string
  fetchUrl: string
  pageUrl: string
  author: string
  license: string
}

type Credit = {
  slug: string
  query: string
  file: string
  source: string
  author: string
  license: string
}

async function searchCommons(query: string): Promise<Hit[]> {
  const url = new URL(COMMONS_API)
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "20",
    gsrsearch: `${query} filetype:bitmap`,
    prop: "imageinfo",
    iiprop: "url|mime|size|extmetadata",
    iiurlwidth: "800",
  }).toString()

  const res = await fetch(url, { headers: { "User-Agent": UA } })
  if (!res.ok) throw new Error(`Commons API ${res.status}`)
  const json: any = await res.json()
  const pages: any[] = Object.values(json?.query?.pages ?? {})
  pages.sort((a, b) => a.index - b.index)

  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)

  const hits: Hit[] = []
  for (const pg of pages) {
    const info = pg.imageinfo?.[0]
    if (info?.mime !== "image/jpeg" || !(info.width >= 600) || !info.thumburl)
      continue
    const licence = info.extmetadata?.LicenseShortName?.value ?? ""
    if (/\b(nc|nd)\b|-nc|-nd/i.test(licence)) continue
    const title = String(pg.title).toLowerCase()
    if (words.length > 0 && !words.some((w) => title.includes(w))) continue
    hits.push({
      title: String(pg.title),
      fetchUrl: info.thumburl,
      pageUrl: info.descriptionurl ?? "",
      author: stripHtml(info.extmetadata?.Artist?.value),
      license: licence,
    })
  }
  return hits
}

async function download(url: string): Promise<Buffer> {
  let res = await fetch(url, { headers: { "User-Agent": UA } })
  if (res.status === 403)
    res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } })
  if (!res.ok) throw new Error(`download ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

/* Openverse fallback: aggregates Flickr, museums and other CC sources.
   Anonymous limits: 20/min, 200/day — sleep between calls. */
async function searchOpenverse(query: string): Promise<Hit[]> {
  const url = new URL(OPENVERSE_API)
  url.search = new URLSearchParams({
    q: query,
    page_size: "20",
    license_type: "commercial",
    extension: "jpg",
  }).toString()

  const res = await fetch(url, { headers: { "User-Agent": UA } })
  if (!res.ok) return []
  const json: any = await res.json()
  const results: any[] = json?.results ?? []
  return results
    .filter(
      (r) =>
        r.url &&
        !(r.width && r.width < 600) &&
        !/-nd\b/i.test(String(r.license ?? "")),
    )
    .map((r) => ({
      title: String(r.title ?? query),
      fetchUrl: r.url,
      pageUrl: r.foreign_landing_url ?? r.url,
      author: String(r.creator ?? "").trim(),
      license: String(r.license ?? "").toUpperCase(),
    }))
}

function altFromTitle(title: string): string {
  return title
    .replace(/^File:/, "")
    .replace(/\.\w+$/, "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

const credits: Credit[] = await fs
  .readFile(CREDITS_PATH, "utf8")
  .then(JSON.parse)
  .catch(() => [])

const products = await prisma.diyProduct.findMany({
  select: { id: true, slug: true, name: true, images: true },
  orderBy: { slug: "asc" },
})

const queryHits = new Map<string, Hit[]>()
const queryCursor = new Map<string, number>()

async function findHit(
  queries: string[],
  exclude: Set<string>,
  source: "commons" | "openverse",
): Promise<{ hit: Hit; query: string } | null> {
  for (const query of queries) {
    const key = `${source}:${query}`
    let hits = queryHits.get(key)
    if (!hits) {
      hits =
        source === "commons"
          ? await searchCommons(query)
          : await searchOpenverse(query)
      queryHits.set(key, hits)
      await sleep(source === "commons" ? 400 : 3100)
    }
    if (hits.length === 0) continue

    const words = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2)
    const score = (h: Hit) => {
      const t = h.title.toLowerCase()
      return words.filter((w) => t.includes(w)).length
    }
    // prefer titles matching every query word, keep relevance order otherwise
    const ordered = [...hits].sort((a, b) => score(b) - score(a))

    let cursor = queryCursor.get(key) ?? 0
    while (cursor < ordered.length) {
      const candidate = ordered[cursor++]
      if (!exclude.has(candidate.pageUrl)) {
        queryCursor.set(key, cursor)
        return { hit: candidate, query }
      }
    }
    queryCursor.set(key, cursor)
  }
  return null
}

const creditQuery = new Map<string, string>()
for (const c of credits) creditQuery.set(c.slug, c.query)

let fetched = 0
let skipped = 0
let failed = 0
let processed = 0

for (const product of products) {
  processed++
  if (LIMIT !== Infinity && processed > LIMIT) break

  const images = Array.isArray(product.images) ? (product.images as any[]) : []
  if (images.length >= 2) {
    skipped++
    continue
  }

  const exclude = new Set<string>()
  for (const c of credits) {
    if (c.slug === product.slug && c.source.startsWith("http"))
      exclude.add(c.source)
  }

  const nameQuery = product.name.replace(/\s*[(—].*$/, "")
  const queries = [
    creditQuery.get(product.slug) ?? "",
    diyImageQueries[product.slug] ?? "",
    nameQuery,
  ].filter((q, i, arr) => q.length > 0 && arr.indexOf(q) === i)

  try {
    let found = await findHit(queries, exclude, "commons")
    if (!found) found = await findHit(queries.slice(0, 2), exclude, "openverse")

    if (!found) {
      failed++
      console.log(`MISS ${product.slug} | q=${queries.join(" / ")}`)
      continue
    }

    const { hit, query: usedQuery } = found
    const bytes = await download(hit.fetchUrl)
    await sleep(300)

    const file = `${product.slug}-2.jpg`
    await fs.writeFile(path.join(IMAGE_DIR, file), bytes)

    const alt = altFromTitle(hit.title) || `${product.name} photo`
    await prisma.diyProduct.update({
      where: { id: product.id },
      data: { images: [...images, { url: `/seed/${file}`, alt }] },
    })

    credits.push({
      slug: product.slug,
      query: usedQuery,
      file,
      source: hit.pageUrl,
      author: hit.author,
      license: hit.license,
    })
    fetched++
    console.log(`OK   ${product.slug} | q=${usedQuery} | ${alt}`)

    if (fetched % 25 === 0) {
      await fs.writeFile(CREDITS_PATH, JSON.stringify(credits, null, 2))
      console.log(
        `[${processed}] second images fetched: ${fetched}, no-hit: ${failed}`,
      )
    }
  } catch (err) {
    failed++
    console.error(`error ${product.slug}: ${(err as Error).message}`)
    await sleep(1000)
  }
}

await fs.writeFile(CREDITS_PATH, JSON.stringify(credits, null, 2))
console.log(
  `DONE fetched=${fetched} failed/no-hit=${failed} skipped=${skipped} processed=${processed}`,
)
await prisma.$disconnect()
