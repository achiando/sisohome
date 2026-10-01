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

async function searchCommons(query: string) {
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

  return pages
    .map((pg) => ({ pg, info: pg.imageinfo?.[0] }))
    .find(({ pg, info }) => {
      if (info?.mime !== "image/jpeg" || !(info.width >= 600) || !info.thumburl)
        return false
      const licence = info.extmetadata?.LicenseShortName?.value ?? ""
      if (/\b(nc|nd)\b|-nc|-nd/i.test(licence)) return false // keep commercial-safe only
      const title = String(pg.title).toLowerCase()
      return words.length === 0 || words.some((w) => title.includes(w))
    })
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
    try {
      let hit = byQuery.get(query)
      if (!hit) {
        const found = await searchCommons(query)
        await sleep(400)
        if (!found) {
          missing.push(`${product.slug}  (query: "${query}")`)
          continue
        }
        const imgRes = await fetch(found.info.thumburl, {
          headers: { "User-Agent": UA },
        })
        if (!imgRes.ok) throw new Error(`download ${imgRes.status}`)
        const meta = found.info.extmetadata
        hit = {
          bytes: Buffer.from(await imgRes.arrayBuffer()),
          source: found.info.descriptionurl ?? "",
          author: stripHtml(meta?.Artist?.value),
          license: meta?.LicenseShortName?.value ?? "",
        }
        byQuery.set(query, hit)
        await sleep(400)
      }

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
    } catch (err) {
      missing.push(`${product.slug}  (error: ${(err as Error).message})`)
    }
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
        price: product.price,
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
