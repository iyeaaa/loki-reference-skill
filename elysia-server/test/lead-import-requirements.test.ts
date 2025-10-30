import "dotenv/config"
import { describe, expect, it, beforeAll, afterAll } from "bun:test"
import { db } from "../src/db"
import { customerGroups, departments, leads, leadContacts, users, workspaces } from "../src/db/schema"
import { eq } from "drizzle-orm"

// Helpers
import { generateTestCredentials, signIn, signUp } from "./helpers/auth.helper"
import { uploadExcelFile } from "./helpers/lead-upload.helper"

// Fixtures
import { generateTestExcel } from "./fixtures/excel.fixture"

/**
 * Integration Tests for Ticket Requirements - REST API Testing
 *
 * NOTE: These tests require the server to be running on the port specified in .env (default: 3001)
 * Run the server with: bun run dev
 * Then restart the server after fixing the response transformer
 *
 * Requirement 1: 업로드 시 워크스페이스 내 이메일 중복은 시스템이 자동 방지/알림
 * (During upload, automatically prevent/alert for duplicate emails within workspace)
 * - CSV 파일 내부의 중복 이메일 감지
 * - 기존 데이터베이스 워크스페이스 내 중복 이메일 감지
 *
 * Requirement 2: DB 업로드 시 그룹(들)에 포함되는지 명확히 태그로 표시
 * (Clearly indicate with tags which group(s) data belongs to during DB upload)
 */
describe("Requirements Test - REST API - Duplicate Email Prevention & Group Tags", () => {
  // Server configuration
  const serverPort = process.env.PORT || 3001
  const baseUrl = `http://localhost:${serverPort}`

  // Test data IDs
  let testDepartmentId: string
  let testUserId: string
  let testWorkspaceId: string
  let testGroupId: string
  let existingLeadId: string
  let authToken: string

  // Test credentials
  const timestamp = Date.now()
  let testCredentials: ReturnType<typeof generateTestCredentials>

  beforeAll(async () => {
    console.log("🔧 Setting up test environment...")

    // Step 1: Create department
    console.log("  ✓ Creating test department...")
    const [dept] = await db
      .insert(departments)
      .values({
        name: `Integration Test Dept ${timestamp}`,
        code: `INTG_${timestamp}`,
        description: "For integration testing",
      })
      .returning({ id: departments.id })

    testDepartmentId = dept!.id

    // Step 2: Generate test credentials
    testCredentials = generateTestCredentials(testDepartmentId)

    // Step 3: Sign up new user
    console.log("  ✓ Signing up test user...")
    await signUp(baseUrl, testCredentials)

    // Step 4: Sign in and get token
    console.log("  ✓ Signing in...")
    authToken = await signIn(baseUrl, testCredentials.email, testCredentials.password)

    // Step 5: Get user ID from database
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, testCredentials.email))
      .limit(1)

    testUserId = user!.id

    // Step 6: Create workspace
    console.log("  ✓ Creating test workspace...")
    const [workspace] = await db
      .insert(workspaces)
      .values({
        name: "Integration Test Workspace",
        description: "Workspace for integration testing",
        ownerId: testUserId,
      })
      .returning({ id: workspaces.id })

    testWorkspaceId = workspace!.id

    // Step 7: Create customer group
    console.log("  ✓ Creating test customer group...")
    const [group] = await db
      .insert(customerGroups)
      .values({
        workspaceId: testWorkspaceId,
        name: "Integration Test Group",
        description: "Group for integration testing",
        createdBy: testUserId,
      })
      .returning({ id: customerGroups.id })

    testGroupId = group!.id

    // Step 8: Create existing lead with duplicate email
    console.log("  ✓ Creating existing lead with duplicate email...")
    const [existingLead] = await db
      .insert(leads)
      .values({
        workspaceId: testWorkspaceId,
        companyName: "Existing Company With Email",
        websiteUrl: "https://existing-with-email.com",
        createdBy: testUserId,
      })
      .returning({ id: leads.id })

    existingLeadId = existingLead!.id

    // Add existing email to create duplicate scenario
    await db.insert(leadContacts).values({
      leadId: existingLeadId,
      contactType: "email",
      contactValue: "duplicate@example.com",
      isPrimary: true,
    })

    console.log("✅ Test environment ready!")
  })

  afterAll(async () => {
    console.log("🧹 Cleaning up test data...")

    // Cleanup in reverse order of dependencies
    if (testWorkspaceId) {
      console.log("  ✓ Deleting test workspace (cascades to leads, contacts, groups)...")
      await db.delete(workspaces).where(eq(workspaces.id, testWorkspaceId))
    }

    if (testUserId) {
      console.log("  ✓ Deleting test user...")
      await db.delete(users).where(eq(users.id, testUserId))
    }

    if (testDepartmentId) {
      console.log("  ✓ Deleting test department...")
      await db.delete(departments).where(eq(departments.id, testDepartmentId))
    }

    console.log("✅ Cleanup complete!")
  })

  /**
   * REQUIREMENT 1: 업로드 시 워크스페이스 내 이메일 중복은 시스템이 자동 방지/알림
   * Test that the system automatically prevents/alerts for duplicate emails within workspace
   */
  describe("Requirement 1: Duplicate Email Prevention & Notification", () => {
    it("should detect duplicate emails against existing database records", async () => {
      // Upload a file with an email that already exists in the database
      const excelBuffer = generateTestExcel([
        {
          companyName: "New Company A",
          websiteUrl: "https://newcompanya.com",
          email: "duplicate@example.com", // This email already exists
        },
      ])

      const result = await uploadExcelFile(baseUrl, excelBuffer, testWorkspaceId, authToken)

      // ✅ System should detect duplicate email
      expect(result).toBeDefined()
      expect(result.emailsSkipped).toBeGreaterThan(0)
      expect(result.duplicateEmails).toBeDefined()
      expect(Array.isArray(result.duplicateEmails)).toBe(true)
      expect(result.duplicateEmails.length).toBeGreaterThan(0)
    })

    it("should provide notification details for database duplicate emails", async () => {
      const excelBuffer = generateTestExcel([
        {
          companyName: "Company With Duplicate Email",
          websiteUrl: "https://company-duplicate.com",
          email: "duplicate@example.com", // This email already exists
        },
      ])

      const result = await uploadExcelFile(baseUrl, excelBuffer, testWorkspaceId, authToken)

      // ✅ Notification should include detailed information
      expect(result.duplicateEmails.length).toBeGreaterThan(0)

      const duplicateInfo = result.duplicateEmails[0]!
      expect(duplicateInfo).toHaveProperty("email")
      expect(duplicateInfo).toHaveProperty("existingLeadId")
      expect(duplicateInfo).toHaveProperty("rowNumber")
      expect(duplicateInfo).toHaveProperty("companyName")

      // ✅ Verify the duplicate email is correctly identified
      expect(duplicateInfo.email).toBe("duplicate@example.com")
      expect(duplicateInfo.existingLeadId).toBe(existingLeadId)
      expect(duplicateInfo.companyName).toBe("Company With Duplicate Email")
    })

    it("should detect duplicate emails within the CSV file itself", async () => {
      // Upload a file with duplicate emails within the same CSV
      const excelBuffer = generateTestExcel([
        {
          companyName: "Company One",
          websiteUrl: "https://company-one-csv.com",
          email: "csv-duplicate@example.com", // First occurrence
        },
        {
          companyName: "Company Two",
          websiteUrl: "https://company-two-csv.com",
          email: "csv-duplicate@example.com", // Duplicate within CSV
        },
        {
          companyName: "Company Three",
          websiteUrl: "https://company-three-csv.com",
          email: "csv-duplicate@example.com", // Another duplicate
        },
      ])

      const result = await uploadExcelFile(baseUrl, excelBuffer, testWorkspaceId, authToken)

      // ✅ System should detect CSV internal duplicates
      expect(result).toBeDefined()
      expect(result.emailsSkipped).toBeGreaterThan(0)
      expect(result.duplicateEmails).toBeDefined()

      // ✅ Should have duplicate entries for rows 2 and 3
      const csvDuplicates = result.duplicateEmails.filter(
        (d: any) => d.email === "csv-duplicate@example.com"
      )
      expect(csvDuplicates.length).toBeGreaterThan(0)

      // ✅ Check that it marks them as CSV duplicates
      const csvDup = csvDuplicates.find((d: any) => d.existingLeadId === "CSV_DUPLICATE")
      expect(csvDup).toBeDefined()
    })

    it("should prioritize database duplicates over CSV duplicates", async () => {
      // Upload a file with an email that exists in DB AND is duplicated in CSV
      const excelBuffer = generateTestExcel([
        {
          companyName: "Company Alpha",
          websiteUrl: "https://company-alpha.com",
          email: "duplicate@example.com", // Already in DB
        },
        {
          companyName: "Company Beta",
          websiteUrl: "https://company-beta.com",
          email: "duplicate@example.com", // Also a CSV duplicate
        },
      ])

      const result = await uploadExcelFile(baseUrl, excelBuffer, testWorkspaceId, authToken)

      // ✅ Should detect duplicates
      expect(result.emailsSkipped).toBeGreaterThan(0)

      // ✅ Should reference the existing lead ID from database (not CSV_DUPLICATE)
      const dbDuplicates = result.duplicateEmails.filter(
        (d: any) => d.email === "duplicate@example.com" && d.existingLeadId === existingLeadId
      )
      expect(dbDuplicates.length).toBeGreaterThan(0)
    })
  })

  /**
   * REQUIREMENT 2: DB 업로드 시 그룹(들)에 포함되는지 명확히 태그로 표시
   * Test that group assignment is clearly indicated with tags during upload
   */
  describe("Requirement 2: Group Tag Display During Upload", () => {
    it("should clearly show group assignment in upload result", async () => {
      const excelBuffer = generateTestExcel([
        {
          companyName: "Group Test Company A",
          websiteUrl: "https://grouptest-a.com",
          email: "grouptesta@example.com",
        },
        {
          companyName: "Group Test Company B",
          websiteUrl: "https://grouptest-b.com",
          email: "grouptestb@example.com",
        },
      ])

      const result = await uploadExcelFile(baseUrl, excelBuffer, testWorkspaceId, authToken, testGroupId)

      // ✅ Should have group assignment information
      expect(result.groupAssignment).not.toBeNull()
      expect(result.groupAssignment).toBeDefined()
    })

    it("should include group ID in group assignment tag", async () => {
      const excelBuffer = generateTestExcel([
        {
          companyName: "Group Test Company C",
          websiteUrl: "https://grouptest-c.com",
          email: "grouptestc@example.com",
        },
      ])

      const result = await uploadExcelFile(baseUrl, excelBuffer, testWorkspaceId, authToken, testGroupId)

      // ✅ Group assignment should include group ID
      expect(result.groupAssignment).not.toBeNull()
      expect(result.groupAssignment.groupId).toBe(testGroupId)
    })

    it("should include group name in group assignment tag", async () => {
      const excelBuffer = generateTestExcel([
        {
          companyName: "Group Test Company D",
          websiteUrl: "https://grouptest-d.com",
          email: "grouptestd@example.com",
        },
      ])

      const result = await uploadExcelFile(baseUrl, excelBuffer, testWorkspaceId, authToken, testGroupId)

      // ✅ Group assignment should include group name
      expect(result.groupAssignment).not.toBeNull()
      expect(result.groupAssignment.groupName).toBe("Integration Test Group")
    })

    it("should show number of members added to group", async () => {
      const excelBuffer = generateTestExcel([
        {
          companyName: "Group Test Company E",
          websiteUrl: "https://grouptest-e.com",
          email: "groupteste@example.com",
        },
        {
          companyName: "Group Test Company F",
          websiteUrl: "https://grouptest-f.com",
          email: "grouptestf@example.com",
        },
      ])

      const result = await uploadExcelFile(baseUrl, excelBuffer, testWorkspaceId, authToken, testGroupId)

      // ✅ Should show count of members added
      expect(result.groupAssignment).not.toBeNull()
      expect(result.groupAssignment.membersAdded).toBeGreaterThan(0)
      expect(result.groupAssignment.membersAdded).toBe(2)
    })

    it("should return null for group assignment when no group provided", async () => {
      const excelBuffer = generateTestExcel([
        {
          companyName: "No Group Company",
          websiteUrl: "https://nogroup.com",
          email: "nogroup@example.com",
        },
      ])

      const result = await uploadExcelFile(baseUrl, excelBuffer, testWorkspaceId, authToken) // No groupId

      // ✅ Group assignment should be null
      expect(result.groupAssignment).toBeNull()
    })
  })
})
