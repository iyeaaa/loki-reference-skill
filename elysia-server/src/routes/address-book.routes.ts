import { Elysia, t } from 'elysia'
import * as addressBook from '../services/address-book.service'

export const addressBookRoutes = new Elysia({ prefix: '/api/v1/address-book' })
  // Groups
  .get(
    '/groups',
    async ({ query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)
      const search = query.search
      const userId = query.userId

      if (!userId) {
        throw new Error('User ID is required')
      }

      const { groups, total } = await addressBook.listGroups(userId, limit, offset, search)
      return { data: groups, total, limit, offset }
    },
    {
      query: t.Object({
        userId: t.String({ format: 'uuid' }),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )
  .post(
    '/groups',
    async ({ body }) => {
      const { userId, ...groupData } = body
      return await addressBook.createGroup(userId, groupData)
    },
    {
      body: t.Object({
        userId: t.String({ format: 'uuid' }),
        name: t.String({ minLength: 1, maxLength: 120 }),
        description: t.Optional(t.String({ maxLength: 255 })),
      }),
    },
  )
  .put(
    '/groups/:id',
    async ({ params: { id }, body }) => {
      const { userId, ...groupData } = body
      return await addressBook.updateGroup(userId, id, groupData)
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      body: t.Object({
        userId: t.String({ format: 'uuid' }),
        name: t.Optional(t.String({ minLength: 1, maxLength: 120 })),
        description: t.Optional(t.String({ maxLength: 255 })),
      }),
    },
  )
  .delete(
    '/groups/:id',
    async ({ params: { id }, query }) => {
      const userId = query.userId

      if (!userId) {
        throw new Error('User ID is required')
      }

      await addressBook.deleteGroup(userId, id)
      return { success: true }
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      query: t.Object({
        userId: t.String({ format: 'uuid' }),
      }),
    },
  )
  // Contacts
  .get(
    '/groups/:id/contacts',
    async ({ params: { id }, query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)
      const search = query.search
      const userId = query.userId

      if (!userId) {
        throw new Error('User ID is required')
      }

      const { contacts, total } = await addressBook.listContacts(userId, id, limit, offset, search)
      return { data: contacts, total, limit, offset }
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      query: t.Object({
        userId: t.String({ format: 'uuid' }),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )
  .post(
    '/groups/:id/contacts',
    async ({ params: { id }, body }) => {
      const { userId, ...contactData } = body
      return await addressBook.addContact(userId, id, contactData)
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      body: t.Object({
        userId: t.String({ format: 'uuid' }),
        company: t.String({ minLength: 1, maxLength: 160 }),
        email: t.String({ format: 'email', maxLength: 200 }),
        industryType: t.Optional(t.String({ maxLength: 100 })),
        productCategory: t.Optional(t.String({ maxLength: 100 })),
        description: t.Optional(t.String({ maxLength: 1000 })),
        websiteUrl: t.Optional(t.String({ maxLength: 500 })),
        country: t.Optional(t.String({ maxLength: 100 })),
        linkedinUrl: t.Optional(t.String({ maxLength: 500 })),
        facebookUrl: t.Optional(t.String({ maxLength: 500 })),
        instagramUrl: t.Optional(t.String({ maxLength: 500 })),
      }),
    },
  )
  .delete(
    '/contacts/:contactId',
    async ({ params: { contactId }, query }) => {
      const userId = query.userId

      if (!userId) {
        throw new Error('User ID is required')
      }

      await addressBook.deleteContact(userId, contactId)
      return { success: true }
    },
    {
      params: t.Object({ contactId: t.String({ format: 'uuid' }) }),
      query: t.Object({
        userId: t.String({ format: 'uuid' }),
      }),
    },
  )


