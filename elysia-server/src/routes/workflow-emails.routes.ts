import { Elysia, t } from "elysia"
import { getAIWorkflowEmailService } from "../services/ai-workflow-email.service"
import * as progressService from "../services/generation-progress.service"
import * as workflowEmailService from "../services/workflow-email.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import logger from "../utils/logger"

// Schema for creating generated email (reserved for future use)
// const generatedEmailSchema = t.Object({
//   leadId: t.String({ format: 'uuid' }),
//   subject: t.String({ minLength: 1 }),
//   bodyText: t.Optional(t.String()),
//   bodyHtml: t.Optional(t.String()),
//   status: t.Optional(
//     t.Union([
//       t.Literal('pending'),
//       t.Literal('generating'),
//       t.Literal('generated'),
//       t.Literal('edited'),
//       t.Literal('failed'),
//     ]),
//   ),
//   generationMode: t.Optional(t.Union([t.Literal('ai'), t.Literal('manual'), t.Literal('template')])),
//   aiPrompt: t.Optional(t.String()),
//   aiModel: t.Optional(t.String()),
// })

const updateEmailSchema = t.Object({
  subject: t.Optional(t.String({ minLength: 1 })),
  bodyText: t.Optional(t.String()),
  bodyHtml: t.Optional(t.String()),
})

const generateAllEmailsSchema = t.Object({
  mode: t.Union([t.Literal("ai"), t.Literal("manual")]),
  aiPrompt: t.Optional(t.String()),
  aiModel: t.Optional(t.String()),
  templateSubject: t.Optional(t.String()),
  templateBody: t.Optional(t.String()),
  templateBodyHtml: t.Optional(t.String()),
  incremental: t.Optional(t.Boolean()), // true면 이미 생성된 이메일은 스킵
})

export const workflowEmailRoutes = new Elysia({ prefix: "/api/v1/sequences" })
  // Get all generated emails for a node
  .get("/:id/nodes/:nodeId/generated-emails", async ({ params }) => {
    const { id: sequenceId, nodeId } = params

    const emails = await workflowEmailService.getGeneratedEmailsByNode(sequenceId, nodeId)
    return emails
  })

  // Generate emails for all leads (manual template or AI)
  .post(
    "/:id/nodes/:nodeId/generate-emails",
    async ({ params, body }) => {
      const { id: sequenceId, nodeId } = params

      logger.info(
        { body, mode: body.mode, aiPrompt: body.aiPrompt, incremental: body.incremental },
        "Generate emails request",
      )

      // Get all leads in sequence
      const allLeads = await workflowEmailService.getSequenceLeads(sequenceId)

      if (allLeads.length === 0) {
        return {
          message: "시퀀스에 등록된 연락처가 없습니다",
          generated: 0,
          total: 0,
        }
      }

      // incremental 모드인 경우 이미 생성된 이메일이 있는 리드는 제외
      let leads = allLeads
      let skipped = 0

      if (body.incremental) {
        const existingEmails = await workflowEmailService.getGeneratedEmailsByNode(
          sequenceId,
          nodeId,
        )
        const existingLeadIds = new Set(existingEmails.map((e) => e.leadId))

        leads = allLeads.filter((lead) => {
          if (existingLeadIds.has(lead.id)) {
            skipped++
            return false
          }
          return true
        })

        logger.info(
          {
            totalLeads: allLeads.length,
            existingEmails: existingEmails.length,
            leadsToGenerate: leads.length,
            skipped,
          },
          "Incremental mode: filtering leads",
        )
      }

      if (leads.length === 0) {
        return {
          message: "생성할 이메일이 없습니다 (모든 연락처에 대해 이미 생성됨)",
          generated: 0,
          total: allLeads.length,
          skipped,
        }
      }

      // 진행률 초기화
      progressService.initProgress(sequenceId, nodeId, leads.length)

      let generated = 0
      let _failed = 0
      const errors: Array<{ leadId: string; error: string }> = []

      for (const lead of leads) {
        try {
          let subject = ""
          let bodyText = ""
          let bodyHtml = ""
          let emailStatus: "pending" | "generating" | "generated" | "edited" | "failed" =
            "generated"
          let generationError: string | undefined

          if (body.mode === "manual") {
            // 템플릿 변수 치환 (모든 리드 필드 포함)
            const leadContext = {
              companyName: lead.companyName || "",
              contactName: lead.contactName || "",
              contactEmail: lead.contactEmail || "",
              industry: lead.industry || "",
              website: lead.website || "",
              description: lead.description || "",
              address: lead.address || "",
              country: lead.country || "",
              city: lead.city || "",
              state: lead.state || "",
              foundedYear: lead.foundedYear || "",
              employeeCount: lead.employeeCount || "",
              leadSource: lead.leadSource || "",
              leadStatus: lead.leadStatus || "",
              leadScore: lead.leadScore || "",
            }

            subject = workflowEmailService.replaceTemplateVariables(
              body.templateSubject || "",
              leadContext,
            )

            bodyText = workflowEmailService.replaceTemplateVariables(
              body.templateBody || "",
              leadContext,
            )

            bodyHtml = body.templateBodyHtml
              ? workflowEmailService.replaceTemplateVariables(body.templateBodyHtml, leadContext)
              : ""
          } else {
            // AI mode - 실제 AI 생성
            try {
              logger.info(
                {
                  companyName: lead.companyName,
                  prompt: body.aiPrompt || "(empty)",
                },
                "Starting AI generation",
              )

              const aiService = getAIWorkflowEmailService()
              const generatedEmail = await aiService.generateEmail({
                prompt:
                  body.aiPrompt || "위 고객 정보를 바탕으로 맞춤형 영업 이메일을 작성해주세요.",
                lead: {
                  companyName: lead.companyName || "",
                  contactName: lead.contactName,
                  contactEmail: lead.contactEmail || "",
                  industry: lead.industry,
                  website: lead.website,
                  size: lead.size,
                },
                model: body.aiModel,
              })

              logger.info(
                {
                  companyName: lead.companyName,
                  subject: generatedEmail.subject,
                },
                "AI generation successful",
              )

              subject = generatedEmail.subject
              bodyText = generatedEmail.bodyText
              bodyHtml = generatedEmail.bodyHtml || ""
            } catch (aiError) {
              // AI 생성 실패 시 템플릿 폴백
              logger.error(
                { err: aiError, companyName: lead.companyName },
                "AI generation failed, using fallback",
              )
              subject = `${lead.companyName}님께`
              bodyText = `안녕하세요,\n\n${lead.companyName} 담당자님께 연락드립니다.\n\n[AI 생성 실패 - 수동 편집 필요]`
              emailStatus = "failed"
              generationError = aiError instanceof Error ? aiError.message : "AI generation failed"
            }
          }

          await workflowEmailService.upsertGeneratedEmail({
            sequenceId,
            nodeId,
            leadId: lead.id,
            subject,
            bodyText,
            bodyHtml,
            status: emailStatus,
            generationMode: body.mode,
            aiPrompt: body.aiPrompt,
            aiModel: body.aiModel,
            generationError,
            contextSnapshot: {
              companyName: lead.companyName,
              contactName: lead.contactName,
              contactEmail: lead.contactEmail,
              industry: lead.industry,
            },
          })

          generated++
          progressService.updateProgress(sequenceId, nodeId, { generated: 1 })
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error"
          errors.push({
            leadId: lead.id,
            error: errorMsg,
          })
          _failed++
          progressService.updateProgress(sequenceId, nodeId, { failed: 1 })
          progressService.addError(sequenceId, nodeId, lead.id, errorMsg)
        }
      }

      // 진행률 완료 처리
      progressService.completeProgress(
        sequenceId,
        nodeId,
        errors.length > 0 ? "completed" : "completed",
      )

      return {
        message: "이메일 생성이 완료되었습니다",
        generated,
        total: allLeads.length,
        failed: errors.length,
        skipped: body.incremental ? skipped : undefined,
        errors: errors.length > 0 ? errors : undefined,
      }
    },
    {
      body: generateAllEmailsSchema,
    },
  )

  // Get single generated email
  .get("/:id/nodes/:nodeId/generated-emails/:emailId", async ({ params }) => {
    const { emailId } = params

    const email = await workflowEmailService.getGeneratedEmail(emailId)
    if (!email) {
      return errorResponse("이메일을 찾을 수 없습니다", ResponseCode.NOT_FOUND)
    }

    return email
  })

  // Update generated email
  .patch(
    "/:id/nodes/:nodeId/generated-emails/:emailId",
    async ({ params, body }) => {
      const { emailId } = params

      const updated = await workflowEmailService.updateGeneratedEmail(emailId, {
        ...body,
        status: "edited",
      })

      if (!updated) {
        return errorResponse("이메일 업데이트에 실패했습니다", ResponseCode.NOT_FOUND)
      }

      return updated
    },
    {
      body: updateEmailSchema,
    },
  )

  // Delete generated email
  .delete("/:id/nodes/:nodeId/generated-emails/:emailId", async ({ params }) => {
    const { emailId } = params

    await workflowEmailService.deleteGeneratedEmail(emailId)
    return { message: "이메일이 삭제되었습니다" }
  })

  // Regenerate single email (AI mode)
  .post("/:id/nodes/:nodeId/generated-emails/:emailId/regenerate", async ({ params }) => {
    const { emailId } = params

    const email = await workflowEmailService.getGeneratedEmail(emailId)
    if (!email) {
      return errorResponse("이메일을 찾을 수 없습니다", ResponseCode.NOT_FOUND)
    }

    // AI 재생성
    if (email.generationMode === "ai" && email.aiPrompt) {
      try {
        const aiService = getAIWorkflowEmailService()
        const regenerated = await aiService.generateEmail({
          prompt: email.aiPrompt,
          lead: {
            companyName: email.companyName || "",
            contactName: email.contactName,
            contactEmail: email.contactEmail || "",
            industry: email.industry,
          },
          model: email.aiModel || undefined,
        })

        const updated = await workflowEmailService.updateGeneratedEmail(emailId, {
          subject: regenerated.subject,
          bodyText: regenerated.bodyText,
          status: "generated",
        })

        return {
          message: "AI 재생성이 완료되었습니다",
          email: updated,
        }
      } catch (error) {
        return errorResponse(
          error instanceof Error ? error.message : "AI 재생성에 실패했습니다",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    }

    return errorResponse("AI 모드가 아니거나 프롬프트가 없습니다", ResponseCode.BAD_REQUEST)
  })

  // Delete all generated emails for a node
  .delete("/:id/nodes/:nodeId/generated-emails", async ({ params }) => {
    const { id: sequenceId, nodeId } = params

    await workflowEmailService.deleteGeneratedEmailsByNode(sequenceId, nodeId)
    return { message: "모든 이메일이 삭제되었습니다" }
  })

  // Get generation progress
  .get("/:id/nodes/:nodeId/generation-progress", async ({ params }) => {
    const { id: sequenceId, nodeId } = params

    const progress = progressService.getProgress(sequenceId, nodeId)

    if (!progress) {
      return {
        sequenceId,
        nodeId,
        total: 0,
        generated: 0,
        failed: 0,
        percentage: 0,
        status: "idle",
      }
    }

    return {
      ...progress,
      percentage: progressService.getProgressPercentage(progress),
    }
  })
