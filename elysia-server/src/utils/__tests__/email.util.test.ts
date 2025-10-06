import { describe, expect, test } from "bun:test"
import { extractEmailAddress, parseEmailBody } from "../email.util"

describe("extractEmailAddress", () => {
  test("extracts email from angle bracket format", () => {
    expect(extractEmailAddress("이철희 <wks0968@gmail.com>")).toBe("wks0968@gmail.com")
    expect(extractEmailAddress("GRINDA AI <grindaai1@gmail.com>")).toBe("grindaai1@gmail.com")
  })

  test("extracts email from parenthesis format", () => {
    expect(extractEmailAddress("macminim4pro@MACMINIM4PROui-Macmini.local (MACMINIM4PRO)")).toBe(
      "macminim4pro@MACMINIM4PROui-Macmini.local",
    )
  })

  test("returns plain email address", () => {
    expect(extractEmailAddress("user@example.com")).toBe("user@example.com")
  })

  test("handles empty string", () => {
    expect(extractEmailAddress("")).toBe("")
  })
})

describe("parseEmailBody", () => {
  test("decodes base64 encoded text", () => {
    const sampleEmail = `Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: base64

7JWI64WV7ZWY7IS47JqULA0KDQrrqZTsnbzsnYQg7J6YIOuwm+yVmOyKteuLiOuLpC4g7ZmV7J24IO2bhCDtmozsi6Drk5zrpqzqsqDsirXri4jri6QuDQo=`

    const result = parseEmailBody(sampleEmail)
    expect(result.text).toContain("안녕하세요")
    expect(result.text).toContain("메일을 잘 받았습니다")
  })

  test("decodes base64 encoded HTML", () => {
    const sampleEmail = `Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: base64

PGRpdiBkaXI9Imx0ciI+PGRpdiBjbGFzcz0iZ21haWxfZGVmYXVsdCIgc3R5bGU9ImZvbnQtZmFtaWx5OmFyaWFsLHNhbnMtc2VyaWYiPjxwIHN0eWxlPSJmb250LWZhbWlseTpBcmlhbCxIZWx2ZXRpY2Esc2Fucy1zZXJpZiI+7JWI64WV7ZWY7IS47JqULDwvcD48cCBzdHlsZT0iZm9udC1mYW1pbHk6QXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWYiPuuplOydvOydhCDsnpgg67Cb7JWY7Iq164uI64ukLiDtmZXsnbgg7ZuEIO2ajOyLoOuTnOumrOqyoOyKteuLiOuLpC48L3A+PGJyIGNsYXNzPSJnbWFpbC1BcHBsZS1pbnRlcmNoYW5nZS1uZXdsaW5lIj48L2Rpdj48L2Rpdj4NCg==`

    const result = parseEmailBody(sampleEmail)
    expect(result.html).toContain("<div")
    expect(result.html).toContain("안녕하세요")
    expect(result.html).toContain("메일을 잘 받았습니다")
  })

  test("handles plain text without encoding", () => {
    const sampleEmail = `Content-Type: text/plain

Hello, this is a plain text email.`

    const result = parseEmailBody(sampleEmail)
    expect(result.text).toBe("Hello, this is a plain text email.")
  })

  test("handles multipart emails with base64", () => {
    const sampleEmail = `Content-Type: multipart/alternative; boundary="----=_Part_123"

------=_Part_123
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: base64

VGVzdCBtZXNzYWdl

------=_Part_123
Content-Type: text/html; charset="UTF-8"
Content-Transfer-Encoding: base64

PGh0bWw+VGVzdCBtZXNzYWdlPC9odG1sPg==

------=_Part_123--`

    const result = parseEmailBody(sampleEmail)
    expect(result.text).toBe("Test message")
    expect(result.html).toBe("<html>Test message</html>")
  })

  test("returns undefined for empty content", () => {
    const result = parseEmailBody("")
    expect(result.text).toBeUndefined()
    expect(result.html).toBeUndefined()
  })
})
