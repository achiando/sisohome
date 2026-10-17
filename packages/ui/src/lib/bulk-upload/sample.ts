import type { FieldDefinition } from "../../components/bulk-upload/bulk-upload.types"

export interface SampleData {
  filename: string
  headers: string[]
  rows: string[][]
}

export function generateSampleCSV(
  fields: FieldDefinition[],
  sampleCount = 3
): SampleData {
  const headers = fields.map((f) => f.label)
  const rows: string[][] = []

  for (let i = 0; i < sampleCount; i++) {
    const row = fields.map((field) => {
      if (field.options && field.options.length > 0) {
        const idx = i % field.options.length
        const option = field.options[idx]
        return option ? option.value : ""
      }
      switch (field.type) {
        case "number":
        case "currency":
          return String(i + 1)
        case "boolean":
          return i % 2 === 0 ? "true" : "false"
        default:
          return `Sample ${field.label} ${i + 1}`
      }
    })
    rows.push(row)
  }

  return {
    filename: "sample-import.csv",
    headers,
    rows,
  }
}

export function downloadCSV(sample: SampleData): void {
  const csvContent = [
    sample.headers.join(","),
    ...sample.rows.map((row) =>
      row
        .map((cell) => {
          const str = String(cell)
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(",")
    ),
  ].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = sample.filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function parseExcelFile(
  file: File
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  // Dynamic import: the xlsx parser ships as its own chunk instead of
  // being pulled into the initial bundle via a static require.
  const XLSX = await import("xlsx")
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: "array" })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error("No sheets found in workbook")
  }
  const firstSheet = workbook.Sheets[firstSheetName]
  if (!firstSheet) {
    throw new Error("Sheet not found")
  }
  const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, {
    defval: "",
  })

  if (jsonData.length === 0) {
    throw new Error("No data found in file")
  }

  const firstRow = jsonData[0]
  if (!firstRow) {
    throw new Error("No data found in file")
  }
  return { headers: Object.keys(firstRow), rows: jsonData }
}

export function parseCSVFile(
  file: File
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result
        if (typeof text !== "string") {
          reject(new Error("Failed to read file"))
          return
        }
        const lines = text.split("\n").filter((line) => line.trim())

        if (lines.length === 0) {
          reject(new Error("No data found in file"))
          return
        }

        const parseRow = (line: string): string[] => {
          const result: string[] = []
          let current = ""
          let inQuotes = false

          for (let i = 0; i < line.length; i++) {
            const char = line[i]
            if (char === '"') {
              if (inQuotes && line[i + 1] === '"') {
                current += '"'
                i++
              } else {
                inQuotes = !inQuotes
              }
            } else if (char === "," && !inQuotes) {
              result.push(current.trim())
              current = ""
            } else {
              current += char
            }
          }
          result.push(current.trim())
          return result
        }

        const firstLine = lines[0]
        if (!firstLine) {
          reject(new Error("No data found in file"))
          return
        }
        const headers = parseRow(firstLine)
        const rows = lines.slice(1).map((line: string) => {
          const values = parseRow(line)
          const row: Record<string, string> = {}
          headers.forEach((header, i) => {
            const val = values[i]
            row[header] = val !== undefined ? val : ""
          })
          return row
        })

        resolve({ headers, rows })
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}

export function detectFieldMappings(
  headers: string[],
  fields: FieldDefinition[]
): Record<string, string | null> {
  const mappings: Record<string, string | null> = {}
  const normalizedHeaders = headers.map((h) =>
    h
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, "")
  )

  fields.forEach((field) => {
    const normalizedField = field.key
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, "")
    const labelNormalized = field.label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, "")

    const exactMatchIdx = headers.findIndex(
      (h) => h.toLowerCase().trim() === field.label.toLowerCase().trim()
    )
    if (exactMatchIdx !== -1) {
      const header = headers[exactMatchIdx]
      if (header !== undefined) {
        mappings[header] = field.key
      }
      return
    }

    const fieldMatchIdx = normalizedHeaders.findIndex(
      (h) => h === normalizedField || h === labelNormalized
    )
    if (fieldMatchIdx !== -1) {
      const header = headers[fieldMatchIdx]
      if (header !== undefined) {
        mappings[header] = field.key
      }
      return
    }

    if (field.aiHint) {
      const hintWords = field.aiHint.toLowerCase().split(/\s+/)
      for (let i = 0; i < normalizedHeaders.length; i++) {
        const normalizedHeader = normalizedHeaders[i]
        if (normalizedHeader) {
          const matchCount = hintWords.filter((word: string) =>
            normalizedHeader.includes(word)
          ).length
          if (matchCount >= hintWords.length * 0.5) {
            const header = headers[i]
            if (header !== undefined) {
              mappings[header] = field.key
              return
            }
          }
        }
      }
    }

    const firstHeader = headers[0]
    if (firstHeader !== undefined) {
      mappings[firstHeader] = null
    }
  })

  return mappings
}
