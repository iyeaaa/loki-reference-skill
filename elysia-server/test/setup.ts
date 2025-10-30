import "dotenv/config"
import { Elysia } from "elysia"
import { leadImportRoutes } from "../src/routes/lead-import.routes"

/**
 * Create test app instance with lead import routes
 * This allows type-safe testing without starting the full server
 */
export const createTestApp = () => {
  return new Elysia().use(leadImportRoutes)
}

export type TestApp = ReturnType<typeof createTestApp>
