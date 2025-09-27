import { Elysia } from 'elysia'
import { webhookService } from '../services/webhook.service'
import { parseMultipartFormData } from '../utils/multipart.util'

export const webhookRoutes = new Elysia({ prefix: '/api/webhook' })
  .post('/inbound', async ({ request }) => {
    const contentType = request.headers.get('content-type')
    const arrayBuffer = await request.arrayBuffer()
    const { formData: body, files } = await parseMultipartFormData(contentType, arrayBuffer)

    return webhookService.processInboundEmail(body, files)
  })
  .post('/inbound-store', async ({ request }) => {
    const contentType = request.headers.get('content-type')
    const arrayBuffer = await request.arrayBuffer()
    const { formData: body, files } = await parseMultipartFormData(contentType, arrayBuffer)

    return webhookService.processInboundStore(body, files)
  })
