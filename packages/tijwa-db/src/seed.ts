import path from "node:path"
import dotenv from "dotenv"

import { hashPassword } from "./password"
import { categories, products, projects } from "./seed-data"

const packageRoot = path.resolve(import.meta.dirname, "..")
dotenv.config({ path: path.join(packageRoot, ".env") })
dotenv.config({ path: path.join(packageRoot, "../../apps/welding/.env") })

const { prisma } = await import("./index")

async function seedCategories() {
  const ids = new Map<string, string>()

  for (const category of categories) {
    const record = await prisma.category.upsert({
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
    ids.set(category.slug, record.id)
  }

  return ids
}

async function seedProducts(categoryIds: Map<string, string>) {
  for (const product of products) {
    const categoryId = categoryIds.get(product.categorySlug)
    if (!categoryId) {
      throw new Error(
        `Unknown category "${product.categorySlug}" for product "${product.slug}"`,
      )
    }

    const data = {
      name: product.name,
      shortDesc: product.shortDesc,
      description: product.description,
      specifications: product.specifications,
      images: product.images,
      isFeatured: product.isFeatured,
      sortOrder: product.sortOrder,
      seoTitle: product.seoTitle,
      seoDesc: product.seoDesc,
      priceRange: product.priceRange,
      isActive: true,
      category: { connect: { id: categoryId } },
    }

    await prisma.product.upsert({
      where: { slug: product.slug },
      update: data,
      create: { slug: product.slug, ...data },
    })
  }
}

async function seedProjects() {
  for (const project of projects) {
    const data = {
      title: project.title,
      type: project.type,
      description: project.description,
      images: project.images,
      isFeatured: project.isFeatured,
      sortOrder: project.sortOrder,
      seoTitle: project.seoTitle,
      seoDesc: project.seoDesc,
      isActive: true,
    }

    await prisma.project.upsert({
      where: { slug: project.slug },
      update: data,
      create: { slug: project.slug, ...data },
    })
  }
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim()
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.warn(
      "  ! ADMIN_EMAIL / ADMIN_PASSWORD not set - skipping the admin account",
    )
    return 0
  }

  const existing = await prisma.admin.findUnique({ where: { email } })
  if (existing) {
    console.log(`  - admin ${email} already exists (password left unchanged)`)
    return 0
  }

  await prisma.admin.create({
    data: {
      email,
      password: hashPassword(password),
      name: "TijwaWelders Admin",
      isActive: true,
    },
  })
  console.log(`  + admin ${email} created`)
  return 1
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "[tijwa-db] DATABASE_URL is not set. Add it to packages/tijwa-db/.env before seeding.",
    )
  }

  console.log("Seeding @workspace/tijwa-db ...")

  const categoryIds = await seedCategories()
  await seedProducts(categoryIds)
  await seedProjects()
  const adminsCreated = await seedAdmin()

  const [categoryCount, productCount, projectCount, adminCount] =
    await Promise.all([
      prisma.category.count(),
      prisma.product.count(),
      prisma.project.count(),
      prisma.admin.count(),
    ])

  console.log("\nSeed complete")
  console.log(`  categories: ${categoryCount} (${categories.length} in seed)`)
  console.log(`  products:   ${productCount} (${products.length} in seed)`)
  console.log(`  projects:   ${projectCount} (${projects.length} in seed)`)
  console.log(`  admins:     ${adminCount} (${adminsCreated} created now)`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("\nSeed failed:", error)
    await prisma.$disconnect()
    process.exit(1)
  })
