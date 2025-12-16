import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { BrowserRouter } from "react-router-dom"
import { type FilterConfig, FilterPanel } from "./filter-panel"

const meta = {
  title: "UI/FilterPanel",
  component: FilterPanel,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <BrowserRouter>
        <Story />
      </BrowserRouter>
    ),
  ],
} satisfies Meta<typeof FilterPanel>

export default meta
type Story = StoryObj<typeof meta>

// Default story
export const Default: Story = {
  args: {
    placeholder: "Search messages...",
  },
}

// With custom placeholder
export const CustomPlaceholder: Story = {
  args: {
    placeholder: "Search emails, contacts, or companies...",
  },
}

// Interactive example with callback
export const Interactive = {
  render: () => {
    const [filters, setFilters] = useState<FilterConfig>({
      search: "",
      sentiment: [],
      category: [],
      priority: [],
    })

    return (
      <div className="space-y-4">
        <FilterPanel
          onFilterChange={(newFilters) => {
            console.log("Filters changed:", newFilters)
            setFilters(newFilters)
          }}
          placeholder="Search messages..."
        />

        {/* Display current filters */}
        <div className="rounded-lg bg-muted p-4">
          <h3 className="mb-2 font-semibold">Current Filters:</h3>
          <pre className="text-sm">{JSON.stringify(filters, null, 2)}</pre>
        </div>
      </div>
    )
  },
}

// Full width example
export const FullWidth = {
  render: () => (
    <div className="w-full">
      <FilterPanel className="w-full" placeholder="Search..." />
    </div>
  ),
}

// In a card container
export const InCard = {
  render: () => (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-4 font-semibold text-lg">Email Messages</h2>
        <FilterPanel placeholder="Search messages..." />
        <div className="mt-4 space-y-2">
          <div className="cursor-pointer rounded-md border p-3 hover:bg-accent">
            <div className="font-medium">Message 1</div>
            <div className="text-muted-foreground text-sm">Preview text...</div>
          </div>
          <div className="cursor-pointer rounded-md border p-3 hover:bg-accent">
            <div className="font-medium">Message 2</div>
            <div className="text-muted-foreground text-sm">Preview text...</div>
          </div>
          <div className="cursor-pointer rounded-md border p-3 hover:bg-accent">
            <div className="font-medium">Message 3</div>
            <div className="text-muted-foreground text-sm">Preview text...</div>
          </div>
        </div>
      </div>
    </div>
  ),
}

// Mobile responsive demo
export const MobileView = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  render: () => (
    <div className="w-full">
      <FilterPanel placeholder="Search..." />
      <div className="mt-4 text-muted-foreground text-sm">
        <p>On mobile, filters open in a drawer/sheet instead of dropdown.</p>
        <p className="mt-2">Resize your browser to see the responsive behavior.</p>
      </div>
    </div>
  ),
}

// With pre-selected filters (via URL simulation)
export const WithPreselectedFilters = {
  render: () => {
    // Simulate URL with filters
    const searchParams = new URLSearchParams({
      search: "meeting",
      sentiment: "positive,neutral",
      priority: "high",
      category: "meeting_request",
    })

    return (
      <BrowserRouter>
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-950">
            <p className="text-sm">
              <strong>Simulated URL:</strong>
            </p>
            <code className="text-xs">?{searchParams.toString()}</code>
          </div>
          <FilterPanel placeholder="Search..." />
        </div>
      </BrowserRouter>
    )
  },
}

// Keyboard navigation demo
export const KeyboardAccessible = {
  render: () => (
    <div className="space-y-4">
      <FilterPanel placeholder="Search messages..." />
      <div className="space-y-2 rounded-lg bg-muted p-4 text-sm">
        <h3 className="font-semibold">Keyboard Shortcuts:</h3>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <kbd className="rounded border bg-background px-2 py-1">Tab</kbd> - Navigate between
            elements
          </li>
          <li>
            <kbd className="rounded border bg-background px-2 py-1">Enter</kbd> - Apply search or
            toggle filter
          </li>
          <li>
            <kbd className="rounded border bg-background px-2 py-1">Escape</kbd> - Clear search
            input
          </li>
          <li>
            <kbd className="rounded border bg-background px-2 py-1">Space</kbd> - Toggle checkboxes
          </li>
        </ul>
      </div>
    </div>
  ),
}
