import createClient from "openapi-react-query"
import { client } from "./client"

// Create typed React Query hooks
export const $api = createClient(client)
