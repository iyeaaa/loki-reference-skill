import busboy from 'busboy'
import { Readable } from 'stream'
import { FormData, FileData } from '../models/email.model'

export function parseMultipartFormData(
  contentType: string | null,
  body: ArrayBuffer
): Promise<{ formData: FormData; files: FileData[] }> {
  return new Promise((resolve, reject) => {
    const formData: FormData = {}
    const files: FileData[] = []

    const bb = busboy({
      headers: {
        'content-type': contentType || ''
      }
    })

    bb.on('field', (name: string, value: string) => {
      formData[name] = value
    })

    bb.on('file', (name: string, stream: NodeJS.ReadableStream, info: any) => {
      const chunks: Buffer[] = []

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      stream.on('end', () => {
        files.push({
          fieldname: name,
          originalname: info.filename,
          mimetype: info.mimeType,
          buffer: Buffer.concat(chunks),
          size: Buffer.concat(chunks).length
        })
      })
    })

    bb.on('finish', () => {
      resolve({ formData, files })
    })

    bb.on('error', (err: Error) => {
      reject(err)
    })

    const nodeStream = Readable.from(Buffer.from(body))
    nodeStream.pipe(bb)
  })
}