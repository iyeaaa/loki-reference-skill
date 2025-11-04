import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { Tag } from "./tag"
import { TagList } from "./tag-list"

const meta = {
  title: "UI/TagList",
  component: TagList,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A flexible container for displaying multiple Tag components with customizable layout, spacing, and wrapping behavior.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    direction: {
      control: "select",
      options: ["horizontal", "vertical"],
      description: "Layout direction of the tags",
    },
    wrap: {
      control: "boolean",
      description: "Whether tags should wrap to multiple lines",
    },
    gap: {
      control: "select",
      options: ["none", "xs", "sm", "md", "lg"],
      description: "Gap size between tags",
    },
    align: {
      control: "select",
      options: ["start", "center", "end"],
      description: "Alignment of tags",
    },
  },
} satisfies Meta<typeof TagList>

export default meta
type Story = StoryObj<typeof meta>

// Basic Examples
export const Default: Story = {
  args: {
    children: (
      <>
        <Tag variant="positive">Positive</Tag>
        <Tag variant="high">High</Tag>
        <Tag variant="meeting-request">Meeting Request</Tag>
      </>
    ),
  },
}

export const Vertical: Story = {
  args: {
    direction: "vertical",
    children: (
      <>
        <Tag variant="positive">Positive</Tag>
        <Tag variant="high">High</Tag>
        <Tag variant="meeting-request">Meeting Request</Tag>
      </>
    ),
  },
}

export const NoWrap: Story = {
  args: {
    wrap: false,
    className: "max-w-md",
    children: (
      <>
        <Tag variant="positive">Positive</Tag>
        <Tag variant="negative">Negative</Tag>
        <Tag variant="other">Other</Tag>
        <Tag variant="high">High Priority</Tag>
        <Tag variant="medium">Medium Priority</Tag>
        <Tag variant="low">Low Priority</Tag>
        <Tag variant="meeting-request">Meeting Request</Tag>
        <Tag variant="question">Question</Tag>
      </>
    ),
  },
  parameters: {
    docs: {
      description: {
        story: "With wrap disabled, tags scroll horizontally when they exceed container width.",
      },
    },
  },
}

// Gap Variations
export const GapNone: Story = {
  args: {
    gap: "none",
    children: (
      <>
        <Tag variant="positive">Positive</Tag>
        <Tag variant="high">High</Tag>
        <Tag variant="meeting-request">Meeting Request</Tag>
      </>
    ),
  },
}

export const GapExtraSmall: Story = {
  args: {
    gap: "xs",
    children: (
      <>
        <Tag variant="positive">Positive</Tag>
        <Tag variant="high">High</Tag>
        <Tag variant="meeting-request">Meeting Request</Tag>
      </>
    ),
  },
}

export const GapSmall: Story = {
  args: {
    gap: "sm",
    children: (
      <>
        <Tag variant="positive">Positive</Tag>
        <Tag variant="high">High</Tag>
        <Tag variant="meeting-request">Meeting Request</Tag>
      </>
    ),
  },
}

export const GapMedium: Story = {
  args: {
    gap: "md",
    children: (
      <>
        <Tag variant="positive">Positive</Tag>
        <Tag variant="high">High</Tag>
        <Tag variant="meeting-request">Meeting Request</Tag>
      </>
    ),
  },
}

export const GapLarge: Story = {
  args: {
    gap: "lg",
    children: (
      <>
        <Tag variant="positive">Positive</Tag>
        <Tag variant="high">High</Tag>
        <Tag variant="meeting-request">Meeting Request</Tag>
      </>
    ),
  },
}

// Alignment Variations
export const AlignStart: Story = {
  args: {
    align: "start",
    className: "w-full",
    children: (
      <>
        <Tag variant="positive">Positive</Tag>
        <Tag variant="high">High</Tag>
        <Tag variant="meeting-request">Meeting Request</Tag>
      </>
    ),
  },
}

export const AlignCenter: Story = {
  args: {
    align: "center",
    className: "w-full",
    children: (
      <>
        <Tag variant="positive">Positive</Tag>
        <Tag variant="high">High</Tag>
        <Tag variant="meeting-request">Meeting Request</Tag>
      </>
    ),
  },
}

export const AlignEnd: Story = {
  args: {
    align: "end",
    className: "w-full",
    children: (
      <>
        <Tag variant="positive">Positive</Tag>
        <Tag variant="high">High</Tag>
        <Tag variant="meeting-request">Meeting Request</Tag>
      </>
    ),
  },
}

// Complex Examples
export const MixedVariants: Story = {
  args: { children: "" },
  render: () => (
    <TagList>
      <Tag variant="positive" size="small">
        Positive
      </Tag>
      <Tag variant="negative" size="small">
        Negative
      </Tag>
      <Tag variant="other" size="small">
        Other
      </Tag>
      <Tag variant="high" size="small">
        High
      </Tag>
      <Tag variant="medium" size="small">
        Medium
      </Tag>
      <Tag variant="low" size="small">
        Low
      </Tag>
      <Tag variant="meeting-request" size="small">
        Meeting Request
      </Tag>
      <Tag variant="question" size="small">
        Question
      </Tag>
      <Tag variant="auto" size="small">
        Auto
      </Tag>
    </TagList>
  ),
  parameters: {
    docs: {
      description: {
        story: "TagList with multiple tag variants demonstrating wrapping behavior.",
      },
    },
  },
}

export const RemovableTags: Story = {
  args: { children: "" },
  render: () => {
    const [tags, setTags] = useState([
      { id: 1, variant: "positive" as const, label: "Positive" },
      { id: 2, variant: "high" as const, label: "High Priority" },
      { id: 3, variant: "meeting-request" as const, label: "Meeting Request" },
      { id: 4, variant: "question" as const, label: "Question" },
    ])

    const removeTag = (id: number) => {
      setTags(tags.filter((tag) => tag.id !== id))
    }

    return (
      <div className="space-y-4">
        <TagList>
          {tags.map((tag) => (
            <Tag key={tag.id} variant={tag.variant} removable onRemove={() => removeTag(tag.id)}>
              {tag.label}
            </Tag>
          ))}
        </TagList>
        {tags.length === 0 && (
          <p className="text-sm text-muted-foreground">All tags removed! Refresh to reset.</p>
        )}
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interactive example with removable tags. Click the X button to remove tags from the list.",
      },
    },
  },
}

export const VerticalList: Story = {
  args: { children: "" },
  render: () => (
    <TagList direction="vertical" gap="md">
      <Tag variant="positive">Positive Sentiment</Tag>
      <Tag variant="high">High Priority</Tag>
      <Tag variant="meeting-request">Meeting Request</Tag>
      <Tag variant="question">Question</Tag>
    </TagList>
  ),
  parameters: {
    docs: {
      description: {
        story: "Tags arranged vertically with medium gap spacing.",
      },
    },
  },
}

export const InCard: Story = {
  args: { children: "" },
  render: () => (
    <div className="border rounded-lg p-4 bg-background shadow-sm max-w-md">
      <h3 className="font-semibold mb-2">Email from John Doe</h3>
      <p className="text-sm text-muted-foreground mb-3">
        Hello, I would like to schedule a meeting to discuss the quarterly results. When would be a
        good time for you?
      </p>
      <div className="flex items-center justify-between">
        <TagList gap="xs">
          <Tag variant="positive" size="small">
            Positive
          </Tag>
          <Tag variant="high" size="small">
            High
          </Tag>
          <Tag variant="meeting-request" size="small">
            Meeting
          </Tag>
        </TagList>
        <span className="text-xs text-muted-foreground">2 hours ago</span>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Real-world example showing TagList used within a message card.",
      },
    },
  },
}

export const FilterableTagList: Story = {
  args: { children: "" },
  render: () => {
    const [selectedTags, setSelectedTags] = useState<string[]>([
      "positive",
      "high",
      "meeting-request",
    ])

    const availableTags = [
      { variant: "positive" as const, label: "Positive" },
      { variant: "negative" as const, label: "Negative" },
      { variant: "high" as const, label: "High" },
      { variant: "medium" as const, label: "Medium" },
      { variant: "low" as const, label: "Low" },
      { variant: "meeting-request" as const, label: "Meeting" },
      { variant: "question" as const, label: "Question" },
      { variant: "auto" as const, label: "Auto" },
    ]

    const toggleTag = (variant: string) => {
      setSelectedTags(
        selectedTags.includes(variant)
          ? selectedTags.filter((t) => t !== variant)
          : [...selectedTags, variant],
      )
    }

    return (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">Selected Filters:</p>
          <TagList gap="xs">
            {selectedTags.map((variant) => {
              const tag = availableTags.find((t) => t.variant === variant)
              return (
                <Tag
                  key={variant}
                  variant={tag?.variant || "other"}
                  removable
                  size="small"
                  onRemove={() => toggleTag(variant)}
                >
                  {tag?.label}
                </Tag>
              )
            })}
          </TagList>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Available Tags (click to add):</p>
          <TagList gap="xs">
            {availableTags
              .filter((tag) => !selectedTags.includes(tag.variant))
              .map((tag) => (
                <Tag
                  key={tag.variant}
                  variant={tag.variant}
                  size="small"
                  className="cursor-pointer hover:opacity-80"
                  onClick={() => toggleTag(tag.variant)}
                >
                  {tag.label}
                </Tag>
              ))}
          </TagList>
        </div>
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story:
          "Interactive filtering example. Click tags to add/remove them from the filter selection.",
      },
    },
  },
}

export const ResponsiveLayout: Story = {
  args: { children: "" },
  render: () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-2">Desktop View (wrapping)</h3>
        <div className="border rounded-lg p-4 bg-background">
          <TagList gap="sm">
            <Tag variant="positive">Positive</Tag>
            <Tag variant="negative">Negative</Tag>
            <Tag variant="other">Other</Tag>
            <Tag variant="high">High Priority</Tag>
            <Tag variant="medium">Medium Priority</Tag>
            <Tag variant="low">Low Priority</Tag>
            <Tag variant="meeting-request">Meeting Request</Tag>
            <Tag variant="question">Question</Tag>
            <Tag variant="auto">Auto-generated</Tag>
          </TagList>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Mobile View (scrollable)</h3>
        <div className="border rounded-lg p-4 bg-background max-w-xs">
          <TagList wrap={false} gap="xs">
            <Tag variant="positive" size="small">
              Positive
            </Tag>
            <Tag variant="negative" size="small">
              Negative
            </Tag>
            <Tag variant="other" size="small">
              Other
            </Tag>
            <Tag variant="high" size="small">
              High
            </Tag>
            <Tag variant="medium" size="small">
              Medium
            </Tag>
            <Tag variant="low" size="small">
              Low
            </Tag>
          </TagList>
        </div>
      </div>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Demonstrates responsive design patterns: wrapping for desktop, scrolling for mobile.",
      },
    },
  },
}
