// API Clients

export { AuthApi, authApi } from "./auth"
export { BaseApiClient } from "./base"
export { UsersApi, usersApi } from "./users"

// Create unified api client instance
import { AuthApi } from "./auth"
export const apiClient = {
  auth: new AuthApi(),
}

export type * from "./auth"
// Types
export type * from "./types/user"
