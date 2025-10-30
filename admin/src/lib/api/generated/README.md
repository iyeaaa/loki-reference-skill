# Auto-Generated API Client

This directory contains auto-generated TypeScript types and React Query hooks from the backend OpenAPI/Swagger specification.

## Files

- **schema.ts** - TypeScript types generated from OpenAPI schema
- **client.ts** - Configured `openapi-fetch` client with auth interceptors
- **queries.ts** - React Query hooks created with `openapi-react-query`
- **index.ts** - Re-exports for easy importing

## Usage

### Regenerate Types

When the backend API changes, regenerate the types:

```bash
yarn openapi:generate
```

Make sure the backend server is running on `http://localhost:3001` before running this command.

### Using in Components

#### Query Example (GET request)

```tsx
import { $api } from '@/lib/api/generated'

function LeadsPage() {
  const { data, isLoading, error } = $api.useQuery('get', '/api/v1/leads/search', {
    params: {
      query: {
        limit: '10',
        offset: '0',
        leadStatus: 'new',
      }
    }
  })

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      {data?.data?.map(lead => (
        <div key={lead.id}>{lead.companyName}</div>
      ))}
    </div>
  )
}
```

#### Mutation Example (POST/PUT/DELETE requests)

```tsx
import { $api } from '@/lib/api/generated'
import { useQueryClient } from '@tanstack/react-query'

function CreateLeadForm() {
  const queryClient = useQueryClient()

  const { mutate, isPending } = $api.useMutation('post', '/api/v1/leads/', {
    onSuccess: () => {
      // Invalidate and refetch leads
      queryClient.invalidateQueries({ queryKey: ['get', '/api/v1/leads/search'] })
    }
  })

  const handleSubmit = (formData: LeadInput) => {
    mutate({
      body: {
        workspaceId: 'workspace-id',
        companyName: formData.companyName,
        // ... other fields
      }
    })
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault()
      handleSubmit(/* data */)
    }}>
      {/* form fields */}
      <button disabled={isPending}>Create Lead</button>
    </form>
  )
}
```

#### Using the Raw Client

For more control, use the raw `openapi-fetch` client:

```tsx
import { client } from '@/lib/api/generated'

async function fetchLeadById(id: string) {
  const { data, error } = await client.GET('/api/v1/leads/{id}', {
    params: {
      path: { id }
    }
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
```

## Type Safety

All API requests are fully type-safe:

- **Request parameters** - Path, query, header, and body parameters are typed
- **Response data** - Response structures match backend schemas exactly
- **Enums** - All enum values are typed as string literals
- **Validation** - TypeScript will catch mismatched types at compile time

## Configuration

### Environment Variables

Set the API base URL in your `.env` file:

```bash
VITE_API_BASE_URL=http://localhost:3001
```

For production:

```bash
VITE_API_BASE_URL=https://api.production.com
```

If not set, defaults to `http://localhost:3001`.

## Authentication

The client automatically:
- Adds `Authorization: Bearer <token>` header from `localStorage.getItem('token')`
- Redirects to `/login` on 401 Unauthorized responses
- Sets `Content-Type: application/json` by default

## Benefits

- **100% type safety** - No manual type definitions needed
- **Always in sync** - Types match backend exactly
- **Autocomplete** - Full IntelliSense for all endpoints and parameters
- **Compile-time errors** - Catch API mismatches before runtime
- **React Query integration** - Automatic caching, refetching, optimistic updates

## Dependencies

- `openapi-typescript` - Generates TypeScript types from OpenAPI
- `openapi-fetch` - Type-safe fetch client
- `openapi-react-query` - React Query hooks generator
- `@tanstack/react-query` - Data fetching and caching
