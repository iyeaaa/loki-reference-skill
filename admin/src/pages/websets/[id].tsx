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
  const initialSorting = useMemo<SortingState>(
    () => [
      { id: "matchingCriteriaCount", desc: true },
      { id: "createdAt", desc: false },
    ],
    [],
  )

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
        if (!row.criteriaAnswers) {
          return 0
        }
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
          if (answer === true) {
            return 2
          }
          if (answer === false) {
            return 1
          }
          return 0
        },
        header: () => (
          <div className="max-w-xs truncate font-medium text-sm" title={criteria}>
            {criteria}
          </div>
        ),
        cell: ({ row }) => {
          const answer = row.original.criteriaAnswers?.[index]
          return (
            <div className="text-center">
              {answer === true ? (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-100 font-semibold text-green-800 text-sm dark:bg-green-900/20 dark:text-green-200">
                  ✓
                </span>
              ) : answer === false ? (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-100 font-semibold text-red-800 text-sm dark:bg-red-900/20 dark:text-red-200">
                  ✗
                </span>
              ) : (
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 font-semibold text-gray-500 text-sm dark:bg-gray-700 dark:text-gray-400">
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
        <span className="text-gray-600 text-sm dark:text-gray-400">
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
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="text-gray-500 dark:text-gray-400">Invalid webset ID</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="h-8 w-8 animate-spin rounded-full border-blue-500 border-b-2" />
      </div>
    )
  }

  if (!webset) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="text-gray-500 dark:text-gray-400">Webset not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-3xl text-gray-900 dark:text-gray-100">
            {webset.title || "Untitled Webset"}
          </h1>
          <Button
            disabled={fillWebsetMutation.isPending}
            onClick={() => fillWebsetMutation.mutate()}
            size="lg"
          >
            {fillWebsetMutation.isPending ? "Filling..." : "Fill Webset"}
          </Button>
        </div>
        <div className="flex gap-4 text-gray-600 text-sm dark:text-gray-400">
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
        <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
          <h3 className="mb-3 font-semibold text-gray-500 text-sm uppercase dark:text-gray-400">
            Validation Criterias
          </h3>
          <ul className="space-y-2">
            {webset.criterias.map((criteria, index) => (
              <li
                className="flex items-start gap-2 text-gray-700 text-sm dark:text-gray-300"
                key={index}
              >
                <span className="font-semibold text-blue-500">{index + 1}.</span>
                <span>{criteria}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Rows Table */}
      <div className="rounded-lg bg-white shadow-sm dark:bg-gray-800">
        <div className="border-gray-200 border-b p-4 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 text-xl dark:text-gray-100">Webset Rows</h2>
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
                          className="select-none transition-opacity"
                          draggable
                          key={header.id}
                          onDragOver={handleDragOver}
                          onDragStart={() => handleDragStart(header.id)}
                          onDrop={() => handleDrop(header.id)}
                          style={{
                            width: header.getSize(),
                            opacity: draggedColumn === header.id ? 0.5 : 1,
                            cursor: "move",
                          }}
                        >
                          <button
                            className="flex w-full items-center gap-2"
                            onClick={header.column.getToggleSortingHandler()}
                            type="button"
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
              <div className="flex items-center justify-between gap-2 border-gray-200 border-t p-4 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 text-sm dark:text-gray-400">
                    Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                  </span>
                  <span className="text-gray-600 text-sm dark:text-gray-400">
                    ({rows.length} total rows)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    disabled={!table.getCanPreviousPage()}
                    onClick={() => table.setPageIndex(0)}
                    size="sm"
                    variant="outline"
                  >
                    {"<<"}
                  </Button>
                  <Button
                    disabled={!table.getCanPreviousPage()}
                    onClick={() => table.previousPage()}
                    size="sm"
                    variant="outline"
                  >
                    Previous
                  </Button>
                  <Button
                    disabled={!table.getCanNextPage()}
                    onClick={() => table.nextPage()}
                    size="sm"
                    variant="outline"
                  >
                    Next
                  </Button>
                  <Button
                    disabled={!table.getCanNextPage()}
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    size="sm"
                    variant="outline"
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
