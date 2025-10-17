import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index";
import { customerGroupMembers } from "../db/schema/customer-groups";
import { leadContacts } from "../db/schema/lead-details";
import { leads } from "../db/schema/leads";
import { sequences } from "../db/schema/sequences";
import { workflowGeneratedEmails } from "../db/schema/workflow-emails";
import { getAIEmailService } from "../lib/ai-email-service";

// ====================================
// WORKFLOW GENERATED EMAILS CRUD
// ====================================

// Get generated emails for a node
export async function getGeneratedEmailsByNode(
  sequenceId: string,
  nodeId: string
) {
  const result = await db
    .select({
      id: workflowGeneratedEmails.id,
      sequenceId: workflowGeneratedEmails.sequenceId,
      nodeId: workflowGeneratedEmails.nodeId,
      leadId: workflowGeneratedEmails.leadId,
      subject: workflowGeneratedEmails.subject,
      bodyText: workflowGeneratedEmails.bodyText,
      bodyHtml: workflowGeneratedEmails.bodyHtml,
      status: workflowGeneratedEmails.status,
      generationMode: workflowGeneratedEmails.generationMode,
      aiPrompt: workflowGeneratedEmails.aiPrompt,
      aiModel: workflowGeneratedEmails.aiModel,
      generationError: workflowGeneratedEmails.generationError,
      generatedAt: workflowGeneratedEmails.generatedAt,
      editedAt: workflowGeneratedEmails.editedAt,
      createdAt: workflowGeneratedEmails.createdAt,
      updatedAt: workflowGeneratedEmails.updatedAt,
      companyName: leads.companyName,
      businessType: leads.businessType,
      contactEmail: leadContacts.contactValue,
    })
    .from(workflowGeneratedEmails)
    .innerJoin(leads, eq(workflowGeneratedEmails.leadId, leads.id))
    .leftJoin(
      leadContacts,
      and(
        eq(leadContacts.leadId, leads.id),
        eq(leadContacts.contactType, "email"),
        eq(leadContacts.isPrimary, true)
      )
    )
    .where(
      and(
        eq(workflowGeneratedEmails.sequenceId, sequenceId),
        eq(workflowGeneratedEmails.nodeId, nodeId)
      )
    )
    .orderBy(desc(workflowGeneratedEmails.createdAt));

  // Map to flat structure
  return result.map((row) => ({
    ...row,
    contactName: row.companyName || "담당자",
    industry: row.businessType || "",
  }));
}

// Get single generated email
export async function getGeneratedEmail(emailId: string) {
  const result = await db
    .select({
      id: workflowGeneratedEmails.id,
      sequenceId: workflowGeneratedEmails.sequenceId,
      nodeId: workflowGeneratedEmails.nodeId,
      leadId: workflowGeneratedEmails.leadId,
      subject: workflowGeneratedEmails.subject,
      bodyText: workflowGeneratedEmails.bodyText,
      bodyHtml: workflowGeneratedEmails.bodyHtml,
      status: workflowGeneratedEmails.status,
      generationMode: workflowGeneratedEmails.generationMode,
      aiPrompt: workflowGeneratedEmails.aiPrompt,
      aiModel: workflowGeneratedEmails.aiModel,
      generationError: workflowGeneratedEmails.generationError,
      generatedAt: workflowGeneratedEmails.generatedAt,
      editedAt: workflowGeneratedEmails.editedAt,
      createdAt: workflowGeneratedEmails.createdAt,
      updatedAt: workflowGeneratedEmails.updatedAt,
      companyName: leads.companyName,
      businessType: leads.businessType,
      contactEmail: leadContacts.contactValue,
    })
    .from(workflowGeneratedEmails)
    .innerJoin(leads, eq(workflowGeneratedEmails.leadId, leads.id))
    .leftJoin(
      leadContacts,
      and(
        eq(leadContacts.leadId, leads.id),
        eq(leadContacts.contactType, "email"),
        eq(leadContacts.isPrimary, true)
      )
    )
    .where(eq(workflowGeneratedEmails.id, emailId))
    .limit(1);

  if (result.length === 0) return null;

  const row = result[0];
  if (!row) return null;
  return {
    ...row,
    contactName: row.companyName || "담당자",
    industry: row.businessType || "",
  };
}

// Create or update generated email
export async function upsertGeneratedEmail(data: {
  sequenceId: string;
  nodeId: string;
  leadId: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  status?: "pending" | "generating" | "generated" | "edited" | "failed";
  generationMode?: "ai" | "manual" | "template";
  mode?: "ai" | "manual" | "template"; // From frontend
  aiPrompt?: string;
  aiModel?: string;
  generationError?: string;
  contextSnapshot?: Record<string, unknown>;
}) {
  // If AI mode and no content yet, generate content
  if (
    (data.generationMode === "ai" || data.mode === "ai") &&
    (!data.subject || !data.bodyText)
  ) {
    try {
      // Get lead info for AI context
      const [lead] = await db
        .select({
          companyName: leads.companyName,
          businessType: leads.businessType,
          websiteUrl: leads.websiteUrl,
        })
        .from(leads)
        .where(eq(leads.id, data.leadId))
        .limit(1);

      if (!lead) {
        throw new Error("리드 정보를 찾을 수 없습니다");
      }

      // Generate email content using AI
      const aiService = getAIEmailService();
      const result = await aiService.generateSequenceEmail({
        companyName: lead.companyName || "",
        industry: lead.businessType || undefined,
        website: lead.websiteUrl || undefined,
        prompt: data.aiPrompt,
      });

      if (!result.success) {
        throw new Error(result.error || "AI 이메일 생성 실패");
      }

      // Update data with AI generated content
      data.subject = result.subject || "";
      data.bodyText = result.bodyText;
      data.status = "generated";
    } catch (error) {
      data.status = "failed";
      data.generationError =
        error instanceof Error ? error.message : "알 수 없는 오류";
    }
  }

  // Check if email already exists
  const existing = await db
    .select({ id: workflowGeneratedEmails.id })
    .from(workflowGeneratedEmails)
    .where(
      and(
        eq(workflowGeneratedEmails.sequenceId, data.sequenceId),
        eq(workflowGeneratedEmails.nodeId, data.nodeId),
        eq(workflowGeneratedEmails.leadId, data.leadId)
      )
    )
    .limit(1);

  const existingEmail = existing[0];
  if (existingEmail) {
    // Update existing
    const [updated] = await db
      .update(workflowGeneratedEmails)
      .set({
        subject: data.subject,
        bodyText: data.bodyText,
        bodyHtml: data.bodyHtml,
        status: data.status,
        generationMode: data.generationMode,
        aiPrompt: data.aiPrompt,
        aiModel: data.aiModel,
        generationError: data.generationError,
        contextSnapshot: data.contextSnapshot,
        generatedAt: data.status === "generated" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(workflowGeneratedEmails.id, existingEmail.id))
      .returning();

    return updated;
  }

  // Insert new
  const [newEmail] = await db
    .insert(workflowGeneratedEmails)
    .values({
      sequenceId: data.sequenceId,
      nodeId: data.nodeId,
      leadId: data.leadId,
      subject: data.subject,
      bodyText: data.bodyText || null,
      bodyHtml: data.bodyHtml || null,
      status: data.status || "pending",
      generationMode: data.mode || data.generationMode || "manual",
      aiPrompt: data.aiPrompt || null,
      aiModel: data.aiModel || null,
      generationError: data.generationError || null,
      contextSnapshot: data.contextSnapshot || {},
      generatedAt: data.status === "generated" ? new Date() : null,
    })
    .returning();

  return newEmail;
}

// Update generated email
export async function updateGeneratedEmail(
  emailId: string,
  data: {
    subject?: string;
    bodyText?: string;
    bodyHtml?: string;
    status?: "pending" | "generating" | "generated" | "edited" | "failed";
  }
) {
  const [updated] = await db
    .update(workflowGeneratedEmails)
    .set({
      ...data,
      editedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowGeneratedEmails.id, emailId))
    .returning();

  return updated;
}

// Delete generated email
export async function deleteGeneratedEmail(emailId: string) {
  await db
    .delete(workflowGeneratedEmails)
    .where(eq(workflowGeneratedEmails.id, emailId));
}

// Delete all generated emails for a node
export async function deleteGeneratedEmailsByNode(
  sequenceId: string,
  nodeId: string
) {
  await db
    .delete(workflowGeneratedEmails)
    .where(
      and(
        eq(workflowGeneratedEmails.sequenceId, sequenceId),
        eq(workflowGeneratedEmails.nodeId, nodeId)
      )
    );
}

// Get leads for sequence (for email generation)
export async function getSequenceLeads(sequenceId: string) {
  // Get sequence's customer group
  const [sequence] = await db
    .select({ customerGroupId: sequences.customerGroupId })
    .from(sequences)
    .where(eq(sequences.id, sequenceId))
    .limit(1);

  if (!sequence?.customerGroupId) {
    // No customer group assigned, return empty array
    return [];
  }

  // Get leads from customer group members with primary email contact and phone
  const result = await db
    .select({
      id: leads.id,
      companyName: leads.companyName,
      businessType: leads.businessType,
      websiteUrl: leads.websiteUrl,
      description: leads.description,
      address: leads.address,
      country: leads.country,
      city: leads.city,
      state: leads.state,
      foundedYear: leads.foundedYear,
      employeeCount: leads.employeeCount,
      leadSource: leads.leadSource,
      leadStatus: leads.leadStatus,
      leadScore: leads.leadScore,
      contactEmail: leadContacts.contactValue,
    })
    .from(customerGroupMembers)
    .innerJoin(leads, eq(customerGroupMembers.leadId, leads.id))
    .leftJoin(
      leadContacts,
      and(
        eq(leadContacts.leadId, leads.id),
        eq(leadContacts.contactType, "email"),
        eq(leadContacts.isPrimary, true)
      )
    )
    .where(eq(customerGroupMembers.groupId, sequence.customerGroupId));

  // Map to flat structure with proper field mapping
  return result.map((row) => ({
    id: row.id,
    companyName: row.companyName || "",
    contactName: row.companyName || "담당자",
    contactEmail: row.contactEmail || "",
    industry: row.businessType || "",
    website: row.websiteUrl || "",
    description: row.description || "",
    address: row.address || "",
    country: row.country || "",
    city: row.city || "",
    state: row.state || "",
    foundedYear: row.foundedYear?.toString() || "",
    employeeCount: row.employeeCount || "",
    leadSource: row.leadSource || "",
    leadStatus: row.leadStatus || "",
    leadScore: row.leadScore?.toString() || "",
    size: undefined,
  }));
}

// Replace template variables
/**
 * 템플릿 변수를 실제 값으로 치환
 * 영문 변수 ({{company_name}}, {{website}}, ...)와 한글 변수 ({{회사명}}, {{웹사이트}}, ...) 모두 지원
 */
export function replaceTemplateVariables(
  template: string,
  context: {
    companyName?: string;
    contactName?: string;
    contactEmail?: string;
    industry?: string;
    businessType?: string;
    website?: string;
    description?: string;
    address?: string;
    country?: string;
    city?: string;
    state?: string;
    foundedYear?: string;
    employeeCount?: string;
    leadSource?: string;
    leadStatus?: string;
    leadScore?: string;
    [key: string]: string | undefined;
  }
): string {
  let result = template;

  // 영문 변수 매핑 (snake_case)
  const englishMap: Record<string, string> = {
    // 회사 정보
    company_name: context.companyName || "",
    companyName: context.companyName || "",
    website: context.website || "",
    industry: context.industry || "",
    business_type: context.businessType || "",
    businessType: context.businessType || "",
    description: context.description || "",
    employee_count: context.employeeCount || "",
    employeeCount: context.employeeCount || "",
    founded_year: context.foundedYear || "",
    foundedYear: context.foundedYear || "",

    // 위치 정보
    country: context.country || "",
    city: context.city || "",
    state: context.state || "",
    address: context.address || "",

    // 연락처
    contact_name: context.contactName || "",
    contactName: context.contactName || "",
    contact_email: context.contactEmail || "",
    contactEmail: context.contactEmail || "",
    email: context.contactEmail || "",

    // 리드 관리
    lead_source: context.leadSource || "",
    leadSource: context.leadSource || "",
    lead_status: context.leadStatus || "",
    leadStatus: context.leadStatus || "",
    lead_score: context.leadScore || "",
    leadScore: context.leadScore || "",
  };

  // 한글 변수 매핑
  const koreanMap: Record<string, string> = {
    // 회사 정보
    회사명: context.companyName || "",
    웹사이트: context.website || "",
    업종: context.businessType || "",
    설명: context.description || "",
    직원수: context.employeeCount || "",
    설립연도: context.foundedYear || "",

    // 위치 정보
    국가: context.country || "",
    도시: context.city || "",
    주: context.state || "",
    "주/도": context.state || "",
    주소: context.address || "",

    // 연락처
    담당자명: context.contactName || "",
    이름: context.contactName || "",
    이메일: context.contactEmail || "",

    // 리드 관리
    리드소스: context.leadSource || "",
    리드상태: context.leadStatus || "",
    리드점수: context.leadScore || "",
  };

  // 영문 변수 치환 (대소문자 구분 없음)
  for (const [key, value] of Object.entries(englishMap)) {
    const regex = new RegExp(`{{${key}}}`, "gi");
    result = result.replace(regex, value);
  }

  // 한글 변수 치환 (대소문자 구분)
  for (const [key, value] of Object.entries(koreanMap)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    result = result.replace(regex, value);
  }

  return result;
}
