import type { Preview } from "@storybook/react"
import React, { useEffect } from "react"
import { I18nextProvider } from "react-i18next"
import i18n from "../src/i18n/i18n"
import "../src/index.css"

// Initialize i18n for Storybook
i18n.init()

const preview: Preview = {
  // Enable autodocs globally for all stories
  tags: ["autodocs"],
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "light",
      values: [
        {
          name: "light",
          value: "#ffffff",
        },
        {
          name: "dark",
          value: "#09090b",
        },
      ],
    },
  },
  globalTypes: {
    locale: {
      description: "Internationalization locale",
      defaultValue: "en",
      toolbar: {
        icon: "globe",
        items: [
          { value: "en", title: "English" },
          { value: "ko", title: "한국어" },
        ],
        showName: true,
      },
    },
    theme: {
      description: "Global theme for components",
      defaultValue: "light",
      toolbar: {
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        showName: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const locale = context.globals.locale
      const theme = context.globals.theme

      useEffect(() => {
        // Update i18n language
        i18n.changeLanguage(locale)
      }, [locale])

      useEffect(() => {
        // Update theme class on document
        if (theme === "dark") {
          document.documentElement.classList.add("dark")
        } else {
          document.documentElement.classList.remove("dark")
        }
      }, [theme])

      return (
        <I18nextProvider i18n={i18n}>
          <div className={theme === "dark" ? "dark" : ""}>
            <div className="min-h-screen bg-background text-foreground p-8">
              <Story />
            </div>
          </div>
        </I18nextProvider>
      )
    },
  ],
}

export default preview
