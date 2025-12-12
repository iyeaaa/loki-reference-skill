import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import {
  Bell,
  CreditCard,
  FileText,
  Globe,
  Mail,
  Settings,
  Shield,
  Upload,
  User,
  Users,
} from "lucide-react"
import { SettingsSidebar } from "./settings-sidebar"

const meta = {
  title: "UI/SettingsSidebar",
  component: SettingsSidebar,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A sidebar navigation component for settings and system management. Features icon-based menu items with active state highlighting and customizable items.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    activeItemId: {
      control: "text",
      description: "The ID of the currently active menu item",
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
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold mb-4">Content Area</h1>
            <p className="text-muted-foreground">
              Click on the sidebar items to see the active state change. The content for each
              section would be displayed here.
            </p>
          </div>
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsSidebar>

export default meta
type Story = StoryObj<typeof meta>

// Default Example
export const Default: Story = {
  args: {},
}

export const WithActiveItem: Story = {
  args: {
    activeItemId: "workspace",
  },
  parameters: {
    docs: {
      description: {
        story: "Sidebar with a pre-selected active item (Workspace).",
      },
    },
  },
}

export const CustomTitle: Story = {
  args: {
    activeItemId: "profile",
  },
  parameters: {
    docs: {
      description: {
        story: "Sidebar with pre-selected profile item.",
      },
    },
  },
}

// Custom Items Example
export const CustomItems: Story = {
  args: {
    activeItemId: "notifications",
    items: [
      {
        id: "notifications",
        label: "Notifications",
        icon: <Bell className="h-4 w-4" />,
      },
      {
        id: "security",
        label: "Security",
        icon: <Shield className="h-4 w-4" />,
      },
      {
        id: "billing",
        label: "Billing",
        icon: <CreditCard className="h-4 w-4" />,
      },
      {
        id: "language",
        label: "Language & Region",
        icon: <Globe className="h-4 w-4" />,
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: "Sidebar with custom menu items and icons.",
      },
    },
  },
}

// Minimal Items
export const MinimalItems: Story = {
  args: {
    items: [
      {
        id: "profile",
        label: "Profile",
        icon: <User className="h-4 w-4" />,
      },
      {
        id: "settings",
        label: "Settings",
        icon: <Settings className="h-4 w-4" />,
      },
    ],
    activeItemId: "profile",
  },
  parameters: {
    docs: {
      description: {
        story: "Sidebar with minimal menu items for simple use cases.",
      },
    },
  },
}

// Many Items
export const ManyItems: Story = {
  args: {
    items: [
      {
        id: "profile",
        label: "Profile",
        icon: <User className="h-4 w-4" />,
      },
      {
        id: "signature",
        label: "Signature",
        icon: <Mail className="h-4 w-4" />,
      },
      {
        id: "workspace",
        label: "Workspace",
        icon: <Settings className="h-4 w-4" />,
      },
      {
        id: "admin",
        label: "Admin",
        icon: <Users className="h-4 w-4" />,
      },
      {
        id: "email-templates",
        label: "Email Templates",
        icon: <FileText className="h-4 w-4" />,
      },
      {
        id: "bulk-lead-import",
        label: "Bulk Lead Import",
        icon: <Upload className="h-4 w-4" />,
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: <Bell className="h-4 w-4" />,
      },
      {
        id: "security",
        label: "Security",
        icon: <Shield className="h-4 w-4" />,
      },
      {
        id: "billing",
        label: "Billing",
        icon: <CreditCard className="h-4 w-4" />,
      },
      {
        id: "language",
        label: "Language & Region",
        icon: <Globe className="h-4 w-4" />,
      },
    ],
    activeItemId: "email-templates",
  },
  parameters: {
    docs: {
      description: {
        story: "Sidebar with many menu items showing scrollable behavior.",
      },
    },
  },
}

// Interactive Example
export const Interactive: Story = {
  args: {},
  parameters: {
    docs: {
      description: {
        story:
          "Fully interactive sidebar. Click on any menu item to see the active state change and trigger the callback.",
      },
    },
  },
}

// Without Decorator (Standalone)
export const Standalone: Story = {
  args: {
    activeItemId: "signature",
  },
  decorators: [],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        story: "Sidebar component displayed standalone without the content area decorator.",
      },
    },
  },
}

// Dark Mode Preview
export const DarkMode: Story = {
  args: {
    activeItemId: "workspace",
  },
  parameters: {
    backgrounds: { default: "dark" },
    docs: {
      description: {
        story: "Sidebar in dark mode showing proper contrast and styling.",
      },
    },
  },
}

// Real-world Example with State Management
export const WithStateManagement: Story = {
  render: () => {
    const items = [
      {
        id: "profile",
        label: "Profile",
        icon: <User className="h-4 w-4" />,
        onClick: () => console.log("Navigate to Profile"),
      },
      {
        id: "signature",
        label: "Signature",
        icon: <Mail className="h-4 w-4" />,
        onClick: () => console.log("Navigate to Signature"),
      },
      {
        id: "workspace",
        label: "Workspace",
        icon: <Settings className="h-4 w-4" />,
        onClick: () => console.log("Navigate to Workspace"),
      },
      {
        id: "admin",
        label: "Admin",
        icon: <Users className="h-4 w-4" />,
        onClick: () => console.log("Navigate to Admin"),
      },
    ]

    return (
      <SettingsSidebar
        items={items}
        onItemClick={(id) => console.log(`Item clicked: ${id}`)}
        activeItemId="profile"
      />
    )
  },
  decorators: [],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        story:
          "Example showing how to use the sidebar with custom onClick handlers for each item. Check the console for click events.",
      },
    },
  },
}
