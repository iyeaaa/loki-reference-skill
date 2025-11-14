import type { Meta, StoryObj } from "@storybook/react"
import { AIFollowUpSuggestion } from "./AIFollowUpSuggestion"

const meta = {
  title: "Components/AIFollowUpSuggestion",
  component: AIFollowUpSuggestion,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    onGenerateSuggestion: { action: "generate-clicked" },
    isLoading: {
      control: "boolean",
      description: "Shows loading state",
    },
    error: {
      control: "text",
      description: "Error message to display",
    },
    disabled: {
      control: "boolean",
      description: "Disables the generate button",
    },
  },
} satisfies Meta<typeof AIFollowUpSuggestion>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onGenerateSuggestion: async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      console.log("Suggestion generated!")
    },
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
    onGenerateSuggestion: async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    },
  },
}

export const WithError: Story = {
  args: {
    error: "Unable to connect. Is the computer able to access the url?",
    onGenerateSuggestion: async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    },
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
    onGenerateSuggestion: async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    },
  },
}

export const WithCustomWidth: Story = {
  args: {
    className: "w-[500px]",
    onGenerateSuggestion: async () => {
      await new Promise((resolve) => setTimeout(resolve, 2000))
    },
  },
}

export const Interactive: Story = {
  args: {
    onGenerateSuggestion: async () => {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500))
      alert("AI suggestion generated successfully!")
    },
  },
}
