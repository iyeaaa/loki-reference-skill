import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { client } from "../generated/client"

// Query: Get all websets
export function useWebsets(workspaceId: string, limit = 10, offset = 0) {
  return useQuery({
    queryKey: ["websets", workspaceId, limit, offset],
    queryFn: async () => {
      const { data, error } = await client.GET("/api/v1/websets/", {
        params: {
          query: {
            workspaceId,
            limit: String(limit),
            offset: String(offset),
          },
        },
      })
      if (error) throw error
      return data?.data
    },
    enabled: !!workspaceId && workspaceId !== "all",
  })
}

// Query: Get webset by ID
export function useWebset(id: string) {
  return useQuery({
    queryKey: ["webset", id],
    queryFn: async () => {
      const { data, error } = await client.GET("/api/v1/websets/{id}", {
        params: {
          path: { id },
        },
      })
      if (error) throw error
      return data?.data
    },
    enabled: !!id,
  })
}

// Query: Get webset rows
export function useWebsetRows(id: string, limit = 100, offset = 0) {
  return useQuery({
    queryKey: ["webset-rows", id, limit, offset],
    queryFn: async () => {
      const { data, error } = await client.GET("/api/v1/websets/{id}/rows", {
        params: {
          path: { id },
          query: {
            limit: String(limit),
            offset: String(offset),
          },
        },
      })
      if (error) throw error
      return data?.data
    },
    enabled: !!id,
    refetchInterval: 10000, // Refetch every 10 seconds
  })
}

// Mutation: Create webset
export function useCreateWebset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      workspaceId: string
      query: string
      title?: string
      criterias?: string[]
      targetValidatedRows?: number
    }) => {
      const { data: response, error } = await client.POST("/api/v1/websets/", {
        body: data,
      })
      if (error) throw error
      return response?.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["websets", variables.workspaceId],
      })
    },
  })
}

// Mutation: Update webset
export function useUpdateWebset(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      title?: string
      query?: string
      criterias?: string[]
      targetValidatedRows?: number
    }) => {
      const { data: response, error } = await client.PUT("/api/v1/websets/{id}", {
        params: {
          path: { id },
        },
        body: data,
      })
      if (error) throw error
      return response?.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webset", id] })
    },
  })
}

// Mutation: Delete webset
export function useDeleteWebset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await client.DELETE("/api/v1/websets/{id}", {
        params: {
          path: { id },
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["websets"] })
    },
  })
}

// Mutation: Run webset (fill)
export function useRunWebset(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await client.POST("/api/v1/websets/{id}/run", {
        params: {
          path: { id },
        },
      })
      if (error) throw error
      return data?.data
    },
    onSuccess: () => {
      // Invalidate both webset and rows queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["webset", id] })
      queryClient.invalidateQueries({ queryKey: ["webset-rows", id] })
    },
  })
}

// Mutation: Generate criteria
export function useGenerateCriteria() {
  return useMutation({
    mutationFn: async (query: string) => {
      const { data, error } = await client.POST("/api/v1/websets/criteria", {
        body: { query },
      })
      if (error) throw error
      return data?.data
    },
  })
}
