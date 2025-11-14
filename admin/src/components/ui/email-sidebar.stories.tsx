import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import {
  Archive,
  HelpCircle,
  Inbox,
  Mail,
  MessageSquare,
  Minus,
  Send,
  Star,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react"
import * as React from "react"
import { EmailSidebar } from "./email-sidebar"

const meta = {
  title: "UI/EmailSidebar",
  component: EmailSidebar,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "An email navigation sidebar component with sections for overview and labels. Features icon-based menu items with active state highlighting and optional count badges.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    activeItemId: {
      control: "text",
      description: "The ID of the currently active menu item",
    },
    sections: {
      control: "object",
      description: "Array of sections with items to display",
    },
  },
  args: {
    onItemClick: fn(),
  },
  decorators: [
    (Story) => (
      <div className="h-screen w-full flex">
        <Story />
        <div className="flex-1 p-8 bg-muted/20">
          <div className="max-w-4xl">
            <h1 className="text-2xl font-bold mb-4">Email Content Area</h1>
            <p className="text-muted-foreground mb-6">
              Click on the sidebar items to see the active state change. Email messages and content
              would be displayed here.
            </p>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-background">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10" />
                  <div>
                    <p className="font-medium">John Doe</p>
                    <p className="text-sm text-muted-foreground">john@example.com</p>
                  </div>
                </div>
                <p className="text-sm">Sample email content would appear here...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof EmailSidebar>

export default meta
type Story = StoryObj<typeof meta>

// Default Example (matches the provided image)
export const Default: Story = {
  args: {
    activeItemId: "unread",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Default email sidebar with Overview and Labels sections. The 'Unread' item is selected by default.",
      },
    },
  },
}

// All Selected
export const AllSelected: Story = {
  args: {
    activeItemId: "all",
  },
  parameters: {
    docs: {
      description: {
        story: "Email sidebar with 'All' item selected.",
      },
    },
  },
}

// Important Selected
export const ImportantSelected: Story = {
  args: {
    activeItemId: "important",
  },
  parameters: {
    docs: {
      description: {
        story: "Email sidebar with 'Important' item selected.",
      },
    },
  },
}

// Label Selected
export const LabelSelected: Story = {
  args: {
    activeItemId: "positive",
  },
  parameters: {
    docs: {
      description: {
        story: "Email sidebar with a label item (Positive) selected.",
      },
    },
  },
}

// With Count Badges
export const WithCountBadges: Story = {
  args: {
    activeItemId: "unread",
    sections: [
      {
        title: "OVERVIEW",
        items: [
          {
            id: "all",
            label: "All",
            icon: <Mail className="h-4 w-4" />,
            count: 128,
          },
          {
            id: "unread",
            label: "Unread",
            icon: <Mail className="h-4 w-4" />,
            count: 23,
          },
          {
            id: "important",
            label: "Important",
            icon: <Star className="h-4 w-4" />,
            count: 5,
          },
        ],
      },
      {
        title: "LABELS",
        items: [
          {
            id: "positive",
            label: "Positive",
            icon: <ThumbsUp className="h-4 w-4" />,
            count: 45,
          },
          {
            id: "negative",
            label: "Negative",
            icon: <ThumbsDown className="h-4 w-4" />,
            count: 12,
          },
          {
            id: "auto-messages",
            label: "Auto Messages",
            icon: <MessageSquare className="h-4 w-4" />,
            count: 8,
          },
          {
            id: "other",
            label: "Other",
            icon: <Minus className="h-4 w-4" />,
            count: 34,
          },
          {
            id: "unclassified",
            label: "Unclassified",
            icon: <HelpCircle className="h-4 w-4" />,
            count: 6,
          },
        ],
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: "Email sidebar with count badges showing the number of items in each category.",
      },
    },
  },
}

// Custom Sections
export const CustomSections: Story = {
  args: {
    activeItemId: "inbox",
    sections: [
      {
        title: "MAILBOX",
        items: [
          {
            id: "inbox",
            label: "Inbox",
            icon: <Inbox className="h-4 w-4" />,
            count: 42,
          },
          {
            id: "sent",
            label: "Sent",
            icon: <Send className="h-4 w-4" />,
          },
          {
            id: "archive",
            label: "Archive",
            icon: <Archive className="h-4 w-4" />,
            count: 156,
          },
          {
            id: "trash",
            label: "Trash",
            icon: <Trash2 className="h-4 w-4" />,
            count: 8,
          },
        ],
      },
      {
        title: "TAGS",
        items: [
          {
            id: "work",
            label: "Work",
            icon: <Tag className="h-4 w-4" />,
            count: 23,
          },
          {
            id: "personal",
            label: "Personal",
            icon: <Tag className="h-4 w-4" />,
            count: 15,
          },
          {
            id: "important",
            label: "Important",
            icon: <Star className="h-4 w-4" />,
            count: 7,
          },
        ],
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: "Email sidebar with custom sections (Mailbox and Tags) and different icons.",
      },
    },
  },
}

// Single Section
export const SingleSection: Story = {
  args: {
    activeItemId: "all",
    sections: [
      {
        title: "OVERVIEW",
        items: [
          {
            id: "all",
            label: "All",
            icon: <Mail className="h-4 w-4" />,
          },
          {
            id: "unread",
            label: "Unread",
            icon: <Mail className="h-4 w-4" />,
          },
          {
            id: "important",
            label: "Important",
            icon: <Star className="h-4 w-4" />,
          },
        ],
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: "Email sidebar with only one section displayed.",
      },
    },
  },
}

// Minimal Items
export const MinimalItems: Story = {
  args: {
    activeItemId: "inbox",
    sections: [
      {
        title: "MAIL",
        items: [
          {
            id: "inbox",
            label: "Inbox",
            icon: <Inbox className="h-4 w-4" />,
          },
          {
            id: "sent",
            label: "Sent",
            icon: <Send className="h-4 w-4" />,
          },
        ],
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: "Email sidebar with minimal items for simple use cases.",
      },
    },
  },
}

// Standalone (No Decorator)
export const Standalone: Story = {
  args: {
    activeItemId: "unread",
  },
  decorators: [],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        story: "Email sidebar component displayed standalone without the content area decorator.",
      },
    },
  },
}

// Dark Mode
export const DarkMode: Story = {
  args: {
    activeItemId: "positive",
  },
  parameters: {
    backgrounds: { default: "dark" },
    docs: {
      description: {
        story: "Email sidebar in dark mode showing proper contrast and styling.",
      },
    },
  },
}

// Interactive Example
export const Interactive: Story = {
  args: {
    activeItemId: "unread",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Fully interactive email sidebar. Click on any menu item to see the active state change and trigger the callback. Check the Actions panel to see click events.",
      },
    },
  },
}

// With State Management Example
export const WithStateManagement: Story = {
  render: () => {
    const [activeItem, setActiveItem] = React.useState("unread")

    const sections = [
      {
        title: "OVERVIEW",
        items: [
          {
            id: "all",
            label: "All",
            icon: <Mail className="h-4 w-4" />,
            count: 128,
          },
          {
            id: "unread",
            label: "Unread",
            icon: <Mail className="h-4 w-4" />,
            count: 23,
          },
          {
            id: "important",
            label: "Important",
            icon: <Star className="h-4 w-4" />,
            count: 5,
          },
        ],
      },
      {
        title: "LABELS",
        items: [
          {
            id: "positive",
            label: "Positive",
            icon: <ThumbsUp className="h-4 w-4" />,
            count: 45,
          },
          {
            id: "negative",
            label: "Negative",
            icon: <ThumbsDown className="h-4 w-4" />,
            count: 12,
          },
        ],
      },
    ]

    return (
      <div className="flex h-screen">
        <EmailSidebar
          sections={sections}
          activeItemId={activeItem}
          onItemClick={(id) => {
            setActiveItem(id)
            console.log(`Navigated to: ${id}`)
          }}
        />
        <div className="flex-1 p-8 bg-muted/20">
          <div className="max-w-4xl">
            <h1 className="text-2xl font-bold mb-4">
              Current View: {activeItem.charAt(0).toUpperCase() + activeItem.slice(1)}
            </h1>
            <p className="text-muted-foreground">
              This example shows how to manage state and respond to navigation changes. The current
              active item is: <strong>{activeItem}</strong>
            </p>
          </div>
        </div>
      </div>
    )
  },
  decorators: [],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        story:
          "Example showing how to use the email sidebar with React state management. The active item is tracked and displayed in the content area.",
      },
    },
  },
}
