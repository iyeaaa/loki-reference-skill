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
      <div className="w-1/2 border-gray-200 border-r p-6 dark:border-gray-700">
        <h2 className="mb-4 font-bold text-2xl text-gray-900 dark:text-gray-100">
          Search Configuration
        </h2>

        <div className="space-y-6">
          {/* Target Count Picker */}
          <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
            <label
              className="mb-2 block font-semibold text-gray-700 text-sm dark:text-gray-300"
              htmlFor={targetCountId}
            >
              Target Webset Count
            </label>
            <Input
              className="w-full"
              id={targetCountId}
              max="1000"
              min="1"
              onChange={(e) =>
                setTargetCount(Math.max(1, Number.parseInt(e.target.value, 10) || 1))
              }
              placeholder="Enter target count"
              type="number"
              value={targetCount}
            />
            <p className="mt-2 text-gray-500 text-xs dark:text-gray-400">
              Number of validated companies to find (default: 10)
            </p>
          </div>

          {/* Info Box */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-blue-800 text-sm dark:text-blue-200">
              The system will search and validate companies until it reaches your target count.
            </p>
          </div>
        </div>
      </div>

      {/* Right Half - Criteria Result */}
      <div className="w-1/2 bg-gray-50 p-6 dark:bg-gray-900">
        <h2 className="mb-6 font-bold text-2xl text-gray-900 dark:text-gray-100">Query Analysis</h2>

        {isPending ? (
          <div className="flex h-40 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-blue-500 border-b-2" />
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
            <p className="text-red-800 text-sm dark:text-red-200">
              Error: {error?.message || "Failed to generate criteria"}
            </p>
          </div>
        ) : criteriaResult ? (
          <div className="space-y-6">
            {/* Original Query */}
            <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
              <h3 className="mb-2 font-semibold text-gray-500 text-sm uppercase dark:text-gray-400">
                Original Query
              </h3>
              <p className="text-gray-900 text-lg dark:text-gray-100">{query}</p>
            </div>

            {/* Rewritten Query */}
            <div className="rounded-lg border-2 border-blue-500 bg-white p-4 shadow-sm dark:bg-gray-800">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-blue-500 text-sm uppercase">Rewritten Query</h3>
                {!isEditingQuery && (
                  <Button
                    className="h-7 w-7 p-0"
                    onClick={handleEditQuery}
                    size="sm"
                    variant="ghost"
                  >
                    <Pencil className="h-3 w-3 text-blue-600" />
                  </Button>
                )}
              </div>
              {isEditingQuery ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    className="flex-1"
                    onChange={(e) => setRewrittenQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveQuery()
                      }
                      if (e.key === "Escape") {
                        handleCancelQueryEdit()
                      }
                    }}
                    placeholder="Enter rewritten query"
                    value={rewrittenQuery}
                  />
                  <Button
                    className="h-9 w-9 p-0"
                    onClick={handleSaveQuery}
                    size="sm"
                    variant="ghost"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button
                    className="h-9 w-9 p-0"
                    onClick={handleCancelQueryEdit}
                    size="sm"
                    variant="ghost"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ) : (
                <p className="text-gray-900 text-lg dark:text-gray-100">{rewrittenQuery}</p>
              )}
            </div>

            {/* Criterias List */}
            <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-gray-500 text-sm uppercase dark:text-gray-400">
                  Criterias ({editableCriterias.length}/{MAX_CRITERIAS})
                </h3>
                <Button
                  className="h-7 text-xs"
                  disabled={editableCriterias.length >= MAX_CRITERIAS}
                  onClick={handleAddNew}
                  size="sm"
                  variant="outline"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Add
                </Button>
              </div>
              {editableCriterias.length > 0 ? (
                <ul className="space-y-2">
                  {editableCriterias.map((criteria, index) => (
                    <li className="flex items-start gap-2" key={index}>
                      <span className="mt-2 font-semibold text-blue-500 text-sm">{index + 1}.</span>
                      {editingIndex === index ? (
                        <div className="flex flex-1 gap-2">
                          <Input
                            autoFocus
                            className="h-8 flex-1 text-sm"
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit()
                              }
                              if (e.key === "Escape") {
                                handleCancelEdit()
                              }
                            }}
                            placeholder="Enter criteria"
                            value={editValue}
                          />
                          <Button
                            className="h-8 w-8 p-0"
                            onClick={handleSaveEdit}
                            size="sm"
                            variant="ghost"
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            className="h-8 w-8 p-0"
                            onClick={handleCancelEdit}
                            size="sm"
                            variant="ghost"
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <div className="group flex flex-1 items-center justify-between gap-2">
                          <span className="flex-1 text-gray-700 text-sm dark:text-gray-300">
                            {criteria}
                          </span>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              className="h-7 w-7 p-0"
                              onClick={() => handleEdit(index)}
                              size="sm"
                              variant="ghost"
                            >
                              <Pencil className="h-3 w-3 text-blue-600" />
                            </Button>
                            <Button
                              className="h-7 w-7 p-0"
                              onClick={() => handleDelete(index)}
                              size="sm"
                              variant="ghost"
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
                <p className="text-gray-500 text-sm dark:text-gray-400">
                  No criterias yet. Click Add to create one.
                </p>
              )}
            </div>

            {/* Info Box */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-blue-800 text-sm dark:text-blue-200">
                The query has been analyzed and rewritten for better search results.
              </p>
            </div>

            {/* Create Webset Button */}
            <div className="flex justify-end">
              <Button
                className="w-full"
                disabled={
                  !selectedWorkspace?.id ||
                  editableCriterias.length === 0 ||
                  editableCriterias.some((c) => !c.trim()) ||
                  !rewrittenQuery.trim() ||
                  createWebsetMutation.isPending
                }
                onClick={handleCreateWebset}
                size="lg"
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
