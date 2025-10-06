import { Readable } from "node:stream"
import busboy from "busboy"
import type { FileData, SendGridInboundPayload } from "../models/email.model"

export function parseMultipartFormData(
  contentType: string | null,
  body: ArrayBuffer,
): Promise<{ formData: SendGridInboundPayload; files: FileData[] }> {
  return new Promise((resolve, _reject) => {
    const formData: SendGridInboundPayload = {} as SendGridInboundPayload
    const files: FileData[] = []

    const bb = busboy({
      headers: {
        "content-type": contentType || "",
      },
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

        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk)
        })

        stream.on("end", () => {
          files.push({
            fieldname: name,
            originalname: info.filename,
            mimetype: info.mimeType,
            buffer: Buffer.concat(chunks),
            size: Buffer.concat(chunks).length,
          })
        })
      },
    )

    bb.on("finish", () => {
      resolve({ formData, files })
    })

    bb.on("error", (err: Error) => {
      _reject(err)
    })

    const nodeStream = Readable.from(Buffer.from(body))
    nodeStream.pipe(bb)
  })
}
