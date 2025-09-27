import { Elysia, t } from 'elysia'
import {
  AppError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from '../utils/errors'

export const testErrorRoutes = new Elysia({ prefix: '/api/test-errors' })
  // Test custom error classes
  .get('/validation-error', () => {
    throw new ValidationError('This is a validation error test')
  })
  .get('/not-found', () => {
    throw new NotFoundError('Resource not found test')
  })
  .get('/bad-request', () => {
    throw new BadRequestError('Bad request test')
  })
  .get('/unauthorized', () => {
    throw new UnauthorizedError('Unauthorized access test')
  })
  .get('/forbidden', () => {
    throw new ForbiddenError('Forbidden access test')
  })
  .get('/conflict', () => {
    throw new ConflictError('Conflict error test')
  })
  .get('/too-many-requests', () => {
    throw new TooManyRequestsError('Too many requests test')
  })
  .get('/internal-server', () => {
    throw new InternalServerError('Internal server error test')
  })
  .get('/service-unavailable', () => {
    throw new ServiceUnavailableError('Service unavailable test')
  })

  // Test general errors
  .get('/generic-error', () => {
    throw new Error('This is a generic error')
  })
  .get('/custom-app-error', () => {
    throw new AppError('Custom app error', 418, 'IM_A_TEAPOT')
  })

  // Test unhandled errors
  .get('/null-reference', () => {
    const obj: any = null
    return obj.someProperty // Will throw TypeError
  })
  .get('/async-error', async () => {
    await new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Async error test')), 100)
    })
  })

  // Test validation error from Elysia
  .post(
    '/validation-test',
    ({ body }) => {
      return { received: body }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 3 }),
        age: t.Number({ minimum: 0 }),
      }),
    },
  )

  // Successful endpoint for comparison
  .get('/success', () => {
    return {
      success: true,
      message: 'This endpoint works correctly',
      timestamp: new Date().toISOString(),
    }
  })
