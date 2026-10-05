/* Fetch real photos for welding seed products and projects.
   Commons first, Openverse fallback. Writes files to apps/welding/public/seed.
   Usage: tsx src/fetch-welding-images.mts [--limit N] */
import path from "node:path"
import fs from "node:fs/promises"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const IMAGE_DIR = path.join(__dirname, "../../../apps/welding/public/seed")
const CREDITS_PATH = path.join(IMAGE_DIR, "credits.json")
const COMMONS_API = "https://commons.wikimedia.org/w/api.php"
const OPENVERSE_API = "https://api.openverse.org/v1/images/"
const UA = "TijwaWeldersSeedBot/1.0 (https://tijwa.co.ke; contact@tijwa.co.ke)"
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
  file: string
  query: string
  source: string
  author: string
  license: string
}

type Job = {
  slug: string
  file: string
  queries: string[]
}

const jobs: Job[] = [
  { slug: "steel-sliding-gate", file: "steel-sliding-gate.jpg", queries: ["sliding gate metal", "sliding gate"] },
  { slug: "steel-sliding-gate", file: "steel-sliding-gate-2.jpg", queries: ["sliding driveway gate metal", "metal sliding gate open"] },
  { slug: "steel-pedestrian-gate", file: "steel-pedestrian-gate.jpg", queries: ["pedestrian gate", "garden gate metal"] },
  { slug: "steel-security-gate", file: "steel-security-gate.jpg", queries: ["security gate bars", "metal security gate"] },
  { slug: "steel-swing-gate", file: "steel-swing-gate.jpg", queries: ["double driveway gate", "swing gates iron"] },
  { slug: "steel-security-door", file: "steel-security-door.jpg", queries: ["steel door", "metal door entrance"] },
  { slug: "steel-security-door", file: "steel-security-door-2.jpg", queries: ["door lock cylinder close", "stainless steel door handle"] },
  { slug: "steel-door-frame", file: "steel-door-frame.jpg", queries: ["steel door frame installation", "metal door jamb frame"] },
  { slug: "steel-double-door", file: "steel-double-door.jpg", queries: ["double metal door", "double doors steel"] },
  { slug: "window-grills", file: "window-grills.jpg", queries: ["window grille bars", "window security bars"] },
  { slug: "window-grills", file: "window-grills-2.jpg", queries: ["window grill ironwork", "barred window close"] },
  { slug: "steel-window-frame", file: "steel-window-frame.jpg", queries: ["glass window steel frame", "steel framed window"] },
  { slug: "expanded-metal-screen", file: "expanded-metal-screen.jpg", queries: ["expanded metal mesh", "metal mesh panel"] },
  { slug: "balcony-railings", file: "balcony-railings.jpg", queries: ["balcony railing", "balustrade balcony"] },
  { slug: "balcony-railings", file: "balcony-railings-2.jpg", queries: ["wrought iron balcony railing", "steel balustrade"] },
  { slug: "stair-railings", file: "stair-railings.jpg", queries: ["stair railing metal", "staircase railing steel"] },
  { slug: "steel-handrails", file: "steel-handrails.jpg", queries: ["steel handrail", "handrail metal posts"] },
  { slug: "structural-steel-beams", file: "structural-steel-beams.jpg", queries: ["structural steel beam", "steel beams construction"] },
  { slug: "structural-steel-beams", file: "structural-steel-beams-2.jpg", queries: ["steel beams stacked", "I-beam steel construction"] },
  { slug: "steel-columns", file: "steel-columns.jpg", queries: ["steel frame column building", "structural steel columns erected"] },
  { slug: "custom-fabrication", file: "custom-fabrication.jpg", queries: ["metal fabrication welding", "welder workshop steel"] },

  { slug: "sliding-gate-fabrication", file: "sliding-gate-fabrication.jpg", queries: ["sliding gate metal", "gate fabrication"] },
  { slug: "sliding-gate-fabrication", file: "sliding-gate-fabrication-2.jpg", queries: ["sliding electric gate", "wrought iron sliding gate"] },
  { slug: "balcony-railing-fabrication", file: "balcony-railing-fabrication.jpg", queries: ["steel railing installation", "railing welding work"] },
  { slug: "balcony-railing-fabrication", file: "balcony-railing-fabrication-2.jpg", queries: ["ornamental iron railing", "metal railing weld detail"] },
  { slug: "window-grill-fabrication", file: "window-grill-fabrication.jpg", queries: ["window grille bars", "iron window grill"] },
  { slug: "window-grill-fabrication", file: "window-grill-fabrication-2.jpg", queries: ["welder workshop", "metal bars welding"] },
  { slug: "structural-steel-fabrication", file: "structural-steel-fabrication.jpg", queries: ["steel frame construction crane", "structural steel erection building"] },
  { slug: "structural-steel-fabrication", file: "structural-steel-fabrication-2.jpg", queries: ["steel welding workshop", "welder arc steel"] },
  { slug: "security-door-fabrication", file: "security-door-fabrication.jpg", queries: ["steel security door", "metal door fabrication"] },
]

const JUNK_TITLE = new RegExp(
  [
    String.raw`\((1[5-9]\d\d|19\d\d|20\d\d)`,
    String.raw`\bc\.\s*\d{4}`,
    String.raw`\b\d{1,2}-\d{1,2}-\d{2,4}\b`,
    "treatise|review|diary|letters|catalogue|catalog|proceedings|encyclop|magazine",
    "museum|gallery|engraving|etching|lithograph|watercolor|watercolour|drawing of|sketch of",
    String.raw`\bNGA\b|DPLA|Smithsonian`,
    "sale note|handwritten|manuscript|postcard|derelict|abandoned|ruined|ruins|decayed",
    String.raw`\bNARA\b`,
  ].join("|"),
  "i",
)

async function searchCommons(query: string): Promise<Hit[]> {
  const url = new URL(COMMONS_API)
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "30",
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
  const matchCount = (title: string) =>
    words.filter((w) => title.includes(w)).length

  type Cand = { title: string; info: any; rawTitle: string; licence: string }
  const cands: Cand[] = []
  for (const pg of pages) {
    const info = pg.imageinfo?.[0]
    if (info?.mime !== "image/jpeg" || !(info.width >= 600) || !info.thumburl)
      continue
    const licence = info.extmetadata?.LicenseShortName?.value ?? ""
    if (/\b(nc|nd)\b|-nc|-nd/i.test(licence)) continue
    const rawTitle = String(pg.title)
    if (JUNK_TITLE.test(rawTitle)) continue
    const title = rawTitle.toLowerCase()
    if (words.length > 0 && matchCount(title) === 0) continue
    cands.push({ title, info, rawTitle, licence })
  }

  let accepted = cands.filter((c) => matchCount(c.title) === words.length)
  if (accepted.length === 0)
    accepted = cands.filter(
      (c) => matchCount(c.title) >= Math.ceil(words.length / 2),
    )
  if (accepted.length === 0) accepted = cands

  return accepted.map((c) => ({
    title: String(c.rawTitle),
    fetchUrl: c.info.thumburl,
    pageUrl: c.info.descriptionurl ?? "",
    author: stripHtml(c.info.extmetadata?.Artist?.value),
    license: c.licence as string,
  }))
}

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
        !/-nd\b/i.test(String(r.license ?? "")) &&
        !JUNK_TITLE.test(String(r.title ?? "")),
    )
    .map((r) => ({
      title: String(r.title ?? query),
      fetchUrl: r.url,
      pageUrl: r.foreign_landing_url ?? r.url,
      author: String(r.creator ?? "").trim(),
      license: String(r.license ?? "").toUpperCase(),
    }))
}

async function download(url: string): Promise<Buffer> {
  let res = await fetch(url, { headers: { "User-Agent": UA } })
  if (res.status === 403)
    res = await fetch(url, { headers: { "User-Agent": BROWSER_UA } })
  if (!res.ok) throw new Error(`download ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

const credits: Credit[] = await fs
  .readFile(CREDITS_PATH, "utf8")
  .then(JSON.parse)
  .catch(() => [])

const creditedFiles = new Set(credits.map((c) => c.file))

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

await fs.mkdir(IMAGE_DIR, { recursive: true })

let fetched = 0
let skipped = 0
let failed = 0
let processed = 0

for (const job of jobs) {
  processed++
  if (LIMIT !== Infinity && processed > LIMIT) break

  if (creditedFiles.has(job.file)) {
    skipped++
    continue
  }

  const exclude = new Set<string>()
  for (const c of credits) {
    if (c.file !== job.file && c.source.startsWith("http"))
      exclude.add(c.source)
  }

  try {
    let found = await findHit(job.queries, exclude, "commons")
    if (!found) found = await findHit(job.queries.slice(0, 1), exclude, "openverse")

    if (!found) {
      failed++
      console.log(`MISS ${job.file} | q=${job.queries.join(" / ")}`)
      continue
    }

    const { hit, query } = found
    const bytes = await download(hit.fetchUrl)
    await sleep(300)

    await fs.writeFile(path.join(IMAGE_DIR, job.file), bytes)

    credits.push({
      slug: job.slug,
      file: job.file,
      query,
      source: hit.pageUrl,
      author: hit.author,
      license: hit.license,
    })
    fetched++
    console.log(`OK   ${job.file} | q=${query} | ${hit.title}`)
  } catch (err) {
    failed++
    console.log(`FAIL ${job.file} | ${err instanceof Error ? err.message : err}`)
  }
}

await fs.writeFile(CREDITS_PATH, JSON.stringify(credits, null, 2) + "\n")

console.log(
  `\nDone. fetched=${fetched} skipped=${skipped} failed=${failed} total=${jobs.length}`,
)
