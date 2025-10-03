import { Elysia } from "elysia"
import logger from "../utils/logger"

export const simpleLogger = new Elysia({ name: "simple-logger" }).onRequest(({ request }) => {
  const method = request.method
  const url = new URL(request.url)
  const path = url.pathname

  logger.info({ method, path }, "HTTP request")
})
