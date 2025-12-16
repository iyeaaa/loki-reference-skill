import { useState } from "react"
import {
  ColumnFilterButton,
  ColumnFilterDate,
  ColumnFilterNumber,
  ColumnFilterSelect,
  ColumnFilterText,
  FilterPresetManager,
  FilterSummaryPanel,
} from "@/components/leads/filters"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ColumnFilter, FilterPreset } from "@/lib/api/types/lead-filters"

/**
 * Test page for manually testing all filter components
 * Navigate to: /test/filters
 */
export default function FilterComponentsTest() {
  const [textFilter, setTextFilter] = useState<ColumnFilter | null>(null)
  const [selectFilter, setSelectFilter] = useState<ColumnFilter | null>(null)
  const [numberFilter, setNumberFilter] = useState<ColumnFilter | null>(null)
  const [dateFilter, setDateFilter] = useState<ColumnFilter | null>(null)
  const [allFilters, setAllFilters] = useState<ColumnFilter[]>([])
  const [presets, setPresets] = useState<FilterPreset[]>([
    {
      id: "demo-1",
      name: "Active Leads",
      filters: [
        { field: "leadStatus", operator: "in", value: ["new", "contacted"] },
        { field: "leadScore", operator: "gte", value: 70 },
      ],
      createdAt: new Date().toISOString(),
    },
  ])

  // Mock loadOptions function for select filters
  const mockLoadOptions = async () => {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 800))

    return [
      { value: "new", label: "New", count: 145 },
      { value: "contacted", label: "Contacted", count: 89 },
      { value: "qualified", label: "Qualified", count: 34 },
      { value: "converted", label: "Converted", count: 12 },
      { value: "lost", label: "Lost", count: 23 },
    ]
  }

  const handleAddToFilters = (filter: ColumnFilter | null, filterType: string) => {
    if (filter) {
      // Add or update filter
      setAllFilters((prev) => {
        const filtered = prev.filter((f) => f.field !== filter.field)
        return [...filtered, filter]
      })
    } else {
      // Remove filter of this type
      setAllFilters((prev) => prev.filter((f) => f.field !== filterType))
    }
  }

  const handleRemoveFilter = (index: number) => {
    setAllFilters((prev) => prev.filter((_, i) => i !== index))
  }

  const handleClearAll = () => {
    setAllFilters([])
    setTextFilter(null)
    setSelectFilter(null)
    setNumberFilter(null)
    setDateFilter(null)
  }

  const handleSavePreset = (name: string) => {
    const newPreset: FilterPreset = {
      id: `preset-${Date.now()}`,
      name,
      filters: [...allFilters],
      createdAt: new Date().toISOString(),
    }
    setPresets((prev) => [...prev, newPreset])
  }

  const handleLoadPreset = (preset: FilterPreset) => {
    setAllFilters(preset.filters)
  }

  const handleDeletePreset = (id: string) => {
    setPresets((prev) => prev.filter((p) => p.id !== id))
  }

  const handleRenamePreset = (id: string, newName: string) => {
    setPresets((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)))
  }

  return (
    <div className="container mx-auto space-y-8 py-8">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">Filter Components Test Page</h1>
        <p className="mt-2 text-muted-foreground">
          Manually test all filter components and their interactions
        </p>
      </div>

      {/* Filter Summary and Preset Manager */}
      <div className="flex gap-4">
        <FilterPresetManager
          currentFilters={allFilters}
          onDeletePreset={handleDeletePreset}
          onLoadPreset={handleLoadPreset}
          onRenamePreset={handleRenamePreset}
          onSavePreset={handleSavePreset}
          presets={presets}
        />
      </div>

      {allFilters.length > 0 && (
        <FilterSummaryPanel
          filters={allFilters}
          onClearAll={handleClearAll}
          onRemoveFilter={handleRemoveFilter}
        />
      )}

      {/* Individual Component Tests */}
      <Tabs className="w-full" defaultValue="text">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="text">Text Filter</TabsTrigger>
          <TabsTrigger value="select">Select Filter</TabsTrigger>
          <TabsTrigger value="number">Number Filter</TabsTrigger>
          <TabsTrigger value="date">Date Filter</TabsTrigger>
          <TabsTrigger value="button">Filter Button</TabsTrigger>
        </TabsList>

        {/* Text Filter Test */}
        <TabsContent value="text">
          <Card>
            <CardHeader>
              <CardTitle>Text Filter Component</CardTitle>
              <CardDescription>
                Test text filtering with various operators (contains, equals, starts with, etc.)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <ColumnFilterText
                  field="companyName"
                  initialFilter={textFilter || undefined}
                  onFilterChange={(filter) => {
                    setTextFilter(filter)
                    handleAddToFilters(filter, "companyName")
                  }}
                />
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Current Filter State:</h3>
                <pre className="overflow-auto rounded-md bg-slate-950 p-4 text-slate-50 text-sm">
                  {JSON.stringify(textFilter, null, 2) || "null"}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Select Filter Test */}
        <TabsContent value="select">
          <Card>
            <CardHeader>
              <CardTitle>Select Filter Component</CardTitle>
              <CardDescription>
                Test multi-select filtering with search and async loading
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <ColumnFilterSelect
                  field="leadStatus"
                  initialFilter={selectFilter || undefined}
                  loadOptions={mockLoadOptions}
                  onFilterChange={(filter) => {
                    setSelectFilter(filter)
                    handleAddToFilters(filter, "leadStatus")
                  }}
                />
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Current Filter State:</h3>
                <pre className="overflow-auto rounded-md bg-slate-950 p-4 text-slate-50 text-sm">
                  {JSON.stringify(selectFilter, null, 2) || "null"}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Number Filter Test */}
        <TabsContent value="number">
          <Card>
            <CardHeader>
              <CardTitle>Number Filter Component</CardTitle>
              <CardDescription>
                Test number filtering with comparison operators and ranges
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <ColumnFilterNumber
                  field="leadScore"
                  initialFilter={numberFilter || undefined}
                  onFilterChange={(filter) => {
                    setNumberFilter(filter)
                    handleAddToFilters(filter, "leadScore")
                  }}
                />
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Current Filter State:</h3>
                <pre className="overflow-auto rounded-md bg-slate-950 p-4 text-slate-50 text-sm">
                  {JSON.stringify(numberFilter, null, 2) || "null"}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Date Filter Test */}
        <TabsContent value="date">
          <Card>
            <CardHeader>
              <CardTitle>Date Filter Component</CardTitle>
              <CardDescription>
                Test date filtering with calendar picker and preset ranges
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 p-4">
                <ColumnFilterDate
                  field="createdAt"
                  initialFilter={dateFilter || undefined}
                  onFilterChange={(filter) => {
                    setDateFilter(filter)
                    handleAddToFilters(filter, "createdAt")
                  }}
                />
              </div>

              <div>
                <h3 className="mb-2 font-semibold">Current Filter State:</h3>
                <pre className="overflow-auto rounded-md bg-slate-950 p-4 text-slate-50 text-sm">
                  {JSON.stringify(dateFilter, null, 2) || "null"}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Filter Button Test */}
        <TabsContent value="button">
          <Card>
            <CardHeader>
              <CardTitle>Filter Button Component</CardTitle>
              <CardDescription>
                Test the filter button that opens popovers with different filter types
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-lg border p-4">
                  <span className="w-32 font-medium">Text Field:</span>
                  <ColumnFilterButton
                    currentFilter={allFilters.find((f) => f.field === "companyName")}
                    field="companyName"
                    filterConfig={{
                      type: "text",
                      operators: ["contains", "equals", "startsWith"],
                    }}
                    onFilterChange={(filter) => handleAddToFilters(filter, "companyName")}
                  />
                  <Badge variant="outline">
                    {allFilters.find((f) => f.field === "companyName") ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 rounded-lg border p-4">
                  <span className="w-32 font-medium">Select Field:</span>
                  <ColumnFilterButton
                    currentFilter={allFilters.find((f) => f.field === "leadStatus")}
                    field="leadStatus"
                    filterConfig={{
                      type: "select",
                      operators: ["in", "notIn"],
                      loadOptions: mockLoadOptions,
                    }}
                    onFilterChange={(filter) => handleAddToFilters(filter, "leadStatus")}
                  />
                  <Badge variant="outline">
                    {allFilters.find((f) => f.field === "leadStatus") ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 rounded-lg border p-4">
                  <span className="w-32 font-medium">Number Field:</span>
                  <ColumnFilterButton
                    currentFilter={allFilters.find((f) => f.field === "leadScore")}
                    field="leadScore"
                    filterConfig={{
                      type: "number",
                      operators: ["equals", "gt", "lt", "between"],
                    }}
                    onFilterChange={(filter) => handleAddToFilters(filter, "leadScore")}
                  />
                  <Badge variant="outline">
                    {allFilters.find((f) => f.field === "leadScore") ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 rounded-lg border p-4">
                  <span className="w-32 font-medium">Date Field:</span>
                  <ColumnFilterButton
                    currentFilter={allFilters.find((f) => f.field === "createdAt")}
                    field="createdAt"
                    filterConfig={{
                      type: "date",
                      operators: ["between", "gt", "lt"],
                    }}
                    onFilterChange={(filter) => handleAddToFilters(filter, "createdAt")}
                  />
                  <Badge variant="outline">
                    {allFilters.find((f) => f.field === "createdAt") ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* All Filters Debug View */}
      <Card>
        <CardHeader>
          <CardTitle>All Active Filters (Debug View)</CardTitle>
          <CardDescription>
            This shows all currently active filters across all components
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-[400px] overflow-auto rounded-md bg-slate-950 p-4 text-slate-50 text-sm">
            {JSON.stringify(allFilters, null, 2) || "[]"}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
