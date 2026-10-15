import type { Metadata } from "next"
import { CategoryForm } from "../category-form"

export const metadata: Metadata = {
  title: "Add Category - ABILA Homes Admin",
}

export default function NewCategoryPage() {
  return <CategoryForm />
}
