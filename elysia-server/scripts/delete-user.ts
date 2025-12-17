// Quick script to delete a user by email (handles foreign key constraints)
import "dotenv/config"
import { eq } from "drizzle-orm"
import { db } from "../src/db"
import { users } from "../src/db/schema"
import { customerGroupMembers, customerGroups } from "../src/db/schema/customer-groups"
import { emailTemplates } from "../src/db/schema/email-templates"
import { emailReplies, emails } from "../src/db/schema/emails"
import {
  iamMemberPolicies,
  iamMemberRoles,
  iamPolicies,
  iamRolePolicies,
  iamWorkspaceRoles,
} from "../src/db/schema/iam"
import { leads } from "../src/db/schema/leads"
import { sequenceEnrollments, sequences } from "../src/db/schema/sequences"
import { workspaceMembers, workspaces } from "../src/db/schema/workspaces"

const EMAIL_TO_DELETE = "zalatanback2@gmail.com"

async function deleteUser() {
  console.log(`Deleting user with email: ${EMAIL_TO_DELETE}`)

  // Find the user first
  const [user] = await db.select().from(users).where(eq(users.email, EMAIL_TO_DELETE))

  if (!user) {
    console.log("User not found")
    return
  }

  console.log(`Found user: ${user.id} (${user.username})`)

  // Nullify references in tables that allow it
  console.log("Nullifying foreign key references...")

  await db.update(sequences).set({ createdBy: null }).where(eq(sequences.createdBy, user.id))
  await db
    .update(sequenceEnrollments)
    .set({ enrolledBy: null })
    .where(eq(sequenceEnrollments.enrolledBy, user.id))
  await db.update(leads).set({ createdBy: null }).where(eq(leads.createdBy, user.id))
  await db
    .update(customerGroups)
    .set({ createdBy: null })
    .where(eq(customerGroups.createdBy, user.id))
  await db
    .update(customerGroupMembers)
    .set({ addedBy: null })
    .where(eq(customerGroupMembers.addedBy, user.id))
  await db
    .update(emailTemplates)
    .set({ createdBy: null })
    .where(eq(emailTemplates.createdBy, user.id))
  await db
    .update(emailReplies)
    .set({ assignedTo: null })
    .where(eq(emailReplies.assignedTo, user.id))

  // IAM tables - nullify references
  await db.update(iamPolicies).set({ createdBy: null }).where(eq(iamPolicies.createdBy, user.id))
  await db
    .update(iamWorkspaceRoles)
    .set({ createdBy: null })
    .where(eq(iamWorkspaceRoles.createdBy, user.id))
  await db
    .update(iamRolePolicies)
    .set({ attachedBy: null })
    .where(eq(iamRolePolicies.attachedBy, user.id))
  await db
    .update(iamMemberRoles)
    .set({ grantedBy: null })
    .where(eq(iamMemberRoles.grantedBy, user.id))
  await db
    .update(iamMemberPolicies)
    .set({ attachedBy: null })
    .where(eq(iamMemberPolicies.attachedBy, user.id))

  // Handle workspace ownership - delete owned workspaces and their data
  const ownedWorkspaces = await db.select().from(workspaces).where(eq(workspaces.ownerId, user.id))
  if (ownedWorkspaces.length > 0) {
    console.log(`User owns ${ownedWorkspaces.length} workspace(s) - cleaning up and deleting...`)

    // Delete workspace-related data first (RESTRICT constraints)
    for (const ws of ownedWorkspaces) {
      console.log(`  Cleaning workspace ${ws.id}...`)
      await db.delete(emails).where(eq(emails.workspaceId, ws.id))
      await db.delete(sequences).where(eq(sequences.workspaceId, ws.id))
      await db.delete(leads).where(eq(leads.workspaceId, ws.id))
      await db.delete(customerGroups).where(eq(customerGroups.workspaceId, ws.id))
      await db.delete(emailTemplates).where(eq(emailTemplates.workspaceId, ws.id))
    }

    // Now delete workspaces
    await db.delete(workspaces).where(eq(workspaces.ownerId, user.id))
  }

  // Delete workspace memberships (cascade should handle this, but being explicit)
  await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, user.id))

  // Now delete the user (cascade will handle: billing, email-accounts, chat-conversations, user-signature-preferences)
  console.log("Deleting user...")
  const result = await db.delete(users).where(eq(users.id, user.id)).returning()

  console.log(`Deleted user:`, result[0])
}

deleteUser()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error:", err)
    process.exit(1)
  })
