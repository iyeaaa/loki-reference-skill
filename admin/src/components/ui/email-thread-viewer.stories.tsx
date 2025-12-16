import type { Meta, StoryObj } from "@storybook/react"
import { fn } from "@storybook/test"
import { type EmailMessage, EmailThreadViewer } from "./email-thread-viewer"

const meta = {
  title: "UI/EmailThreadViewer",
  component: EmailThreadViewer,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A Gmail-style email thread viewer component that displays email conversations with inline reply functionality. Shows sender information, timestamps, and message content in a clean, organized layout.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    messages: {
      description: "Array of email messages to display in the thread",
    },
    onSendReply: {
      description: "Callback function when user sends a reply",
    },
    loading: {
      control: "boolean",
      description: "Loading state of the component",
    },
  },
  args: {
    onSendReply: fn(),
  },
  decorators: [
    (Story) => (
      <div className="mx-auto h-[800px] max-w-4xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmailThreadViewer>

export default meta
type Story = StoryObj<typeof meta>

// Sample messages
const sampleMessages: EmailMessage[] = [
  {
    id: "1",
    from: "junbo.cho@globallogics.co.kr",
    fromName: "Junbo Cho",
    to: "akashi@grinda.co",
    subject: "Re: CES 2026 파트너십 제안 - 미팅 제안",
    body: `안녕하세요,

제안 내용을 확인했습니다. 매우 흥미로운 제안이네요.

다음 주 화요일 오후 2시에 미팅이 가능할까요?

감사합니다.
조준보
글로벌로직스`,
    timestamp: "Nov 9, 2025, 02:13 PM",
    isInbound: true,
  },
  {
    id: "2",
    from: "akashi@grinda.co",
    fromName: "Akashi",
    to: "junbo.cho@globallogics.co.kr",
    subject: "Re: CES 2026 파트너십 제안 - 미팅 제안",
    body: `조준보님,

답변 감사합니다.

네, 다음 주 화요일 오후 2시 좋습니다. 
Zoom 링크를 보내드리겠습니다.

감사합니다.
아카시
그린다`,
    timestamp: "Nov 9, 2025, 03:23 PM",
    isInbound: false,
  },
  {
    id: "3",
    from: "junbo.cho@globallogics.co.kr",
    fromName: "Junbo Cho",
    to: "akashi@grinda.co",
    subject: "Re: CES 2026 파트너십 제안 - 미팅 제안",
    body: `네, 확인했습니다.

그럼 화요일에 뵙겠습니다!

감사합니다.`,
    timestamp: "Nov 9, 2025, 03:31 PM",
    isInbound: true,
  },
]

const shortThread: EmailMessage[] = [
  {
    id: "1",
    from: "contact@example.com",
    fromName: "John Smith",
    to: "you@company.com",
    subject: "Quick Question",
    body: "Hi, I have a quick question about your product. Can you help?",
    timestamp: "Nov 11, 2025, 10:00 AM",
    isInbound: true,
  },
]

const longThread: EmailMessage[] = [
  {
    id: "1",
    from: "client@company.com",
    fromName: "Sarah Johnson",
    to: "sales@yourcompany.com",
    subject: "Product Inquiry",
    body: "Hello, I'm interested in learning more about your enterprise solution.",
    timestamp: "Nov 5, 2025, 09:00 AM",
    isInbound: true,
  },
  {
    id: "2",
    from: "sales@yourcompany.com",
    fromName: "Sales Team",
    to: "client@company.com",
    subject: "Re: Product Inquiry",
    body: "Thank you for your interest! I'd be happy to provide more information. When would be a good time for a call?",
    timestamp: "Nov 5, 2025, 10:30 AM",
    isInbound: false,
  },
  {
    id: "3",
    from: "client@company.com",
    fromName: "Sarah Johnson",
    to: "sales@yourcompany.com",
    subject: "Re: Product Inquiry",
    body: "How about next Tuesday at 2 PM?",
    timestamp: "Nov 5, 2025, 02:15 PM",
    isInbound: true,
  },
  {
    id: "4",
    from: "sales@yourcompany.com",
    fromName: "Sales Team",
    to: "client@company.com",
    subject: "Re: Product Inquiry",
    body: "Perfect! I'll send you a calendar invite shortly.",
    timestamp: "Nov 5, 2025, 02:45 PM",
    isInbound: false,
  },
  {
    id: "5",
    from: "client@company.com",
    fromName: "Sarah Johnson",
    to: "sales@yourcompany.com",
    subject: "Re: Product Inquiry",
    body: "Great, looking forward to it!",
    timestamp: "Nov 5, 2025, 03:00 PM",
    isInbound: true,
  },
]

// Default story with sample conversation
export const Default: Story = {
  args: {
    messages: sampleMessages,
  },
}

// Loading state
export const Loading: Story = {
  args: {
    messages: [],
    loading: true,
  },
}

// Empty state
export const Empty: Story = {
  args: {
    messages: [],
    loading: false,
  },
}

// Single message thread
export const SingleMessage: Story = {
  args: {
    messages: shortThread,
  },
  parameters: {
    docs: {
      description: {
        story: "Thread with a single message, showing the initial inquiry.",
      },
    },
  },
}

// Long conversation
export const LongConversation: Story = {
  args: {
    messages: longThread,
  },
  parameters: {
    docs: {
      description: {
        story: "Thread with multiple back-and-forth messages, demonstrating scrollable content.",
      },
    },
  },
}

// Interactive example with callback
export const Interactive: Story = {
  args: {
    messages: sampleMessages,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Fully interactive thread viewer. Click the Reply button and send a message to see the callback in action (check the Actions panel).",
      },
    },
  },
}

// English conversation
export const EnglishConversation: Story = {
  args: {
    messages: [
      {
        id: "1",
        from: "partner@globaltech.com",
        fromName: "Michael Chen",
        to: "business@company.com",
        subject: "Partnership Proposal for CES 2026",
        body: `Dear Team,

I hope this email finds you well.

We would like to propose a partnership opportunity for CES 2026. Our company specializes in AI-driven solutions and we believe there's great synergy with your products.

Would you be available for a meeting next week to discuss this further?

Best regards,
Michael Chen
Global Tech Solutions`,
        timestamp: "Nov 8, 2025, 10:00 AM",
        isInbound: true,
      },
      {
        id: "2",
        from: "business@company.com",
        fromName: "Business Development",
        to: "partner@globaltech.com",
        subject: "Re: Partnership Proposal for CES 2026",
        body: `Hi Michael,

Thank you for reaching out. We're definitely interested in exploring this opportunity.

How about Tuesday, November 14th at 3 PM EST? We can set up a Zoom call.

Looking forward to hearing from you.

Best,
Business Development Team`,
        timestamp: "Nov 8, 2025, 02:30 PM",
        isInbound: false,
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story: "Example of an English business conversation thread.",
      },
    },
  },
}

// Dark mode preview
export const DarkMode: Story = {
  args: {
    messages: sampleMessages,
  },
  parameters: {
    backgrounds: { default: "dark" },
    docs: {
      description: {
        story: "Email thread viewer in dark mode showing proper contrast and styling.",
      },
    },
  },
}

// With custom styling
export const CustomStyling: Story = {
  args: {
    messages: sampleMessages,
    className: "shadow-lg rounded-xl",
  },
  parameters: {
    docs: {
      description: {
        story: "Thread viewer with custom CSS classes applied.",
      },
    },
  },
}
