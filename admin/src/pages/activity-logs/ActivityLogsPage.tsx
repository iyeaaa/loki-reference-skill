import { Search, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useUsers } from "@/lib/api/hooks/users"
import { workspacesApi } from "@/lib/api/services/workspaces"
import { ActivityLogsFilters } from "./ActivityLogsFilters"
import { ActivityLogsTableWithPagination } from "./ActivityLogsTableWithPagination"

interface Workspace {
  id: string
  name: string
}

interface User {
  id: string
  username: string
  email: string
}

export default function ActivityLogsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<string[]>([])
  const [selectedActions, setSelectedActions] = useState<string[]>([])
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([])
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  // Load users from API
  const { data: usersData } = useUsers({ limit: 1000 })
  const users: User[] =
    usersData?.users?.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
    })) || []

  // Load workspaces
  const loadWorkspaces = useCallback(async () => {
    try {
      const response = await workspacesApi.list({ limit: 1000 })
      setWorkspaces(
        response.workspaces.map((ws) => ({
          id: ws.id,
          name: ws.name,
        })),
      )
    } catch (error) {
      console.error("Failed to load workspaces:", error)
    }
  }, [])

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearchQuery(searchInput)
    }
  }

  const clearFilters = () => {
    setSelectedEntityTypes([])
    setSelectedActions([])
    setSelectedWorkspaces([])
    setSelectedUsers([])
    setSearchInput("")
    setSearchQuery("")
  }

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Filters */}
      <ActivityLogsFilters
        selectedEntityTypes={selectedEntityTypes}
        selectedActions={selectedActions}
        selectedWorkspaces={selectedWorkspaces}
        selectedUsers={selectedUsers}
        workspaces={workspaces}
        users={users}
        onEntityTypeChange={setSelectedEntityTypes}
        onActionChange={setSelectedActions}
        onWorkspaceChange={setSelectedWorkspaces}
        onUserChange={setSelectedUsers}
        onClearFilters={clearFilters}
      />

      {/* Activity Logs Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">활동 로그</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search input */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="엔티티 타입, 액션, ID로 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-10 pr-10 w-full"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("")
                    setSearchQuery("")
                  }}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Activity Logs Table with Pagination */}
          <ActivityLogsTableWithPagination
            searchQuery={searchQuery}
            selectedEntityTypes={selectedEntityTypes}
            selectedActions={selectedActions}
            selectedWorkspaces={selectedWorkspaces}
            selectedUsers={selectedUsers}
          />
        </CardContent>
      </Card>
    </div>
  )
}
