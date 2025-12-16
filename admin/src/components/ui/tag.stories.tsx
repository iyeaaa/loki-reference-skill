import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import { useTranslation } from "react-i18next"
import { Tag } from "./tag"

const meta = {
  title: "UI/Tag",
  component: Tag,
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A versatile tag component for displaying message metadata like sentiment, priority, and categories. Supports multiple variants, sizes, dark mode, tooltips, and removable functionality.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: [
        "positive",
        "negative",
        "other",
        "unclassified",
        "high",
        "medium",
        "low",
        "meeting-request",
        "question",
        "auto",
        "other-category",
      ],
      description: "The visual style variant of the tag",
    },
    size: {
      control: "select",
      options: ["small", "medium"],
      description: "The size of the tag",
    },
    removable: {
      control: "boolean",
      description: "Whether the tag can be removed (shows X button)",
    },
    tooltip: {
      control: "text",
      description: "Optional tooltip text to show on hover",
    },
    animated: {
      control: "boolean",
      description: "Whether to animate the tag (respects reduced motion)",
    },
  },
  args: {
    onRemove: fn(),
  },
} satisfies Meta<typeof Tag>

export default meta
type Story = StoryObj<typeof meta>

// Basic Examples
export const Default: Story = {
  args: {
    variant: "other",
    children: "Default Tag",
    size: "medium",
  },
}

export const WithTooltip: Story = {
  args: {
    variant: "positive",
    children: "Hover me",
    tooltip: "This is a helpful tooltip",
    size: "medium",
  },
}

export const Removable: Story = {
  args: {
    variant: "high",
    children: "Removable Tag",
    removable: true,
    size: "medium",
  },
}

// Sentiment Variants
export const SentimentPositive: Story = {
  args: {
    variant: "positive",
    children: "Positive",
    tooltip: "Positive sentiment detected",
    size: "medium",
  },
}

export const SentimentNegative: Story = {
  args: {
    variant: "negative",
    children: "Negative",
    tooltip: "Negative sentiment detected",
    size: "medium",
  },
}

export const SentimentOther: Story = {
  args: {
    variant: "other",
    children: "Other",
    tooltip: "Other sentiment",
    size: "medium",
  },
}

export const SentimentUnclassified: Story = {
  args: {
    variant: "unclassified",
    children: "Unclassified",
    tooltip: "Sentiment unclassified",
    size: "medium",
  },
}

// Priority Variants
export const PriorityHigh: Story = {
  args: {
    variant: "high",
    children: "High",
    tooltip: "High priority",
    size: "medium",
  },
}

export const PriorityMedium: Story = {
  args: {
    variant: "medium",
    children: "Medium",
    tooltip: "Medium priority",
    size: "medium",
  },
}

export const PriorityLow: Story = {
  args: {
    variant: "low",
    children: "Low",
    tooltip: "Low priority",
    size: "medium",
  },
}

// Category Variants
export const CategoryMeetingRequest: Story = {
  args: {
    variant: "meeting-request",
    children: "Meeting Request",
    tooltip: "Meeting request message",
    size: "medium",
  },
}

export const CategoryQuestion: Story = {
  args: {
    variant: "question",
    children: "Question",
    tooltip: "Question message",
    size: "medium",
  },
}

export const CategoryAuto: Story = {
  args: {
    variant: "auto",
    children: "Auto",
    tooltip: "Auto-generated message",
    size: "medium",
  },
}

export const CategoryOther: Story = {
  args: {
    variant: "other-category",
    children: "Other",
    tooltip: "Other category",
    size: "medium",
  },
}

// Size Variants
export const SizeSmall: Story = {
  args: {
    variant: "positive",
    children: "Small Tag",
    size: "small",
  },
}

export const SizeMedium: Story = {
  args: {
    variant: "positive",
    children: "Medium Tag",
    size: "medium",
  },
}

// Interactive Examples
export const RemovableWithCallback: Story = {
  args: {
    variant: "meeting-request",
    children: "Click X to remove",
    removable: true,
    size: "medium",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tag with remove functionality. Click the X button to trigger the onRemove callback.",
      },
    },
  },
}

export const LongText: Story = {
  args: {
    variant: "positive",
    children: "This is a tag with a very long text content that should truncate properly",
    size: "medium",
    className: "max-w-[200px]",
  },
  parameters: {
    docs: {
      description: {
        story: "Tag with long text content demonstrates truncation behavior.",
      },
    },
  },
}

// Showcase - All Sentiment Variants
export const AllSentimentVariants: Story = {
  args: { children: "" },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Tag tooltip="Positive sentiment detected" variant="positive">
        Positive
      </Tag>
      <Tag tooltip="Negative sentiment detected" variant="negative">
        Negative
      </Tag>
      <Tag tooltip="Other sentiment" variant="other">
        Other
      </Tag>
      <Tag tooltip="Sentiment unclassified" variant="unclassified">
        Unclassified
      </Tag>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All available sentiment tag variants displayed together.",
      },
    },
  },
}

// Showcase - All Priority Variants
export const AllPriorityVariants: Story = {
  args: { children: "" },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Tag tooltip="High priority" variant="high">
        High
      </Tag>
      <Tag tooltip="Medium priority" variant="medium">
        Medium
      </Tag>
      <Tag tooltip="Low priority" variant="low">
        Low
      </Tag>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All available priority tag variants displayed together.",
      },
    },
  },
}

// Showcase - All Category Variants
export const AllCategoryVariants: Story = {
  args: { children: "" },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Tag tooltip="Meeting request message" variant="meeting-request">
        Meeting Request
      </Tag>
      <Tag tooltip="Question message" variant="question">
        Question
      </Tag>
      <Tag tooltip="Auto-generated message" variant="auto">
        Auto
      </Tag>
      <Tag tooltip="Other category" variant="other-category">
        Other
      </Tag>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "All available category tag variants displayed together.",
      },
    },
  },
}

// Showcase - Size Comparison
export const SizeComparison: Story = {
  args: { children: "" },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <Tag size="small" variant="positive">
        Small
      </Tag>
      <Tag size="medium" variant="positive">
        Medium
      </Tag>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: "Comparison of small and medium tag sizes.",
      },
    },
  },
}

// Showcase - Removable Tags
export const RemovableTags: Story = {
  args: { children: "" },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Tag onRemove={() => console.log("Removed positive")} removable variant="positive">
        Positive
      </Tag>
      <Tag onRemove={() => console.log("Removed high")} removable variant="high">
        High Priority
      </Tag>
      <Tag onRemove={() => console.log("Removed meeting")} removable variant="meeting-request">
        Meeting Request
      </Tag>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "Tags with remove buttons. Click the X button or press Enter/Space when focused on it.",
      },
    },
  },
}

// Showcase - i18n Example
export const InternationalizedTags: Story = {
  args: { children: "" },
  render: () => {
    const { t } = useTranslation()
    return (
      <div className="flex flex-wrap gap-2">
        <Tag tooltip={t("common.tag.tooltip.positive")} variant="positive">
          {t("common.tag.sentiment.positive")}
        </Tag>
        <Tag tooltip={t("common.tag.tooltip.high")} variant="high">
          {t("common.tag.priority.high")}
        </Tag>
        <Tag tooltip={t("common.tag.tooltip.meetingRequest")} variant="meeting-request">
          {t("common.tag.category.meetingRequest")}
        </Tag>
      </div>
    )
  },
  parameters: {
    docs: {
      description: {
        story:
          "Tags using i18n translations. Toggle the language in the toolbar to see Korean/English.",
      },
    },
  },
}

// Real-world Example
export const MessageMetadata: Story = {
  args: { children: "" },
  render: () => (
    <div className="space-y-4">
      <div className="rounded-lg border bg-background p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-semibold">Message #1</span>
        </div>
        <p className="mb-3 text-muted-foreground text-sm">
          Hi, I'd like to schedule a meeting to discuss the project proposal...
        </p>
        <div className="flex flex-wrap gap-2">
          <Tag size="small" variant="positive">
            Positive
          </Tag>
          <Tag size="small" variant="high">
            High
          </Tag>
          <Tag size="small" variant="meeting-request">
            Meeting Request
          </Tag>
        </div>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-semibold">Message #2</span>
        </div>
        <p className="mb-3 text-muted-foreground text-sm">
          I have some questions about the billing process...
        </p>
        <div className="flex flex-wrap gap-2">
          <Tag size="small" variant="other">
            Other
          </Tag>
          <Tag size="small" variant="medium">
            Medium
          </Tag>
          <Tag size="small" variant="question">
            Question
          </Tag>
        </div>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-semibold">Message #3</span>
        </div>
        <p className="mb-3 text-muted-foreground text-sm">
          This is an automated notification from our system...
        </p>
        <div className="flex flex-wrap gap-2">
          <Tag size="small" variant="unclassified">
            Unclassified
          </Tag>
          <Tag size="small" variant="low">
            Low
          </Tag>
          <Tag size="small" variant="auto">
            Auto
          </Tag>
        </div>
      </div>
    </div>
  ),
  parameters: {
    layout: "padded",
    docs: {
      description: {
        story: "Real-world example showing tags used to categorize message metadata.",
      },
    },
  },
}
