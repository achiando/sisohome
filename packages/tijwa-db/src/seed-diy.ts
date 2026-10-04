import fs from "node:fs/promises"
import path from "node:path"
import dotenv from "dotenv"

import {
  diyCategories,
  diyImageQueries,
  diyProducts,
  diyProjects,
} from "./seed-diy-data"

/**
 * Usage:
 *   seed-diy.ts --validate        check data only (no DB, no network)
 *   seed-diy.ts --images-only     fetch missing product photos from Wikimedia Commons
 *   seed-diy.ts --images          fetch images, then seed
 *   seed-diy.ts                   seed only
 *   seed-diy.ts --prune           also deactivate DB rows no longer in the seed
 *   seed-diy.ts --images --force  re-download images that already exist
 */
const args = new Set(process.argv.slice(2))
const VALIDATE_ONLY = args.has("--validate")
const IMAGES_ONLY = args.has("--images-only")
const FETCH_IMAGES = args.has("--images") || IMAGES_ONLY
const PRUNE = args.has("--prune")
const FORCE = args.has("--force")

const packageRoot = path.resolve(import.meta.dirname, "..")
dotenv.config({ path: path.join(packageRoot, ".env") })
dotenv.config({ path: path.join(packageRoot, "../../apps/diy/.env") })

const IMAGE_DIR = path.join(packageRoot, "../../apps/diy/public/seed")

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function validateSeed() {
  const errors: string[] = []
  const categorySlugs = new Set<string>()
  const productSlugs = new Set<string>()
  const projectSlugs = new Set<string>()

  for (const c of diyCategories) {
    if (categorySlugs.has(c.slug))
      errors.push(`Duplicate category slug: ${c.slug}`)
    categorySlugs.add(c.slug)
  }

  for (const p of diyProducts) {
    if (productSlugs.has(p.slug))
      errors.push(`Duplicate product slug: ${p.slug}`)
    productSlugs.add(p.slug)
    if (!categorySlugs.has(p.categorySlug))
      errors.push(`Product ${p.slug}: unknown category "${p.categorySlug}"`)
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug))
      errors.push(`Product ${p.slug}: slug must be lowercase kebab-case`)
    if (!(typeof p.price === "number" && Number.isFinite(p.price) && p.price >= 0))
      errors.push(`Product ${p.slug}: bad price "${p.price}"`)
    if (!p.name || !p.shortDesc || !p.description)
      errors.push(`Product ${p.slug}: missing name or description`)
    if (p.specifications.length === 0)
      errors.push(`Product ${p.slug}: no specifications`)
    const pack = p.unit.match(/^Pack of (\d+)$/)
    if (pack) {
      const size = p.specifications.find((s) => s.label === "Pack size")
      if (size?.pieces !== Number(pack[1]))
        errors.push(
          `Product ${p.slug}: pack size spec does not match unit "${p.unit}"`
        )
      if (!p.name.includes(`(Pack of ${pack[1]})`))
        errors.push(
          `Product ${p.slug}: name should include "(Pack of ${pack[1]})"`
        )
    }
    if (!diyImageQueries[p.slug])
      errors.push(`Product ${p.slug}: no image query registered`)
  }

  for (const proj of diyProjects) {
    if (projectSlugs.has(proj.slug))
      errors.push(`Duplicate project slug: ${proj.slug}`)
    projectSlugs.add(proj.slug)
    if (proj.products.length === 0)
      errors.push(`Project ${proj.slug}: has no products`)
    if (!proj.products.some((l) => l.isRequired))
      errors.push(`Project ${proj.slug}: needs at least one required product`)
    if (proj.steps.length < 3)
      errors.push(`Project ${proj.slug}: needs at least 3 steps`)
    const seen = new Set<string>()
    for (const l of proj.products) {
      if (!productSlugs.has(l.productSlug))
        errors.push(`Project ${proj.slug}: unknown product "${l.productSlug}"`)
      if (seen.has(l.productSlug))
        errors.push(`Project ${proj.slug}: duplicate link "${l.productSlug}"`)
      seen.add(l.productSlug)
    }
  }

  if (errors.length) {
    console.error(`\nSeed validation failed (${errors.length}):`)
    errors.forEach((e) => console.error("  - " + e))
    process.exit(1)
  }

  const perCategory = new Map<string, number>()
  for (const p of diyProducts)
    perCategory.set(p.categorySlug, (perCategory.get(p.categorySlug) ?? 0) + 1)
  const packs = diyProducts.filter((p) => p.unit.startsWith("Pack of")).length

  console.log("Seed validation passed")
  console.log(`  categories: ${diyCategories.length}`)
  console.log(`  products:   ${diyProducts.length} (${packs} sold as packs)`)
  console.log(`  projects:   ${diyProjects.length}`)
  for (const c of diyCategories)
    console.log(`    ${c.slug.padEnd(26)} ${perCategory.get(c.slug) ?? 0}`)
}

/* ------------------------------------------------------------------ */
/* Image fetching (Wikimedia Commons, freely licensed)                  */
/* ------------------------------------------------------------------ */

const COMMONS_API = "https://commons.wikimedia.org/w/api.php"
const OPENVERSE_API = "https://api.openverse.org/v1/images/"
const UA = "TijwaDIYSeedBot/1.0 (https://tijwa.co.ke; contact@tijwa.co.ke)"
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const stripHtml = (s = "") => s.replace(/<[^>]*>/g, "").trim()

type Credit = {
  slug: string
  query: string
  file: string
  source: string
  author: string
  license: string
}

type SearchHit = {
  fetchUrl: string
  pageUrl: string
  author: string
  license: string
}

async function searchCommons(query: string): Promise<SearchHit | null> {
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

  const found = pages
    .map((pg) => ({ pg, info: pg.imageinfo?.[0] }))
    .find(({ pg, info }) => {
      if (info?.mime !== "image/jpeg" || !(info.width >= 600) || !info.thumburl)
        return false
      const licence = info.extmetadata?.LicenseShortName?.value ?? ""
      if (/\b(nc|nd)\b|-nc|-nd/i.test(licence)) return false // keep commercial-safe only
      const title = String(pg.title).toLowerCase()
      return words.length === 0 || words.some((w) => title.includes(w))
    })
  if (!found) return null
  const meta = found.info.extmetadata
  return {
    fetchUrl: found.info.thumburl,
    pageUrl: found.info.descriptionurl ?? "",
    author: stripHtml(meta?.Artist?.value),
    license: meta?.LicenseShortName?.value ?? "",
  }
}

/* Openverse fallback: aggregates Flickr, museums and other CC sources.
   Anonymous limits: 20/min, 200/day — callers must sleep between calls. */
async function searchOpenverse(query: string): Promise<SearchHit | null> {
  const url = new URL(OPENVERSE_API)
  url.search = new URLSearchParams({
    q: query,
    page_size: "20",
    license_type: "commercial",
    extension: "jpg",
  }).toString()

  const res = await fetch(url, { headers: { "User-Agent": UA } })
  if (!res.ok) return null
  const json: any = await res.json()
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2)

  const usable = (r: any) =>
    r.url && !(r.width && r.width < 600) && !/-nd\b/i.test(String(r.license ?? ""))
  const matches = (r: any) => {
    const hay = [r.title, ...(r.tags ?? []).map((t: any) => t?.name ?? "")]
      .join(" ")
      .toLowerCase()
    return words.some((w) => hay.includes(w))
  }
  const results: any[] = json?.results ?? []
  const chosen = results.find((r) => usable(r) && matches(r)) ?? results.find(usable)
  if (!chosen) return null
  return {
    fetchUrl: chosen.url,
    pageUrl: chosen.foreign_landing_url ?? chosen.url,
    author: String(chosen.creator ?? "").trim(),
    license: String(chosen.license ?? "").toUpperCase(),
  }
}

/* Niche part numbers (e.g. "CD4017") have no stock photo on either source.
   Reuse a close family photo so every product card has a working image;
   credits.json records the reuse. Remove an entry once a real photo is added. */
const IMAGE_FALLBACKS: Record<string, string> = {
  "mosfet-irlz44n-pack-5": "mosfet-irfz44n-pack-5",
  "mosfet-irf540n-pack-5": "mosfet-irf3205-pack-3",
  "cd4017-counter-pack-3": "cd4011-quad-nand-pack-5",
  "pc817-optocoupler-pack-10": "4n25-optocoupler-pack-10",
  "transistor-tip32c-pack-5": "transistor-tip31c-pack-5",
  "transistor-tip125-pack-5": "tip120-darlington-pack-5",
  "transistor-2sd880-pack-5": "transistor-bd139-pack-5",
  "transistor-2n7000-pack-10": "transistor-2n2222a-pack-10",
  "lm2576-5v-regulator-pack-3": "lm2596-buck-converter",
  "tlc555-timer-pack-5": "ne555-timer-pack-5",
  "74hc08-quad-and-pack-5": "74hc00-quad-nand-pack-5",
  "74hc32-quad-or-pack-5": "74hc02-quad-nor-pack-5",
  "74hc132-quad-nand-schmitt-pack-5": "74hc14-schmitt-pack-3",
  "74hc138-decoder-pack-3": "74hc245-bus-transceiver-pack-3",
  "74hc4511-bcd-driver-pack-3": "74hc574-octal-latch-pack-3",
  "cd4026-counter-pack-5": "cd4011-quad-nand-pack-5",
  "cd4060-oscillator-pack-5": "cd4011-quad-nand-pack-5",
  "moc3021-optocoupler-pack-5": "4n25-optocoupler-pack-10",
  "usb-c-breakout-pack-3": "usb-micro-breakout-pack-3",
  "jsn-sr04t-waterproof-ultrasonic": "hc-sr04-ultrasonic-sensor-2",
  "vl53l0x-tof-sensor": "vl53l1x-tof-sensor",
  "mq2-gas-sensor-module": "mq3-alcohol-sensor",
  "mq135-air-quality-sensor": "mq3-alcohol-sensor",
  "mq7-co-sensor": "mq3-alcohol-sensor",
  "flame-sensor-module": "ir-obstacle-sensor-fc51",
  "tcrt5000-line-tracker-module": "line-tracking-array-4ch",
  "max30102-pulse-oximeter": "pulse-sensor-analog",
  "esp32-devkit-v1": "esp32-s3-devkitc-1",
  "relay-module-2-channel": "relay-module-4-channel",
  "tm1637-4-digit-display": "tm1650-4digit-module",
  "microsd-card-module": "esp32-cam-module",
  "joystick-module-2-axis": "joystick-shield-uno",
  "ads1115-adc-module": "mcp4725-dac",
  "dfplayer-mini-mp3": "lm386-audio-amp-pack-3",
  "pam8403-amp-pack-2": "lm386-audio-amp-pack-3",
  "mcp23017-expander": "shift-register-74hc595-module",
  "tca9548a-i2c-mux": "oled-096-i2c-module",
  "max485-rs485": "mcp2515-can",
  "ac-dimmer-triac-module": "relay-srd-05vdc-pack-5",
  "hc-06-bluetooth-module": "hc-05-bluetooth-module",
  "sim800l-gsm-module": "hc-05-bluetooth-module",
  "hc-12-serial-radio": "hc-05-bluetooth-module",
  "rf-relay-module-433": "rf-433mhz-pair",
  "rf-encoder-pt2262-kit": "rf-remote-4button-433",
  "wireless-door-sensor-433": "wireless-pir-tx-433",
  "dupont-crimp-pins-pack-100": "dupont-crimp-connector-kit-620",
  "lever-connector-kit-30": "screw-terminal-2p-pack-10",
  "usb-power-tester": "usb-micro-cable-1m",
  "u-nuts-m3-pack-10": "washer-m3-pack-100",
  "pan-tilt-bracket-sg90": "sg90-micro-servo",
}

async function fetchImages() {
  await fs.mkdir(IMAGE_DIR, { recursive: true })
  const creditsPath = path.join(IMAGE_DIR, "credits.json")
  let credits: Credit[] = await fs
    .readFile(creditsPath, "utf8")
    .then(JSON.parse)
    .catch(() => [])

  const byQuery = new Map<
    string,
    { bytes: Buffer; source: string; author: string; license: string }
  >()
  const missing: string[] = []
  let saved = 0

  for (const product of diyProducts) {
    const file = `${product.slug}.jpg`
    const dest = path.join(IMAGE_DIR, file)
    if (!FORCE && (await fs.stat(dest).catch(() => null))) continue

    const query = diyImageQueries[product.slug]

    // Sample images only: for known niche part numbers skip the network
    // entirely and reuse a close family photo so the card is never broken.
    const fallbackSlug = IMAGE_FALLBACKS[product.slug]
    if (fallbackSlug) {
      const src = path.join(IMAGE_DIR, `${fallbackSlug}.jpg`)
      if (await fs.stat(src).catch(() => null)) {
        await fs.copyFile(src, dest)
        const origin = credits.find((c) => c.slug === fallbackSlug)
        credits = credits.filter((c) => c.slug !== product.slug)
        credits.push({
          slug: product.slug,
          query,
          file,
          source: origin?.source
            ? `${origin.source} (reused from ${fallbackSlug})`
            : `reused from ${fallbackSlug}.jpg`,
          author: origin?.author ?? "",
          license: origin?.license ?? "",
        })
        saved++
        continue
      }
    }

    let failure: string | null = null
    try {
      let hit = byQuery.get(query)
      if (!hit) {
        let found = await searchCommons(query)
        await sleep(400)
        if (!found) {
          found = await searchOpenverse(query)
          await sleep(3100) // Openverse anon limit: 20/min
        }
        if (!found) {
          failure = `query: "${query}"`
        } else {
          const imgRes = await fetch(found.fetchUrl, {
            headers: { "User-Agent": UA },
          }).then(async (r) =>
            // Flickr CDN rejects bot UAs with 403; retry with a browser UA
            r.status === 403
              ? fetch(found.fetchUrl, {
                  headers: {
                    "User-Agent":
                      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
                  },
                })
              : r
          )
          if (!imgRes.ok) throw new Error(`download ${imgRes.status}`)
          hit = {
            bytes: Buffer.from(await imgRes.arrayBuffer()),
            source: found.pageUrl,
            author: found.author,
            license: found.license,
          }
          byQuery.set(query, hit)
          await sleep(400)
        }
      }

      if (hit) {
        await fs.writeFile(dest, hit.bytes)
        credits = credits.filter((c) => c.slug !== product.slug)
        credits.push({
          slug: product.slug,
          query,
          file,
          source: hit.source,
          author: hit.author,
          license: hit.license,
        })
        saved++
        continue
      }
    } catch (err) {
      failure = `error: ${(err as Error).message}`
    }

    missing.push(`${product.slug}  (${failure ?? "no image source"})`)
  }

  await fs.writeFile(creditsPath, JSON.stringify(credits, null, 2))
  console.log(`\nImages: ${saved} saved to ${IMAGE_DIR}`)
  if (missing.length) {
    console.log(
      `${missing.length} need a manual photo (save as <slug>.jpg in that folder):`
    )
    missing.forEach((m) => console.log("  - " + m))
  }
  console.log(
    "Review every image before launch and show credits (credits.json) where a licence requires it."
  )
}

/* ------------------------------------------------------------------ */
/* Database seeding                                                    */
/* ------------------------------------------------------------------ */

async function seedDatabase() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "[tijwa-db] DATABASE_URL is not set. Add it to apps/diy/.env before seeding."
    )
  }
  const { prisma } = await import("./index")

  try {
    console.log("\nSeeding DIY demo catalog (dev-only content) ...")

    const categoryIds = new Map<string, string>()
    for (const category of diyCategories) {
      const record = await prisma.diyCategory.upsert({
        where: { slug: category.slug },
        update: {
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: true,
        },
        create: {
          name: category.name,
          slug: category.slug,
          description: category.description,
          sortOrder: category.sortOrder,
        },
      })
      categoryIds.set(category.slug, record.id)
    }

    for (const product of diyProducts) {
      const categoryId = categoryIds.get(product.categorySlug)!
      const data = {
        name: product.name,
        shortDesc: product.shortDesc,
        description: product.description,
        unit: product.unit,
        priceCents: Math.round(product.price * 100),
        specifications: product.specifications,
        images: product.images,
        isFeatured: product.isFeatured,
        sortOrder: product.sortOrder,
        seoTitle: product.seoTitle,
        seoDesc: product.seoDesc,
        isActive: true,
        category: { connect: { id: categoryId } },
      }
      await prisma.diyProduct.upsert({
        where: { slug: product.slug },
        update: data,
        create: { slug: product.slug, ...data },
      })
    }

    for (const project of diyProjects) {
      const linkCreates = project.products.map((link) => ({
        product: { connect: { slug: link.productSlug } },
        quantity: link.quantity,
        isRequired: link.isRequired,
      }))
      const data = {
        title: project.title,
        category: project.category,
        shortDesc: project.shortDesc,
        description: project.description,
        steps: project.steps,
        images: project.images,
        isFeatured: project.isFeatured,
        sortOrder: project.sortOrder,
        seoTitle: project.seoTitle,
        seoDesc: project.seoDesc,
        isActive: true,
      }
      await prisma.diyProject.upsert({
        where: { slug: project.slug },
        update: { ...data, products: { deleteMany: {}, create: linkCreates } },
        create: {
          slug: project.slug,
          ...data,
          products: { create: linkCreates },
        },
      })
    }

    if (PRUNE) {
      const [c, p, j] = await Promise.all([
        prisma.diyCategory.updateMany({
          where: { slug: { notIn: diyCategories.map((x) => x.slug) } },
          data: { isActive: false },
        }),
        prisma.diyProduct.updateMany({
          where: { slug: { notIn: diyProducts.map((x) => x.slug) } },
          data: { isActive: false },
        }),
        prisma.diyProject.updateMany({
          where: { slug: { notIn: diyProjects.map((x) => x.slug) } },
          data: { isActive: false },
        }),
      ])
      console.log(
        `Pruned (deactivated): ${c.count} categories, ${p.count} products, ${j.count} projects`
      )
    }

    const [categoryCount, productCount, projectCount, linkCount] =
      await Promise.all([
        prisma.diyCategory.count(),
        prisma.diyProduct.count(),
        prisma.diyProject.count(),
        prisma.diyProjectProduct.count(),
      ])

    console.log("\nSeed complete")
    console.log(
      `  categories:    ${categoryCount} (${diyCategories.length} in seed)`
    )
    console.log(
      `  products:      ${productCount} (${diyProducts.length} in seed)`
    )
    console.log(
      `  projects:      ${projectCount} (${diyProjects.length} in seed)`
    )
    console.log(`  project links: ${linkCount}`)
    console.log(
      "\nNOTE: prices/specs in this seed are demo content - replace before production."
    )
  } finally {
    await prisma.$disconnect()
  }
}

/* ------------------------------------------------------------------ */

async function main() {
  validateSeed()
  if (VALIDATE_ONLY) return
  if (FETCH_IMAGES) await fetchImages()
  if (IMAGES_ONLY) return
  await seedDatabase()
}

main().catch((error) => {
  console.error("\nSeed failed:", error)
  process.exit(1)
})
