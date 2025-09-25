// API Clients
export { BaseApiClient } from './base'
export { UsersApi, usersApi } from './users'
export { AuthApi, authApi } from './auth'

// Create unified api client instance
import { AuthApi } from './auth'
export const apiClient = {
  auth: new AuthApi()
}

// Types
export type * from './types/user'
export type * from './auth'