import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react-router"
import { RouterProvider } from "react-router-dom"
import { useInitPersistence } from "@/lib/hooks/use-lead-discovery-persistence"
import { router } from "./router"

const queryClient = new QueryClient()

function App() {
  // Lead Discovery Service Worker + IndexedDB 초기화
  useInitPersistence()

  return (
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <RouterProvider router={router} />
      </NuqsAdapter>
    </QueryClientProvider>
  )
}

export default App
