import { Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { useQueryState } from "nuqs"
import { useEffect, useId, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCreateWebset, useGenerateCriteria } from "@/lib/api/hooks/websets"
import { useWorkspace } from "@/lib/hooks/useWorkspace"

const MAX_CRITERIAS = 5

export default function WebsetCriteriaPage() {
  const targetCountId = useId()
  const [query] = useQueryState("query", { defaultValue: "" })
  const [editableCriterias, setEditableCriterias] = useState<string[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState("")
  const [rewrittenQuery, setRewrittenQuery] = useState("")
  const [isEditingQuery, setIsEditingQuery] = useState(false)
  const [targetCount, setTargetCount] = useState<number>(10)
  const navigate = useNavigate()
  const { selectedWorkspace } = useWorkspace()

  const generateCriteriaMutation = useGenerateCriteria()
  const createWebsetMutation = useCreateWebset()

  useEffect(() => {
    if (generateCriteriaMutation.data) {
      setEditableCriterias(generateCriteriaMutation.data.validationCriteria || [])
      setRewrittenQuery(generateCriteriaMutation.data.rewrittenQuery || "")
    }
  }, [generateCriteriaMutation.data])

  useEffect(() => {
    if (createWebsetMutation.data?.id) {
      navigate(`/websets/${createWebsetMutation.data.id}`)
    }
  }, [createWebsetMutation.data, navigate])

  useEffect(() => {
    if (query) {
      generateCriteriaMutation.mutate(query)
    }
  }, [query, generateCriteriaMutation.mutate])

  const { data: criteriaResult, isPending, isError, error } = generateCriteriaMutation

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setEditValue(editableCriterias[index])
  }

  const handleSaveEdit = () => {
    if (editingIndex !== null && editValue.trim()) {
      const newCriterias = [...editableCriterias]
      newCriterias[editingIndex] = editValue.trim()
      setEditableCriterias(newCriterias)
      setEditingIndex(null)
      setEditValue("")
    }
  }

  const handleCancelEdit = () => {
    // If canceling a newly added empty criteria, remove it
    if (editingIndex !== null && !editableCriterias[editingIndex].trim()) {
      setEditableCriterias(editableCriterias.filter((_, i) => i !== editingIndex))
    }
    setEditingIndex(null)
    setEditValue("")
  }

  const handleDelete = (index: number) => {
    setEditableCriterias(editableCriterias.filter((_, i) => i !== index))
  }

  const handleAddNew = () => {
    if (editableCriterias.length < MAX_CRITERIAS) {
      setEditableCriterias([...editableCriterias, ""])
      setEditingIndex(editableCriterias.length)
      setEditValue("")
    }
  }

  const handleCreateWebset = () => {
    if (!selectedWorkspace?.id) {
      alert("Please select a workspace first")
      return
    }

    if (selectedWorkspace.id === "all") {
      alert("Please select a specific workspace (not 'All')")
      return
    }

    createWebsetMutation.mutate({
      workspaceId: selectedWorkspace.id,
      query: rewrittenQuery || query,
      title: query,
      criterias: editableCriterias,
      targetValidatedRows: targetCount,
    })
  }

  const handleEditQuery = () => {
    setIsEditingQuery(true)
  }

  const handleSaveQuery = () => {
    if (rewrittenQuery.trim()) {
      setIsEditingQuery(false)
    }
  }

  const handleCancelQueryEdit = () => {
    setRewrittenQuery(criteriaResult?.rewrittenQuery || "")
    setIsEditingQuery(false)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Left Half - Search Configuration */}
      <div className="w-1/2 p-6 border-r border-gray-200 dark:border-gray-700">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Search Configuration
        </h2>

        <div className="space-y-6">
          {/* Target Count Picker */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
            <label
              htmlFor={targetCountId}
              className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
            >
              Target Webset Count
            </label>
            <Input
              id={targetCountId}
              type="number"
              min="1"
              max="1000"
              value={targetCount}
              onChange={(e) => setTargetCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full"
              placeholder="Enter target count"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Number of validated companies to find (default: 10)
            </p>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              The system will search and validate companies until it reaches your target count.
            </p>
          </div>
        </div>
      </div>

      {/* Right Half - Criteria Result */}
      <div className="w-1/2 p-6 bg-gray-50 dark:bg-gray-900">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Query Analysis</h2>

        {isPending ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : isError ? (
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-800 dark:text-red-200">
              Error: {error?.message || "Failed to generate criteria"}
            </p>
          </div>
        ) : criteriaResult ? (
          <div className="space-y-6">
            {/* Original Query */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Original Query
              </h3>
              <p className="text-lg text-gray-900 dark:text-gray-100">{query}</p>
            </div>

            {/* Rewritten Query */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border-2 border-blue-500">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-blue-500 uppercase">Rewritten Query</h3>
                {!isEditingQuery && (
                  <Button
                    onClick={handleEditQuery}
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                  >
                    <Pencil className="h-3 w-3 text-blue-600" />
                  </Button>
                )}
              </div>
              {isEditingQuery ? (
                <div className="flex gap-2">
                  <Input
                    value={rewrittenQuery}
                    onChange={(e) => setRewrittenQuery(e.target.value)}
                    className="flex-1"
                    placeholder="Enter rewritten query"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveQuery()
                      if (e.key === "Escape") handleCancelQueryEdit()
                    }}
                  />
                  <Button
                    onClick={handleSaveQuery}
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 p-0"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    onClick={handleCancelQueryEdit}
                    size="sm"
                    variant="ghost"
                    className="h-9 w-9 p-0"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ) : (
                <p className="text-lg text-gray-900 dark:text-gray-100">{rewrittenQuery}</p>
              )}
            </div>

            {/* Criterias List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Criterias ({editableCriterias.length}/{MAX_CRITERIAS})
                </h3>
                <Button
                  onClick={handleAddNew}
                  disabled={editableCriterias.length >= MAX_CRITERIAS}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add
                </Button>
              </div>
              {editableCriterias.length > 0 ? (
                <ul className="space-y-2">
                  {editableCriterias.map((criteria, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-blue-500 font-semibold text-sm mt-2">{index + 1}.</span>
                      {editingIndex === index ? (
                        <div className="flex-1 flex gap-2">
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 h-8 text-sm"
                            placeholder="Enter criteria"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit()
                              if (e.key === "Escape") handleCancelEdit()
                            }}
                          />
                          <Button
                            onClick={handleSaveEdit}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            onClick={handleCancelEdit}
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-between gap-2 group">
                          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                            {criteria}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              onClick={() => handleEdit(index)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="h-3 w-3 text-blue-600" />
                            </Button>
                            <Button
                              onClick={() => handleDelete(index)}
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                            >
                              <Trash2 className="h-3 w-3 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No criterias yet. Click Add to create one.
                </p>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                The query has been analyzed and rewritten for better search results.
              </p>
            </div>

            {/* Create Webset Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleCreateWebset}
                disabled={
                  !selectedWorkspace?.id ||
                  editableCriterias.length === 0 ||
                  editableCriterias.some((c) => !c.trim()) ||
                  !rewrittenQuery.trim() ||
                  createWebsetMutation.isPending
                }
                size="lg"
                className="w-full"
              >
                {createWebsetMutation.isPending ? "Creating..." : "Create Webset"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-gray-500 dark:text-gray-400">No query provided</div>
        )}
      </div>
    </div>
  )
}
