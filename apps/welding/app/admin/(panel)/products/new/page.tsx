import type { Metadata } from "next"
import { getAllCategories } from "@/lib/products"
import { ProductForm } from "../product-form"

export const metadata: Metadata = {
  title: "Add Product - TijwaWelders Admin",
}

export default async function NewProductPage() {
  const categories = await getAllCategories()

  return (
    <ProductForm
      categories={categories.map((category) => ({ id: category.id, name: category.name }))}
    />
  )
}
