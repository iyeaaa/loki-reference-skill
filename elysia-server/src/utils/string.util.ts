export function decodeBase64(str: string): string | null {
  try {
    const cleanStr = str.replace(/[\r\n\s]/g, "")
    const decoded = Buffer.from(cleanStr, "base64").toString("utf-8")
    if (decoded && /^[\x20-\x7E\u00A0-\uFFFF\r\n\t]+$/.test(decoded)) {
      return decoded
    }
    return null
  } catch {
    return null
  }
}
