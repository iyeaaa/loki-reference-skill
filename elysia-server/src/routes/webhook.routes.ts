import { Elysia } from 'elysia'
import { parseMultipartFormData } from '../utils/multipart.util'
import { webhookService } from '../services/webhook.service'

export const webhookRoutes = new Elysia({ prefix: '/api/webhook' })
  .post('/inbound', async ({ request }) => {
    try {
      const contentType = request.headers.get('content-type')
      const arrayBuffer = await request.arrayBuffer()
      const { formData: body, files } = await parseMultipartFormData(contentType, arrayBuffer)

      return webhookService.processInboundEmail(body, files)
    } catch (error) {
      console.error('Error processing webhook:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { error: errorMessage }
    }
  })
  .post('/inbound-store', async ({ request }) => {
    try {
      const contentType = request.headers.get('content-type')
      const arrayBuffer = await request.arrayBuffer()
      const { formData: body, files } = await parseMultipartFormData(contentType, arrayBuffer)

      return webhookService.processInboundStore(body, files)
    } catch (error) {
      console.error('Error storing email:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return { error: errorMessage }
    }
  })