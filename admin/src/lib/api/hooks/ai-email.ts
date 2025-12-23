import { useMutation } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import {
  aiEmailApi,
  type GenerateEmailDraftRequest,
  type GenerateFollowupRequest,
  type GenerateSummaryRequest,
  type GenerateTemplateRequest,
} from "../services/ai-email"

/**
 * Hook for generating AI email reply draft
 */
export function useGenerateEmailDraft() {
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (data: GenerateEmailDraftRequest) => aiEmailApi.generateDraft(data),
    onSuccess: () => {
      toast.success(t("settings.emailDraftTest.success.draft"))
    },
    onError: (error: Error) => {
      toast.error(error.message || t("settings.emailDraftTest.error.draft"))
    },
  })
}

/**
 * Hook for generating AI email template
 */
export function useGenerateTemplate() {
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (data: GenerateTemplateRequest) => aiEmailApi.generateTemplate(data),
    onSuccess: () => {
      toast.success(t("settings.emailDraftTest.success.template"))
    },
    onError: (error: Error) => {
      toast.error(error.message || t("settings.emailDraftTest.error.template"))
    },
  })
}

/**
 * Hook for generating AI follow-up suggestion
 */
export function useGenerateFollowup() {
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (data: GenerateFollowupRequest) => aiEmailApi.generateFollowup(data),
    onSuccess: () => {
      toast.success(t("settings.emailDraftTest.success.followup"))
    },
    onError: (error: Error) => {
      toast.error(error.message || t("settings.emailDraftTest.error.followup"))
    },
  })
}

/**
 * Hook for generating AI conversation summary
 */
export function useGenerateSummary() {
  const { t } = useTranslation()
  return useMutation({
    mutationFn: (data: GenerateSummaryRequest) => aiEmailApi.generateSummary(data),
    onSuccess: () => {
      toast.success(t("settings.emailDraftTest.success.summary"))
    },
    onError: (error: Error) => {
      toast.error(error.message || t("settings.emailDraftTest.error.summary"))
    },
  })
}
