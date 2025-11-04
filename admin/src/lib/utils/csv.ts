/**
 * Parse CSV file content to text format
 * Converts CSV data to a readable text format that can be included in prompts
 */
export function parseCsvToText(csvContent: string): string {
  // Split into lines
  const lines = csvContent.trim().split("\n")

  if (lines.length === 0) {
    return "Empty CSV file"
  }

  // Parse CSV lines (simple parser, handles basic quoted fields)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        inQuotes = !inQuotes
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

  // Parse header
  const headers = parseCSVLine(lines[0])

  // Parse data rows
  const rows = lines.slice(1).map((line) => parseCSVLine(line))

  // Convert to text format
  let textOutput = `CSV Data (${rows.length} rows):\n\n`

  // Add header
  textOutput += `Columns: ${headers.join(", ")}\n\n`

  // Add data rows in a readable format
  textOutput += "Data:\n"
  rows.forEach((row, index) => {
    textOutput += `Row ${index + 1}:\n`
    headers.forEach((header, colIndex) => {
      textOutput += `  ${header}: ${row[colIndex] || "N/A"}\n`
    })
    textOutput += "\n"
  })

  return textOutput
}

/**
 * Read file as text with UTF-8 encoding
 * Explicitly specifies UTF-8 to handle international characters (Korean, Chinese, etc.)
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (event) => {
      const text = event.target?.result as string
      resolve(text)
    }

    reader.onerror = () => {
      reject(new Error("Failed to read file"))
    }

    // Explicitly specify UTF-8 encoding to handle international characters
    reader.readAsText(file, "UTF-8")
  })
}
