import { Readable } from "node:stream"
import busboy from "busboy"
import type { FileData, SendGridInboundPayload } from "../models/email.model"

export function parseMultipartFormData(
  contentType: string | null,
  body: ArrayBuffer,
): Promise<{ formData: SendGridInboundPayload; files: FileData[] }> {
  return new Promise((resolve, reject) => {
    const formData: SendGridInboundPayload = {} as SendGridInboundPayload
    const files: FileData[] = []
    const filePromises: Promise<void>[] = []

    const bb = busboy({
      headers: {
        "content-type": contentType || "",
      },
      defCharset: "utf8",
    })

    bb.on("field", (name: string, value: string) => {
      // biome-ignore lint/suspicious/noExplicitAny: Dynamic field assignment for SendGrid webhook
      ;(formData as any)[name] = value
    })

    bb.on(
      "file",
      (
        name: string,
        stream: NodeJS.ReadableStream,
        info: { filename: string; mimeType: string },
      ) => {
        const chunks: Buffer[] = []
        const filePromise = new Promise<void>((resolveFile) => {
          stream.on("data", (chunk: Buffer) => {
            chunks.push(chunk)
          })

          stream.on("end", () => {
            const buffer = Buffer.concat(chunks)
            files.push({
              fieldname: name,
              originalname: info.filename,
              mimetype: info.mimeType,
              buffer,
              size: buffer.length,
            })
            resolveFile()
          })

          stream.on("error", (err: Error) => {
            reject(new Error(`File stream error for ${info.filename}: ${err.message}`))
          })
        })

        filePromises.push(filePromise)
      },
    )

    bb.on("finish", async () => {
      // Wait for all file streams to complete before resolving
      try {
        await Promise.all(filePromises)
        resolve({ formData, files })
      } catch (error) {
        reject(error)
      }
    })

    bb.on("error", (err: Error) => {
      reject(err)
    })

    const nodeStream = Readable.from(Buffer.from(body))
    nodeStream.pipe(bb)
  })
}
