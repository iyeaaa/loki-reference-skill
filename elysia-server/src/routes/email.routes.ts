import { Elysia } from 'elysia'
import { emails } from '../lib/email-storage'

export const emailRoutes = new Elysia({ prefix: '/api' }).get('/emails', () => {
  return {
    count: emails.length,
    emails: emails.slice(-50),
  }
})
