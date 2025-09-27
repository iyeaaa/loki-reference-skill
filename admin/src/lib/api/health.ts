import { publicApi } from "./public"

export const healthApi = {
  check: async () => {
    const response = await publicApi.get("/health")
    return response.data
  },
}
