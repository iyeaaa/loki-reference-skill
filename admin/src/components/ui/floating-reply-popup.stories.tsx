import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FloatingReplyPopup } from "./floating-reply-popup"

const meta = {
  title: "UI/FloatingReplyPopup",
  component: FloatingReplyPopup,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A Gmail-style floating reply popup that appears in the bottom-right corner. Features minimize, maximize, and close controls.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    isOpen: {
      control: "boolean",
      description: "Controls whether the popup is visible",
    },
    onClose: {
      description: "Callback when the popup is closed",
    },
    onSend: {
      description: "Callback when the reply is sent",
    },
    to: {
      control: "text",
      description: "Recipient email address",
    },
    subject: {
      control: "text",
      description: "Email subject line",
    },
    isSending: {
      control: "boolean",
      description: "Loading state while sending",
    },
  },
  args: {
    onClose: fn(),
    onSend: fn(),
  },
} satisfies Meta<typeof FloatingReplyPopup>

export default meta
type Story = StoryObj<typeof meta>

// Interactive wrapper component
function InteractiveWrapper() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSending, setIsSending] = useState(false)

  const handleSend = async (text: string, subject: string) => {
    console.log("Sending reply:", text, "with subject:", subject)
    setIsSending(true)
    // Simulate sending delay
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsSending(false)
    setIsOpen(false)
  }

  return (
    <div className="h-screen w-full bg-gray-100 p-8 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-4 font-bold text-2xl">Gmail-Style Floating Reply Popup</h1>
        <p className="mb-6 text-gray-600 dark:text-gray-400">
          Click the button below to open the floating reply popup in the bottom-right corner.
        </p>
        <Button onClick={() => setIsOpen(true)}>Open Reply Popup</Button>

        <FloatingReplyPopup
          isOpen={isOpen}
          isSending={isSending}
          onClose={() => setIsOpen(false)}
          onSend={handleSend}
          subject="Re: CES 2026 파트너십 제안 - 미팅 제안"
          to="junbo.cho@globallogics.co.kr"
        />
      </div>
    </div>
  )
}

// Default story with interactive controls
export const Default = {
  render: () => <InteractiveWrapper />,
  parameters: {
    docs: {
      description: {
        story:
          "Interactive example showing the floating reply popup. Click the button to open it, then try the minimize, maximize, and close controls.",
      },
    },
  },
}

// Always open state for visual testing
export const AlwaysOpen: Story = {
  args: {
    isOpen: true,
    to: "contact@example.com",
    subject: "Re: Your Inquiry",
    isSending: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Popup in its default open state for visual inspection.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-screen w-full bg-gray-100 dark:bg-gray-900">
        <Story />
      </div>
    ),
  ],
}

// Sending state
export const Sending: Story = {
  args: {
    isOpen: true,
    to: "partner@company.com",
    subject: "Re: Partnership Proposal",
    isSending: true,
  },
  parameters: {
    docs: {
      description: {
        story: "Popup showing the sending state with disabled send button and loading indicator.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-screen w-full bg-gray-100 dark:bg-gray-900">
        <Story />
      </div>
    ),
  ],
}

// Korean text example
export const KoreanText: Story = {
  args: {
    isOpen: true,
    to: "akashi@grinda.co",
    subject: "Re: CES 2026 파트너십 제안",
    isSending: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Example with Korean text to demonstrate internationalization support.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-screen w-full bg-gray-100 dark:bg-gray-900">
        <Story />
      </div>
    ),
  ],
}

// Long subject line
export const LongSubject: Story = {
  args: {
    isOpen: true,
    to: "verylongemailaddress@verylongdomainname.com",
    subject:
      "Re: This is a very long subject line that should be truncated properly in the popup interface",
    isSending: false,
  },
  parameters: {
    docs: {
      description: {
        story: "Testing with a very long subject line to ensure proper text truncation.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-screen w-full bg-gray-100 dark:bg-gray-900">
        <Story />
      </div>
    ),
  ],
}

// Dark mode
export const DarkMode: Story = {
  args: {
    isOpen: true,
    to: "contact@example.com",
    subject: "Re: Your Message",
    isSending: false,
  },
  parameters: {
    backgrounds: { default: "dark" },
    docs: {
      description: {
        story: "Popup in dark mode showing proper contrast and styling.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-screen w-full bg-gray-900">
        <Story />
      </div>
    ),
  ],
}
