import { Elysia, t } from 'elysia'
import * as departmentService from '../services/department.service'

export const departmentsRoutes = new Elysia({ prefix: '/api/v1/departments' })
  // Get all active departments (no authentication required)
  .get('/', async ({ query }) => {
    const { search } = query
    console.log('Departments API called with search:', search)

    let departments = await departmentService.listDepartments()
    console.log('Total departments:', departments.length)

    // Filter by search term if provided
    if (search && typeof search === 'string' && search.trim() !== '') {
      const searchTerm = search.toLowerCase().trim()
      console.log('Filtering with search term:', searchTerm)
      departments = departments.filter(dept =>
        dept.name.toLowerCase().includes(searchTerm) ||
        dept.code.toLowerCase().includes(searchTerm)
      )
      console.log('Filtered departments:', departments.length)
    }

    return departments
  }, {
    query: t.Object({
      search: t.Optional(t.String())
    })
  })