/**
 * Example Usage of Auto-Generated API Client
 *
 * This file demonstrates how to use the auto-generated openapi-react-query hooks
 * to replace manual API calls with fully type-safe, auto-generated ones.
 */

import { $api } from "./queries"

// ============================================================================
// Example 1: Simple GET Query
// ============================================================================
export function LeadsListExample() {
  const { data, isLoading, error } = $api.useQuery("get", "/api/v1/leads/search", {
    params: {
      query: {
        limit: "10",
        offset: "0",
        sortField: "createdAt",
        sortOrder: "desc",
      },
    },
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h2>Total Leads: {data?.data.total}</h2>
      {data?.data.data?.map((lead: any) => (
        <div key={lead.id}>
          {lead.companyName} - {lead.leadStatus}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Example 2: GET with Path Parameters
// ============================================================================
export function LeadDetailExample({ leadId }: { leadId: string }) {
  const { data, isLoading } = $api.useQuery("get", "/api/v1/leads/{id}", {
    params: {
      path: { id: leadId },
    },
  })

  if (isLoading) return <div>Loading lead...</div>

  // Type assertion needed due to OpenAPI schema limitations
  const lead = data as any

  return (
    <div>
      <h1>{lead?.companyName}</h1>
      <p>Status: {lead?.leadStatus}</p>
      <p>Score: {lead?.leadScore}</p>
    </div>
  )
}

// ============================================================================
// Example 3: POST Mutation (Create)
// ============================================================================
export function CreateLeadExample() {
  const { mutate, isPending } = $api.useMutation("post", "/api/v1/leads/")

  const handleCreate = () => {
    mutate({
      body: {
        workspaceId: "workspace-uuid",
        companyName: "Example Corp",
        leadStatus: "new",
        leadScore: 75,
        // All fields are type-safe!
      },
    })
  }

  return (
    <button type="button" onClick={handleCreate} disabled={isPending}>
      Create Lead
    </button>
  )
}

// ============================================================================
// Example 4: PUT Mutation (Update)
// ============================================================================
export function UpdateLeadExample({ leadId }: { leadId: string }) {
  const { mutate } = $api.useMutation("put", "/api/v1/leads/{id}")

  const handleUpdate = () => {
    mutate({
      params: {
        path: { id: leadId },
      },
      body: {
        leadStatus: "qualified",
        leadScore: 85,
        companyName: "Updated Company Name",
      },
    })
  }

  return (
    <button type="button" onClick={handleUpdate}>
      Update Lead
    </button>
  )
}

// ============================================================================
// Example 5: DELETE Mutation
// ============================================================================
export function DeleteLeadExample({ leadId }: { leadId: string }) {
  const { mutate, isPending } = $api.useMutation("delete", "/api/v1/leads/{id}")

  const handleDelete = () => {
    mutate({
      params: {
        path: { id: leadId },
      },
    })
  }

  return (
    <button type="button" onClick={handleDelete} disabled={isPending}>
      Delete Lead
    </button>
  )
}

// ============================================================================
// Example 6: With React Query Features (Caching, Invalidation)
// ============================================================================
import { useQueryClient } from "@tanstack/react-query"

export function CreateLeadWithInvalidation() {
  const queryClient = useQueryClient()

  const { mutate, isPending, isSuccess } = $api.useMutation("post", "/api/v1/leads/", {
    onSuccess: () => {
      // Invalidate and refetch leads list
      queryClient.invalidateQueries({
        queryKey: ["get", "/api/v1/leads/search"],
      })
    },
  })

  const handleCreate = () => {
    mutate({
      body: {
        workspaceId: "workspace-uuid",
        companyName: "New Lead",
        leadStatus: "new",
      },
    })
  }

  return (
    <div>
      <button type="button" onClick={handleCreate} disabled={isPending}>
        {isPending ? "Creating..." : "Create Lead"}
      </button>
      {isSuccess && <p>Lead created successfully!</p>}
    </div>
  )
}

// ============================================================================
// Example 7: Advanced Filtering with Column Filters
// ============================================================================
export function FilteredLeadsExample() {
  const columnFilters = [
    {
      field: "leadScore",
      operator: "gte" as const,
      value: 70,
    },
    {
      field: "leadStatus",
      operator: "in" as const,
      value: ["new", "qualified"],
    },
  ]

  const { data } = $api.useQuery("get", "/api/v1/leads/search", {
    params: {
      query: {
        filters: JSON.stringify(columnFilters),
        limit: "50",
      },
    },
  })

  return (
    <div>
      <h2>High-Value Leads ({data?.data.total})</h2>
      {data?.data.data?.map((lead: any) => (
        <div key={lead.id}>
          {lead.companyName} - Score: {lead.leadScore}
        </div>
      ))}
    </div>
  )
}

// ============================================================================
// Type Safety Examples (commented out to avoid unused variable warnings)
// ============================================================================

// ✅ This works - all types are correct
// function TypeSafeExample() {
//   $api.useQuery("get", "/api/v1/leads/search", {
//     params: {
//       query: {
//         limit: "10", // Must be string (matches API)
//         sortOrder: "desc", // Only "asc" | "desc" allowed
//       },
//     },
//   })
// }

// ❌ These will cause TypeScript errors:
// function TypeErrorExamples() {
//   // Error: limit must be string, not number
//   $api.useQuery("get", "/api/v1/leads/search", {
//     params: { query: { limit: 10 } }
//   })
//   // Error: invalid sort order
//   $api.useQuery("get", "/api/v1/leads/search", {
//     params: { query: { sortOrder: "invalid" } }
//   })
//   // Error: wrong endpoint path
//   $api.useQuery("get", "/api/v1/leads/wrong-path", {})
//   // Error: missing required body field
//   $api.useMutation("post", "/api/v1/leads/", {
//     body: { leadStatus: "new" } // missing workspaceId
//   })
// }
