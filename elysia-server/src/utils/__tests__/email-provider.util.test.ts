import { describe, expect, test } from "bun:test"
import { isFreeEmailProvider, shouldFilterGenericEmail } from "../email-provider.util"

describe("email-provider.util", () => {
  describe("isFreeEmailProvider", () => {
    test("should detect Gmail domains", () => {
      expect(isFreeEmailProvider("user@gmail.com")).toBe(true)
      expect(isFreeEmailProvider("user@googlemail.com")).toBe(true)
      expect(isFreeEmailProvider("USER@GMAIL.COM")).toBe(true) // case insensitive
    })

    test("should detect Yahoo domains", () => {
      expect(isFreeEmailProvider("user@yahoo.com")).toBe(true)
      expect(isFreeEmailProvider("user@yahoo.co.uk")).toBe(true)
      expect(isFreeEmailProvider("user@yahoo.co.jp")).toBe(true)
      expect(isFreeEmailProvider("user@yahoo.fr")).toBe(true)
    })

    test("should detect Hotmail/Outlook/Microsoft domains", () => {
      expect(isFreeEmailProvider("user@hotmail.com")).toBe(true)
      expect(isFreeEmailProvider("user@hotmail.co.uk")).toBe(true)
      expect(isFreeEmailProvider("user@outlook.com")).toBe(true)
      expect(isFreeEmailProvider("user@live.com")).toBe(true)
      expect(isFreeEmailProvider("user@msn.com")).toBe(true)
    })

    test("should detect other common free email providers", () => {
      expect(isFreeEmailProvider("user@aol.com")).toBe(true)
      expect(isFreeEmailProvider("user@icloud.com")).toBe(true)
      expect(isFreeEmailProvider("user@me.com")).toBe(true)
      expect(isFreeEmailProvider("user@mac.com")).toBe(true)
      expect(isFreeEmailProvider("user@protonmail.com")).toBe(true)
      expect(isFreeEmailProvider("user@protonmail.ch")).toBe(true)
      expect(isFreeEmailProvider("user@pm.me")).toBe(true)
      expect(isFreeEmailProvider("user@zoho.com")).toBe(true)
      expect(isFreeEmailProvider("user@mail.com")).toBe(true)
      expect(isFreeEmailProvider("user@yandex.com")).toBe(true)
      expect(isFreeEmailProvider("user@gmx.com")).toBe(true)
    })

    test("should NOT detect company domains as free providers", () => {
      expect(isFreeEmailProvider("contact@stripe.com")).toBe(false)
      expect(isFreeEmailProvider("info@company.com")).toBe(false)
      expect(isFreeEmailProvider("sales@example.org")).toBe(false)
      expect(isFreeEmailProvider("support@business.co")).toBe(false)
    })

    test("should handle invalid email formats gracefully", () => {
      expect(isFreeEmailProvider("")).toBe(false)
      expect(isFreeEmailProvider("notanemail")).toBe(false)
      expect(isFreeEmailProvider("@gmail.com")).toBe(false)
      expect(isFreeEmailProvider("user@")).toBe(false)
    })

    test("should be case insensitive", () => {
      expect(isFreeEmailProvider("USER@GMAIL.COM")).toBe(true)
      expect(isFreeEmailProvider("User@Gmail.Com")).toBe(true)
      expect(isFreeEmailProvider("contact@STRIPE.COM")).toBe(false)
    })
  })

  describe("shouldFilterGenericEmail", () => {
    test("should filter generic emails on free providers", () => {
      expect(shouldFilterGenericEmail("contact@gmail.com", "generic")).toBe(true)
      expect(shouldFilterGenericEmail("info@yahoo.com", "generic")).toBe(true)
      expect(shouldFilterGenericEmail("support@hotmail.com", "generic")).toBe(true)
      expect(shouldFilterGenericEmail("sales@outlook.com", "generic")).toBe(true)
    })

    test("should NOT filter personal emails on free providers", () => {
      expect(shouldFilterGenericEmail("ceo@gmail.com", "personal")).toBe(false)
      expect(shouldFilterGenericEmail("founder@yahoo.com", "personal")).toBe(false)
      expect(shouldFilterGenericEmail("john.doe@hotmail.com", "personal")).toBe(false)
      expect(shouldFilterGenericEmail("executive@outlook.com", "personal")).toBe(false)
    })

    test("should NOT filter generic emails on company domains", () => {
      expect(shouldFilterGenericEmail("contact@stripe.com", "generic")).toBe(false)
      expect(shouldFilterGenericEmail("info@company.com", "generic")).toBe(false)
      expect(shouldFilterGenericEmail("sales@business.org", "generic")).toBe(false)
    })

    test("should NOT filter personal emails on company domains", () => {
      expect(shouldFilterGenericEmail("ceo@stripe.com", "personal")).toBe(false)
      expect(shouldFilterGenericEmail("john@company.com", "personal")).toBe(false)
      expect(shouldFilterGenericEmail("founder@startup.io", "personal")).toBe(false)
    })

    test("should handle edge cases", () => {
      // Empty email
      expect(shouldFilterGenericEmail("", "generic")).toBe(false)
      expect(shouldFilterGenericEmail("", "personal")).toBe(false)

      // Invalid email
      expect(shouldFilterGenericEmail("notanemail", "generic")).toBe(false)
      expect(shouldFilterGenericEmail("notanemail", "personal")).toBe(false)
    })

    test("personal emails should NEVER be filtered regardless of domain", () => {
      // Even on free providers
      expect(shouldFilterGenericEmail("anything@gmail.com", "personal")).toBe(false)
      expect(shouldFilterGenericEmail("whatever@yahoo.com", "personal")).toBe(false)

      // Company domains
      expect(shouldFilterGenericEmail("anything@company.com", "personal")).toBe(false)
    })
  })

  describe("integration scenarios", () => {
    test("C-level executive on Gmail should NOT be filtered (personal)", () => {
      const email = "ceo@gmail.com"
      const type = "personal"

      expect(isFreeEmailProvider(email)).toBe(true) // It IS on a free provider
      expect(shouldFilterGenericEmail(email, type)).toBe(false) // But should NOT be filtered
    })

    test("Generic contact email on Gmail should be filtered", () => {
      const email = "contact@gmail.com"
      const type = "generic"

      expect(isFreeEmailProvider(email)).toBe(true) // It IS on a free provider
      expect(shouldFilterGenericEmail(email, type)).toBe(true) // And SHOULD be filtered
    })

    test("Generic contact email on company domain should NOT be filtered", () => {
      const email = "contact@stripe.com"
      const type = "generic"

      expect(isFreeEmailProvider(email)).toBe(false) // It's NOT on a free provider
      expect(shouldFilterGenericEmail(email, type)).toBe(false) // Should NOT be filtered
    })

    test("Personal executive email on company domain should NOT be filtered", () => {
      const email = "ceo@stripe.com"
      const type = "personal"

      expect(isFreeEmailProvider(email)).toBe(false) // It's NOT on a free provider
      expect(shouldFilterGenericEmail(email, type)).toBe(false) // Should NOT be filtered
    })
  })
})
