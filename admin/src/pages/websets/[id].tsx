import {
  type ColumnDef,
  type ColumnFiltersState,
  type ColumnOrderState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useRunWebset, useWebset, useWebsetRows } from "@/lib/api/hooks/websets"

type WebsetRow = {
  id: string
  websetId: string
  data: {
    [key: string]: unknown
  }
  criteriaAnswers?: boolean[] | null | undefined
  createdAt: string
  updatedAt: string
}

export default function WebsetDetailPage() {
  const { id } = useParams<{ id: string }>()

  const { data: webset, isLoading: websetLoading } = useWebset(id || "")
  const { data: rowsData, isLoading: rowsLoading } = useWebsetRows(id || "")
  const fillWebsetMutation = useRunWebset(id || "")

  const rows = rowsData?.rows || []
  const isLoading = websetLoading || rowsLoading

  // Sort by number of matching criteria, then by created at ascending
  const initialSorting = useMemo<SortingState>(() => {
    return [
      { id: "matchingCriteriaCount", desc: true },
      { id: "createdAt", desc: false },
    ]
  }, [])

  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)

  // Extract unique data keys from all rows
  const dataKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const row of rows) {
      for (const key of Object.keys(row.data)) {
        keys.add(key)
      }
    }
    return Array.from(keys).sort()
  }, [rows])

  // Define columns using useMemo
  const columns = useMemo<ColumnDef<WebsetRow>[]>(() => {
    const baseColumns: ColumnDef<WebsetRow>[] = [
      {
        accessorKey: "index",
        header: "#",
        cell: ({ row }) => <span className="font-medium">{row.index + 1}</span>,
        size: 50,
      },
    ]

    // Add dynamic columns for each data key
    const dataColumns: ColumnDef<WebsetRow>[] = dataKeys.map((key) => ({
      id: `data-${key}`,
      accessorFn: (row) => row.data[key],
      header: () => (
        <div className="font-semibold capitalize" title={key}>
          {key}
        </div>
      ),
      cell: ({ row }) => {
        const value = row.original.data[key]
        return (
          <div className="max-w-xs truncate" title={String(value)}>
            {typeof value === "object" ? JSON.stringify(value) : String(value ?? "")}
          </div>
        )
      },
    }))

    // Add hidden column for sorting by matching criteria count
    const matchingCountColumn: ColumnDef<WebsetRow> = {
      id: "matchingCriteriaCount",
      accessorFn: (row) => {
        if (!row.criteriaAnswers) return 0
        return row.criteriaAnswers.filter((answer) => answer === true).length
      },
      header: () => null,
      cell: () => null,
      size: 0,
    }

    // Add criteria columns dynamically
    const criteriaColumns: ColumnDef<WebsetRow>[] =
      webset?.criterias?.map((criteria, index) => ({
        id: `criteria-${index}`,
        accessorFn: (row) => {
          const answer = row.criteriaAnswers?.[index]
          // Convert to number for sorting: true=2, false=1, null/undefined=0
          if (answer === true) return 2
          if (answer === false) return 1
          return 0
        },
        header: () => (
          <div className="text-sm font-medium max-w-xs truncate" title={criteria}>
            {criteria}
          </div>
        ),
        cell: ({ row }) => {
          const answer = row.original.criteriaAnswers?.[index]
          return (
            <div className="text-center">
              {answer === true ? (
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200">
                  ✓
                </span>
              ) : answer === false ? (
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200">
                  ✗
                </span>
              ) : (
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  ?
                </span>
              )}
            </div>
          )
        },
        size: 200,
      })) || []

    const createdAtColumn: ColumnDef<WebsetRow> = {
      accessorKey: "createdAt",
      header: "Created At",
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {new Date(row.original.createdAt).toLocaleString()}
        </span>
      ),
      size: 180,
    }

    return [
      matchingCountColumn,
      ...baseColumns,
      ...dataColumns,
      ...criteriaColumns,
      createdAtColumn,
    ]
  }, [webset?.criterias, dataKeys])

  // Handle column drag and drop
  const handleDragStart = (columnId: string) => {
    setDraggedColumn(columnId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (targetColumnId: string) => {
    if (!draggedColumn || draggedColumn === targetColumnId) {
      setDraggedColumn(null)
      return
    }

    const currentOrder = table.getState().columnOrder
    const actualOrder =
      currentOrder.length > 0 ? currentOrder : table.getAllLeafColumns().map((col) => col.id)

    const draggedIndex = actualOrder.indexOf(draggedColumn)
    const targetIndex = actualOrder.indexOf(targetColumnId)

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedColumn(null)
      return
    }

    const newOrder = [...actualOrder]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedColumn)

    setColumnOrder(newOrder)
    setDraggedColumn(null)
  }

  // Initialize table
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
    state: {
      sorting,
      columnFilters,
      columnOrder,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  })

  if (!id) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <div className="text-gray-500 dark:text-gray-400">Invalid webset ID</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    )
  }

  if (!webset) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
        <div className="text-gray-500 dark:text-gray-400">Webset not found</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {webset.title || "Untitled Webset"}
          </h1>
          <Button
            onClick={() => fillWebsetMutation.mutate()}
            disabled={fillWebsetMutation.isPending}
            size="lg"
          >
            {fillWebsetMutation.isPending ? "Filling..." : "Fill Webset"}
          </Button>
        </div>
        <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            <span className="font-semibold">Query:</span> {webset.query}
          </div>
          <div>
            <span className="font-semibold">Rows:</span> {rowsData?.total || 0}
          </div>
          {webset.targetValidatedRows && (
            <div>
              <span className="font-semibold">Target:</span> {webset.targetValidatedRows}
            </div>
          )}
        </div>
      </div>

      {/* Criterias */}
      {webset.criterias && webset.criterias.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3">
            Validation Criterias
          </h3>
          <ul className="space-y-2">
            {webset.criterias.map((criteria, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <span className="text-blue-500 font-semibold">{index + 1}.</span>
                <span>{criteria}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rows Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Webset Rows</h2>
        </div>
        <div className="overflow-x-auto">
          {rows.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          draggable
                          style={{
                            width: header.getSize(),
                            opacity: draggedColumn === header.id ? 0.5 : 1,
                            cursor: "move",
                          }}
                          className="select-none transition-opacity"
                          onDragStart={() => handleDragStart(header.id)}
                          onDragOver={handleDragOver}
                          onDrop={() => handleDrop(header.id)}
                        >
                          <button
                            type="button"
                            className="flex items-center gap-2 w-full"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            <span className="text-gray-400">⋮⋮</span>
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </button>
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    ({rows.length} total rows)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    {"<<"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    Next
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    {">>"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No rows found for this webset.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
