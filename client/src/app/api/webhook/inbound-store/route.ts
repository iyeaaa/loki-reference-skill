import { NextRequest, NextResponse } from 'next/server'
import busboy from 'busboy'
import { Readable } from 'stream'

const emails: any[] = []

function parseMultipartFormData(req: NextRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    const formData: any = {}
    const files: any[] = []

    const bb = busboy({
      headers: {
        'content-type': req.headers.get('content-type') || ''
      }
    })

    bb.on('field', (name: string, value: string) => {
      formData[name] = value
    })

    bb.on('file', (name: string, stream: any, info: any) => {
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

    const nodeStream = Readable.from(req.body as any)
    nodeStream.pipe(bb)
  })
}

export async function POST(request: NextRequest) {
  try {
    const { formData: body, files } = await parseMultipartFormData(request)

    const email = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      from: body.from,
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: body.html,
      attachments: files ? files.map((f: any) => ({
        filename: f.originalname,
        size: f.size,
        mimetype: f.mimetype
      })) : []
    }

    emails.push(email)
    console.log(`이메일 저장됨: ${email.subject} (ID: ${email.id})`)

    return NextResponse.json({ status: 'OK' }, { status: 200 })
  } catch (error: any) {
    console.error('Error storing email:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export { emails }