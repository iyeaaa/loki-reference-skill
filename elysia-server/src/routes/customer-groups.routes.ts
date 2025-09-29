import { Elysia, t } from 'elysia'
import * as customerGroupService from '../services/customer-group.service'
import { errorResponse, ResponseCode } from '../types/response.types'

const customerGroupSchema = t.Object({
  workspaceId: t.String({ format: 'uuid' }),
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String()),
  criteria: t.Optional(t.Any()),
  isDynamic: t.Optional(t.Boolean()),
  createdBy: t.Optional(t.String({ format: 'uuid' })),
})

const updateCustomerGroupSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  description: t.Optional(t.String()),
  criteria: t.Optional(t.Any()),
  isDynamic: t.Boolean(),
})

const groupMemberSchema = t.Object({
  leadId: t.String({ format: 'uuid' }),
  addedBy: t.Optional(t.String({ format: 'uuid' })),
})

export const customerGroupRoutes = new Elysia({ prefix: '/api/v1/customer-groups' })
  // Search customer groups with filters (must be before /:id route)
  .get(
    '/search',
    async ({ query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)

      // Parse workspaceIds and createdByIds from comma-separated string
      const workspaceIds = query.workspaceIds
        ? query.workspaceIds.split(',').filter(Boolean)
        : undefined
      const createdByIds = query.createdByIds
        ? query.createdByIds.split(',').filter(Boolean)
        : undefined

      const filters = {
        isDynamic: query.isDynamic ? query.isDynamic === 'true' : undefined,
        search: query.search,
        workspaceIds,
        createdByIds,
      }

      const groups = await customerGroupService.listCustomerGroupsWithFilters(
        limit,
        offset,
        filters,
      )
      const total = await customerGroupService.countCustomerGroupsWithFilters(filters)

      return {
        data: groups,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        isDynamic: t.Optional(t.String()),
        search: t.Optional(t.String()),
        workspaceIds: t.Optional(t.String()),
        createdByIds: t.Optional(t.String()),
      }),
    },
  )

  // Get customer group by ID
  .get(
    '/:id',
    async ({ params: { id }, set }) => {
      const group = await customerGroupService.getCustomerGroup(id)
      if (!group) {
        set.status = 404
        return errorResponse('고객 그룹을 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return group
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

  // Create new customer group
  .post(
    '/',
    async ({ body }) => {
      const group = await customerGroupService.createCustomerGroup(body)
      return group
    },
    {
      body: customerGroupSchema,
    },
  )

  // Update customer group
  .put(
    '/:id',
    async ({ params: { id }, body, set }) => {
      const group = await customerGroupService.updateCustomerGroup(id, body)
      if (!group) {
        set.status = 404
        return errorResponse('고객 그룹을 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }
      return group
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: updateCustomerGroupSchema,
    },
  )

  // Delete customer group
  .delete(
    '/:id',
    async ({ params: { id } }) => {
      await customerGroupService.deleteCustomerGroup(id)
      return { success: true, message: '고객 그룹이 삭제되었습니다.' }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

  // List customer groups with pagination
  .get(
    '/',
    async ({ query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)

      const groups = await customerGroupService.listCustomerGroups(limit, offset)
      const total = await customerGroupService.countCustomerGroups()

      return {
        data: groups,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // Get customer groups by workspace
  .get(
    '/workspace/:workspaceId',
    async ({ params: { workspaceId } }) => {
      const groups = await customerGroupService.getGroupsByWorkspace(workspaceId)
      return groups
    },
    {
      params: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
      }),
    },
  )

  // Get group members
  .get(
    '/:id/members',
    async ({ params: { id }, query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)

      const members = await customerGroupService.getGroupMembers(id, limit, offset)
      const total = await customerGroupService.countGroupMembers(id)

      return {
        data: members,
        total,
        limit,
        offset,
      }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )

  // Add group member
  .post(
    '/:id/members',
    async ({ params: { id }, body }) => {
      const member = await customerGroupService.addGroupMember({
        groupId: id,
        ...body,
      })
      return member
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: groupMemberSchema,
    },
  )

  // Remove group member
  .delete(
    '/:id/members/:leadId',
    async ({ params: { id, leadId } }) => {
      await customerGroupService.removeGroupMember(id, leadId)
      return { success: true, message: '그룹 멤버가 제거되었습니다.' }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
        leadId: t.String({ format: 'uuid' }),
      }),
    },
  )

  // Get groups for a specific lead
  .get(
    '/lead/:leadId/groups',
    async ({ params: { leadId } }) => {
      const groups = await customerGroupService.getLeadGroups(leadId)
      return groups
    },
    {
      params: t.Object({
        leadId: t.String({ format: 'uuid' }),
      }),
    },
  )

// Admin bulk update routes
export const adminCustomerGroupRoutes = new Elysia({ prefix: '/api/v1/admin/customer-groups' })
  // Bulk delete groups
  .delete(
    '/bulk',
    async ({ body }) => {
      const deletedCount = await customerGroupService.bulkDeleteCustomerGroups(body.groupIds)
      return { deletedCount }
    },
    {
      body: t.Object({
        groupIds: t.Array(t.String({ format: 'uuid' })),
      }),
    },
  )

  // Bulk add members
  .post(
    '/:id/members/bulk',
    async ({ params: { id }, body }) => {
      const addedCount = await customerGroupService.bulkAddMembers({
        groupId: id,
        leadIds: body.leadIds,
        addedBy: body.addedBy,
      })
      return { addedCount }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        leadIds: t.Array(t.String({ format: 'uuid' })),
        addedBy: t.Optional(t.String({ format: 'uuid' })),
      }),
    },
  )

  // Bulk remove members
  .delete(
    '/:id/members/bulk',
    async ({ params: { id }, body }) => {
      const removedCount = await customerGroupService.bulkRemoveMembers(id, body.leadIds)
      return { removedCount }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        leadIds: t.Array(t.String({ format: 'uuid' })),
      }),
    },
  )
