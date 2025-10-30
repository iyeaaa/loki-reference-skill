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
    if (!filter) {
      // Remove filter of this type
      setAllFilters((prev) => prev.filter((f) => f.field !== filterType))
    } else {
      // Add or update filter
      setAllFilters((prev) => {
        const filtered = prev.filter((f) => f.field !== filter.field)
        return [...filtered, filter]
      })
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
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Filter Components Test Page</h1>
        <p className="text-muted-foreground mt-2">
          Manually test all filter components and their interactions
        </p>
      </div>

      {/* Filter Summary and Preset Manager */}
      <div className="flex gap-4">
        <FilterPresetManager
          presets={presets}
          currentFilters={allFilters}
          onLoadPreset={handleLoadPreset}
          onSavePreset={handleSavePreset}
          onDeletePreset={handleDeletePreset}
          onRenamePreset={handleRenamePreset}
        />
      </div>

      {allFilters.length > 0 && (
        <FilterSummaryPanel
          filters={allFilters}
          onRemoveFilter={handleRemoveFilter}
          onClearAll={handleClearAll}
        />
      )}

      {/* Individual Component Tests */}
      <Tabs defaultValue="text" className="w-full">
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
              <div className="border rounded-lg p-4 bg-muted/50">
                <ColumnFilterText
                  field="companyName"
                  onFilterChange={(filter) => {
                    setTextFilter(filter)
                    handleAddToFilters(filter, "companyName")
                  }}
                  initialFilter={textFilter || undefined}
                />
              </div>

              <div>
                <h3 className="font-semibold mb-2">Current Filter State:</h3>
                <pre className="bg-slate-950 text-slate-50 p-4 rounded-md text-sm overflow-auto">
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
              <div className="border rounded-lg p-4 bg-muted/50">
                <ColumnFilterSelect
                  field="leadStatus"
                  onFilterChange={(filter) => {
                    setSelectFilter(filter)
                    handleAddToFilters(filter, "leadStatus")
                  }}
                  initialFilter={selectFilter || undefined}
                  loadOptions={mockLoadOptions}
                />
              </div>

              <div>
                <h3 className="font-semibold mb-2">Current Filter State:</h3>
                <pre className="bg-slate-950 text-slate-50 p-4 rounded-md text-sm overflow-auto">
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
              <div className="border rounded-lg p-4 bg-muted/50">
                <ColumnFilterNumber
                  field="leadScore"
                  onFilterChange={(filter) => {
                    setNumberFilter(filter)
                    handleAddToFilters(filter, "leadScore")
                  }}
                  initialFilter={numberFilter || undefined}
                />
              </div>

              <div>
                <h3 className="font-semibold mb-2">Current Filter State:</h3>
                <pre className="bg-slate-950 text-slate-50 p-4 rounded-md text-sm overflow-auto">
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
              <div className="border rounded-lg p-4 bg-muted/50">
                <ColumnFilterDate
                  field="createdAt"
                  onFilterChange={(filter) => {
                    setDateFilter(filter)
                    handleAddToFilters(filter, "createdAt")
                  }}
                  initialFilter={dateFilter || undefined}
                />
              </div>

              <div>
                <h3 className="font-semibold mb-2">Current Filter State:</h3>
                <pre className="bg-slate-950 text-slate-50 p-4 rounded-md text-sm overflow-auto">
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
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <span className="font-medium w-32">Text Field:</span>
                  <ColumnFilterButton
                    field="companyName"
                    filterConfig={{
                      type: "text",
                      operators: ["contains", "equals", "startsWith"],
                    }}
                    currentFilter={allFilters.find((f) => f.field === "companyName")}
                    onFilterChange={(filter) => handleAddToFilters(filter, "companyName")}
                  />
                  <Badge variant="outline">
                    {allFilters.find((f) => f.field === "companyName") ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <span className="font-medium w-32">Select Field:</span>
                  <ColumnFilterButton
                    field="leadStatus"
                    filterConfig={{
                      type: "select",
                      operators: ["in", "notIn"],
                      loadOptions: mockLoadOptions,
                    }}
                    currentFilter={allFilters.find((f) => f.field === "leadStatus")}
                    onFilterChange={(filter) => handleAddToFilters(filter, "leadStatus")}
                  />
                  <Badge variant="outline">
                    {allFilters.find((f) => f.field === "leadStatus") ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <span className="font-medium w-32">Number Field:</span>
                  <ColumnFilterButton
                    field="leadScore"
                    filterConfig={{
                      type: "number",
                      operators: ["equals", "gt", "lt", "between"],
                    }}
                    currentFilter={allFilters.find((f) => f.field === "leadScore")}
                    onFilterChange={(filter) => handleAddToFilters(filter, "leadScore")}
                  />
                  <Badge variant="outline">
                    {allFilters.find((f) => f.field === "leadScore") ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <span className="font-medium w-32">Date Field:</span>
                  <ColumnFilterButton
                    field="createdAt"
                    filterConfig={{
                      type: "date",
                      operators: ["between", "gt", "lt"],
                    }}
                    currentFilter={allFilters.find((f) => f.field === "createdAt")}
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
          <pre className="bg-slate-950 text-slate-50 p-4 rounded-md text-sm overflow-auto max-h-[400px]">
            {JSON.stringify(allFilters, null, 2) || "[]"}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
