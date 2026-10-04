import { createHash } from "node:crypto"
import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"

const MAX_FILE_BYTES = 10 * 1024 * 1024

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
])

function env(name: string): string | null {
  const value = process.env[name]
  return value && value.trim() ? value.trim() : null
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 })
  }

  const cloudName = env("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME")
  const apiKey = env("CLOUDINARY_API_KEY")
  const apiSecret = env("CLOUDINARY_API_SECRET")
  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Cloudinary is not configured on the server." },
      { status: 500 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 })
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file provided." }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG, WebP, AVIF or GIF image." },
      { status: 415 },
    )
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "Image is larger than 10 MB." },
      { status: 413 },
    )
  }

  const requestedFolder = formData.get("folder")
  const folderSuffix =
    typeof requestedFolder === "string" &&
    /^[a-z0-9][a-z0-9/-]{0,48}$/.test(requestedFolder)
      ? `/${requestedFolder}`
      : ""
  const folder = `diy${folderSuffix}`

  const timestamp = Math.round(Date.now() / 1000)
  const signature = createHash("sha1")
    .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex")

  const uploadForm = new FormData()
  uploadForm.append("file", file)
  uploadForm.append("api_key", apiKey)
  uploadForm.append("timestamp", String(timestamp))
  uploadForm.append("signature", signature)
  uploadForm.append("folder", folder)

  let response: Response
  try {
    response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      { method: "POST", body: uploadForm },
    )
  } catch {
    return NextResponse.json(
      { error: "Could not reach Cloudinary. Try again." },
      { status: 502 },
    )
  }

  const data = (await response.json().catch(() => null)) as {
    secure_url?: string
    public_id?: string
    error?: { message?: string }
  } | null

  if (!response.ok || !data?.secure_url) {
    return NextResponse.json(
      { error: data?.error?.message || "Cloudinary rejected the upload." },
      { status: 502 },
    )
  }

  return NextResponse.json({ url: data.secure_url, publicId: data.public_id })
}
