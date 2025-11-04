import type { ColumnDef, RowData } from "@tanstack/react-table"
import { formatDistanceToNow } from "date-fns"
import { ColumnSelector } from "@/components/leads/ColumnSelector"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { leadsApi } from "@/lib/api/services/leads"
import type { Lead, LeadStatus } from "@/lib/api/types/lead"
import type { ColumnFilter, ColumnFilterConfig } from "@/lib/api/types/lead-filters"
import { AVAILABLE_COLUMNS } from "@/lib/column-visibility"
import { FilterableColumnHeader } from "./FilterableColumnHeader"

// Extend TanStack Table meta types
declare module "@tanstack/react-table" {
  // biome-ignore lint/correctness/noUnusedVariables: Must match TanStack Table's type parameters exactly
  interface ColumnMeta<TData extends RowData, TValue> {
    filterConfig?: ColumnFilterConfig
  }
}

// Lead Status Badge Component
function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const statusConfig: Record<
    LeadStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    new: { label: "New", variant: "default" },
    contacted: { label: "Contacted", variant: "secondary" },
    qualified: { label: "Qualified", variant: "outline" },
    unqualified: { label: "Unqualified", variant: "destructive" },
    converted: { label: "Converted", variant: "default" },
    lost: { label: "Lost", variant: "destructive" },
    unsubscribed: { label: "Unsubscribed", variant: "outline" },
  }

  const config = statusConfig[status]
  return <Badge variant={config.variant}>{config.label}</Badge>
}

// Lead Score Display Component
function LeadScoreDisplay({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="text-muted-foreground">-</span>

  const getScoreColor = (value: number) => {
    if (value >= 80) return "text-green-600 dark:text-green-400"
    if (value >= 60) return "text-blue-600 dark:text-blue-400"
    if (value >= 40) return "text-yellow-600 dark:text-yellow-400"
    return "text-red-600 dark:text-red-400"
  }

  return <span className={`font-medium ${getScoreColor(score)}`}>{score}</span>
}

// Helper type for additional table meta
interface LeadsTableMeta {
  onToggleLead?: (leadId: string) => void
  onToggleAll?: () => void
  isSelectAllMode?: boolean
  allLeadsSelected?: boolean
  selectedLeads?: string[]
  // Filter support
  columnFilters?: ColumnFilter[]
  setColumnFilters?: (filters: ColumnFilter[] | ((prev: ColumnFilter[]) => ColumnFilter[])) => void
  // Filter context
  workspaceId?: string
  customerGroupId?: string
  // Column visibility
  visibleColumns?: string[]
  columnOrder?: string[]
  onAddColumn?: (columnId: string) => void
  onRemoveColumn?: (columnId: string) => void
  onReorderColumns?: (fromIndex: number, toIndex: number) => void
}

// Helper function to create filter change handler
function createFilterChangeHandler(columnId: string, meta: LeadsTableMeta | undefined) {
  return (filter: ColumnFilter | null) => {
    if (!meta?.setColumnFilters) return

    if (filter) {
      // Add or update filter
      meta.setColumnFilters((prev) => {
        const filtered = prev.filter((f) => f.field !== columnId)
        return [...filtered, filter]
      })
    } else {
      // Remove filter
      meta.setColumnFilters((prev) => prev.filter((f) => f.field !== columnId))
    }
  }
}

// Helper function to create column header with remove button
function createColumnHeader(
  columnId: string,
  title: string,
  meta: LeadsTableMeta | undefined,
  currentFilter: ColumnFilter | undefined,
  filterConfig: ColumnFilterConfig | undefined,
  // biome-ignore lint/suspicious/noExplicitAny: Column type from TanStack Table is complex
  column: any,
) {
  const columnDef = AVAILABLE_COLUMNS.find((col) => col.id === columnId)

  return (
    <FilterableColumnHeader
      column={column}
      title={title}
      filterConfig={filterConfig}
      currentFilter={currentFilter}
      onFilterChange={createFilterChangeHandler(columnId, meta)}
      workspaceId={meta?.workspaceId}
      customerGroupId={meta?.customerGroupId}
      canRemove={columnDef?.canHide}
      onRemove={() => meta?.onRemoveColumn?.(columnId)}
    />
  )
}

// Column definitions for Leads Table
export const leadsColumns: ColumnDef<Lead>[] = [
  {
    id: "select",
    header: ({ table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const checked = meta?.isSelectAllMode
        ? meta?.allLeadsSelected
        : table.getIsAllPageRowsSelected()

      return (
        <Checkbox
          checked={checked}
          onCheckedChange={() => meta?.onToggleAll?.()}
          aria-label="Select all"
        />
      )
    },
    cell: ({ row, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const leadId = row.original.id
      const checked = meta?.isSelectAllMode
        ? meta?.allLeadsSelected || meta?.selectedLeads?.includes(leadId)
        : row.getIsSelected()

      return (
        <Checkbox
          checked={checked}
          onCheckedChange={() => meta?.onToggleLead?.(leadId)}
          aria-label="Select row"
        />
      )
    },
    enableSorting: false,
    enableColumnFilter: false,
  },
  {
    accessorKey: "companyName",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)
      const columnDef = AVAILABLE_COLUMNS.find((col) => col.id === column.id)

      return (
        <FilterableColumnHeader
          column={column}
          title="Company Name"
          filterConfig={column.columnDef.meta?.filterConfig}
          currentFilter={currentFilter}
          onFilterChange={createFilterChangeHandler(column.id, meta)}
          workspaceId={meta?.workspaceId}
          customerGroupId={meta?.customerGroupId}
          canRemove={columnDef?.canHide}
          onRemove={() => meta?.onRemoveColumn?.(column.id)}
        />
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "text",
        operators: ["contains", "equals", "startsWith", "endsWith", "isEmpty", "isNotEmpty"],
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => {
      const companyName = row.original.companyName
      return (
        <div className="flex flex-col">
          <span className="font-medium">{companyName || "-"}</span>
          {row.original.foundCompanyName && row.original.foundCompanyName !== companyName && (
            <span className="text-xs text-muted-foreground">{row.original.foundCompanyName}</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "contactName",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)
      const columnDef = AVAILABLE_COLUMNS.find((col) => col.id === column.id)

      return (
        <FilterableColumnHeader
          column={column}
          title="Contact"
          filterConfig={column.columnDef.meta?.filterConfig}
          currentFilter={currentFilter}
          onFilterChange={createFilterChangeHandler(column.id, meta)}
          workspaceId={meta?.workspaceId}
          customerGroupId={meta?.customerGroupId}
          canRemove={columnDef?.canHide}
          onRemove={() => meta?.onRemoveColumn?.(column.id)}
        />
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "text",
        operators: ["contains", "equals", "isEmpty", "isNotEmpty"],
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => row.original.contactName || "-",
  },
  {
    id: "email",
    accessorFn: (row) => {
      const emailContact = row.contacts?.find((c) => c.contactType === "email")
      return emailContact?.contactValue || row.createdByEmail
    },
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === "email")
      const columnDef = AVAILABLE_COLUMNS.find((col) => col.id === "email")

      return (
        <FilterableColumnHeader
          column={column}
          title="Email"
          filterConfig={column.columnDef.meta?.filterConfig}
          currentFilter={currentFilter}
          onFilterChange={createFilterChangeHandler("email", meta)}
          workspaceId={meta?.workspaceId}
          customerGroupId={meta?.customerGroupId}
          canRemove={columnDef?.canHide}
          onRemove={() => meta?.onRemoveColumn?.("email")}
        />
      )
    },
    enableSorting: false,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "text",
        operators: ["contains", "equals", "isEmpty", "isNotEmpty"],
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => {
      const emailContact = row.original.contacts?.find((c) => c.contactType === "email")
      const email = emailContact?.contactValue || row.original.createdByEmail
      return email || "-"
    },
  },
  {
    accessorKey: "leadStatus",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)
      const columnDef = AVAILABLE_COLUMNS.find((col) => col.id === column.id)

      return (
        <FilterableColumnHeader
          column={column}
          title="Status"
          filterConfig={column.columnDef.meta?.filterConfig}
          currentFilter={currentFilter}
          onFilterChange={createFilterChangeHandler(column.id, meta)}
          workspaceId={meta?.workspaceId}
          customerGroupId={meta?.customerGroupId}
          canRemove={columnDef?.canHide}
          onRemove={() => meta?.onRemoveColumn?.(column.id)}
        />
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "enum",
        operators: ["in", "notIn", "equals"],
        loadOptions: async (context?: {
          workspaceId?: string
          customerGroupId?: string
          signal?: AbortSignal
        }) => {
          try {
            const response = await leadsApi.getFilterOptions(
              "leadStatus",
              context?.workspaceId || undefined,
              context?.customerGroupId || undefined,
              context?.signal,
            )
            return response.options
          } catch (error) {
            console.error("Failed to load leadStatus filter options:", error)
            return []
          }
        },
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => <LeadStatusBadge status={row.original.leadStatus} />,
  },
  {
    accessorKey: "leadScore",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)
      const columnDef = AVAILABLE_COLUMNS.find((col) => col.id === column.id)

      return (
        <FilterableColumnHeader
          column={column}
          title="Score"
          filterConfig={column.columnDef.meta?.filterConfig}
          currentFilter={currentFilter}
          onFilterChange={createFilterChangeHandler(column.id, meta)}
          workspaceId={meta?.workspaceId}
          customerGroupId={meta?.customerGroupId}
          canRemove={columnDef?.canHide}
          onRemove={() => meta?.onRemoveColumn?.(column.id)}
        />
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "number",
        operators: ["equals", "gt", "lt", "gte", "lte", "between", "isEmpty"],
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => <LeadScoreDisplay score={row.original.leadScore} />,
  },
  {
    accessorKey: "country",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)

      return createColumnHeader(
        column.id,
        "Country",
        meta,
        currentFilter,
        column.columnDef.meta?.filterConfig,
        column,
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "select",
        operators: ["in", "notIn", "equals", "isEmpty"],
        loadOptions: async (context?: {
          workspaceId?: string
          customerGroupId?: string
          signal?: AbortSignal
        }) => {
          try {
            const response = await leadsApi.getFilterOptions(
              "country",
              context?.workspaceId || undefined,
              context?.customerGroupId || undefined,
              context?.signal,
            )
            return response.options
          } catch (error) {
            console.error("Failed to load country filter options:", error)
            return []
          }
        },
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => row.original.country || "-",
  },
  {
    accessorKey: "city",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)

      return createColumnHeader(
        column.id,
        "City",
        meta,
        currentFilter,
        column.columnDef.meta?.filterConfig,
        column,
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "select",
        operators: ["in", "notIn", "equals", "isEmpty"],
        loadOptions: async (context?: {
          workspaceId?: string
          customerGroupId?: string
          signal?: AbortSignal
        }) => {
          try {
            const response = await leadsApi.getFilterOptions(
              "city",
              context?.workspaceId || undefined,
              context?.customerGroupId || undefined,
              context?.signal,
            )
            return response.options
          } catch (error) {
            console.error("Failed to load city filter options:", error)
            return []
          }
        },
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => row.original.city || "-",
  },
  {
    accessorKey: "businessType",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)

      return createColumnHeader(
        column.id,
        "Business Type",
        meta,
        currentFilter,
        column.columnDef.meta?.filterConfig,
        column,
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "text",
        operators: ["contains", "equals", "isEmpty"],
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => row.original.businessType || "-",
  },
  {
    accessorKey: "employeeCount",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)

      return createColumnHeader(
        column.id,
        "Employees",
        meta,
        currentFilter,
        column.columnDef.meta?.filterConfig,
        column,
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "select",
        operators: ["in", "equals"],
        loadOptions: async (context?: {
          workspaceId?: string
          customerGroupId?: string
          signal?: AbortSignal
        }) => {
          try {
            const response = await leadsApi.getFilterOptions(
              "employeeCount",
              context?.workspaceId || undefined,
              context?.customerGroupId || undefined,
              context?.signal,
            )
            return response.options
          } catch (error) {
            console.error("Failed to load employeeCount filter options:", error)
            return []
          }
        },
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => row.original.employeeCount || "-",
  },
  {
    accessorKey: "leadSource",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)

      return createColumnHeader(
        column.id,
        "Source",
        meta,
        currentFilter,
        column.columnDef.meta?.filterConfig,
        column,
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "select",
        operators: ["in", "notIn", "equals"],
        loadOptions: async (context?: {
          workspaceId?: string
          customerGroupId?: string
          signal?: AbortSignal
        }) => {
          try {
            const response = await leadsApi.getFilterOptions(
              "leadSource",
              context?.workspaceId || undefined,
              context?.customerGroupId || undefined,
              context?.signal,
            )
            return response.options
          } catch (error) {
            console.error("Failed to load leadSource filter options:", error)
            return []
          }
        },
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => row.original.leadSource || "-",
  },
  {
    accessorKey: "foundedYear",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)

      return createColumnHeader(
        column.id,
        "Founded",
        meta,
        currentFilter,
        column.columnDef.meta?.filterConfig,
        column,
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "number",
        operators: ["equals", "gt", "lt", "gte", "lte", "between"],
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => row.original.foundedYear || "-",
  },
  {
    accessorKey: "websiteUrl",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)

      return createColumnHeader(
        column.id,
        "Website",
        meta,
        currentFilter,
        column.columnDef.meta?.filterConfig,
        column,
      )
    },
    enableSorting: false,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "text",
        operators: ["contains", "isEmpty"],
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => {
      const url = row.original.websiteUrl
      if (!url) return "-"
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline dark:text-blue-400"
          onClick={(e) => e.stopPropagation()}
        >
          {url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 30)}
        </a>
      )
    },
  },
  {
    id: "createdBy",
    accessorKey: "createdByUsername",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === "createdBy")

      return createColumnHeader(
        "createdBy",
        "Created By",
        meta,
        currentFilter,
        column.columnDef.meta?.filterConfig,
        column,
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "select",
        operators: ["in", "notIn", "isEmpty", "isNotEmpty"],
        loadOptions: async (context?: {
          workspaceId?: string
          customerGroupId?: string
          signal?: AbortSignal
        }) => {
          try {
            const response = await leadsApi.getFilterOptions(
              "createdBy",
              context?.workspaceId || undefined,
              context?.customerGroupId || undefined,
              context?.signal,
            )
            return response.options
          } catch (error) {
            console.error("Failed to load createdBy filter options:", error)
            return []
          }
        },
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => row.original.createdByUsername || "-",
  },
  {
    accessorKey: "createdAt",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)

      return createColumnHeader(
        column.id,
        "Created",
        meta,
        currentFilter,
        column.columnDef.meta?.filterConfig,
        column,
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "date",
        operators: ["between", "gt", "lt", "gte", "lte"],
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => {
      const date = new Date(row.original.createdAt)
      return (
        <div className="flex flex-col">
          <span>{date.toLocaleDateString()}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(date, { addSuffix: true })}
          </span>
        </div>
      )
    },
  },
  {
    accessorKey: "updatedAt",
    header: ({ column, table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      const currentFilter = meta?.columnFilters?.find((f) => f.field === column.id)

      return createColumnHeader(
        column.id,
        "Updated",
        meta,
        currentFilter,
        column.columnDef.meta?.filterConfig,
        column,
      )
    },
    enableSorting: true,
    enableColumnFilter: true,
    meta: {
      filterConfig: {
        type: "date",
        operators: ["between", "gt", "lt", "gte", "lte"],
      } as ColumnFilterConfig,
    },
    cell: ({ row }) => {
      const date = new Date(row.original.updatedAt)
      return (
        <div className="flex flex-col">
          <span>{date.toLocaleDateString()}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(date, { addSuffix: true })}
          </span>
        </div>
      )
    },
  },
  {
    id: "columnActions",
    header: ({ table }) => {
      const meta = table.options.meta as LeadsTableMeta | undefined
      return (
        <div className="flex items-center justify-center">
          <ColumnSelector
            visibleColumns={meta?.visibleColumns || []}
            onAddColumn={meta?.onAddColumn || (() => {})}
          />
        </div>
      )
    },
    cell: () => null,
    enableSorting: false,
    enableColumnFilter: false,
  },
]

// Helper to get filter config for a column
export function getColumnFilterConfig(columnId: string): ColumnFilterConfig | undefined {
  const column = leadsColumns.find(
    (col) => col.id === columnId || ("accessorKey" in col && col.accessorKey === columnId),
  )
  return column?.meta?.filterConfig as ColumnFilterConfig | undefined
}
