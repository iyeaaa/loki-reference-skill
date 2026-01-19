/**
 * Permission Constants
 *
 * 라우트별 권한 매핑 및 관련 상수
 * 백엔드와 동기화 필요: elysia-server/src/constants/iam-resources.ts
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                    권한 매핑 규칙                                        │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │                                                                         │
 * │  "public"     - 모든 로그인 사용자 접근 가능                            │
 * │  "admin-only" - 시스템 Admin만 접근 가능                                │
 * │  { resource, action } - 특정 권한 필요                                  │
 * │                                                                         │
 * │  ⚠️ 중요: 여기에 등록되지 않은 라우트는 "admin-only"로 처리됩니다.      │
 * │                                                                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

import { IAM_ACTIONS, IAM_RESOURCES } from "@/lib/constants/iam-resources"
import type { RoutePermission } from "./types"

/**
 * 라우트별 필요 권한 매핑
 */
export const ROUTE_PERMISSIONS: Record<string, RoutePermission> = {
  // ─────────────────────────────────────────────────────────────────────────
  // Dashboard & Analytics (메뉴: 홈, 분석)
  // ─────────────────────────────────────────────────────────────────────────
  "/dashboard": "public", // 홈은 모든 로그인 사용자
  "/analytics": { resource: IAM_RESOURCES.ANALYTICS, action: IAM_ACTIONS.READ },

  // ─────────────────────────────────────────────────────────────────────────
  // Leads & Customers (메뉴: 고객탐색, 고객관리)
  // ─────────────────────────────────────────────────────────────────────────
  "/leads": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.LIST },
  "/leads/:id": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.READ },
  "/lead-discovery": { resource: IAM_RESOURCES.LEADS_DISCOVERY, action: IAM_ACTIONS.READ },
  "/lead-import": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.IMPORT },
  "/customer-groups": { resource: IAM_RESOURCES.CUSTOMER_GROUPS, action: IAM_ACTIONS.LIST },

  // ─────────────────────────────────────────────────────────────────────────
  // Campaigns (메뉴: 캠페인)
  // ─────────────────────────────────────────────────────────────────────────
  "/sequences": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.LIST },
  "/sequences/create": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.CREATE },
  "/sequences/edit": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.UPDATE },
  "/sequences/:id": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.READ },
  "/sequences/:id/designer": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.UPDATE },

  // ─────────────────────────────────────────────────────────────────────────
  // Email (메뉴: 인박스)
  // ─────────────────────────────────────────────────────────────────────────
  "/replied-emails": { resource: IAM_RESOURCES.EMAILS, action: IAM_ACTIONS.LIST },
  "/replied-emails/:emailId": { resource: IAM_RESOURCES.EMAILS, action: IAM_ACTIONS.READ },
  "/email-templates": "public", // 이메일 템플릿은 모든 사용자
  "/bulk-email-csv": { resource: IAM_RESOURCES.BULK_EMAIL, action: IAM_ACTIONS.SEND },

  // ─────────────────────────────────────────────────────────────────────────
  // AI Features (메뉴: Rinda GPT)
  // ─────────────────────────────────────────────────────────────────────────
  "/chatbot": { resource: IAM_RESOURCES.AI_CHATBOT, action: IAM_ACTIONS.EXECUTE },

  // ─────────────────────────────────────────────────────────────────────────
  // Settings (메뉴: 설정)
  // ─────────────────────────────────────────────────────────────────────────
  "/settings": "public", // 기본 설정 페이지는 모든 사용자
  "/settings/profile": "public", // 프로필 설정은 모든 사용자
  "/settings/workspace": "public", // 워크스페이스 설정은 모든 사용자 (읽기만)
  "/settings/members": { resource: IAM_RESOURCES.WORKSPACES_MEMBERS, action: IAM_ACTIONS.LIST },

  // ─────────────────────────────────────────────────────────────────────────
  // Workspace Admin (Owner/Admin Only)
  // ─────────────────────────────────────────────────────────────────────────
  "/workspaces": "admin-only",
  "/users": "admin-only",
  "/activity-logs": "admin-only",

  // ─────────────────────────────────────────────────────────────────────────
  // IAM (Admin Only)
  // ─────────────────────────────────────────────────────────────────────────
  "/iam/policies": "admin-only",
  "/iam/roles": "admin-only",

  // ─────────────────────────────────────────────────────────────────────────
  // Billing (Admin Only)
  // ─────────────────────────────────────────────────────────────────────────
  "/billing/products": "admin-only",
  "/billing/plans": "admin-only",
  "/billing/subscriptions": "admin-only",

  // ─────────────────────────────────────────────────────────────────────────
  // Test & Dev Pages (Admin Only)
  // ─────────────────────────────────────────────────────────────────────────
  "/email-send-test": "admin-only",
  "/tailwind-test": "admin-only",
  "/test/filters": "admin-only",
  "/test/sse": "admin-only",
  "/settings/spinner-test": "admin-only",
  "/settings/web-extraction": "admin-only",
  "/websets": "admin-only",
  "/websets/criteria": "admin-only",
  "/websets/:id": "admin-only",
  "/gemini-search": "admin-only",
  "/bigquery-search": "admin-only",
}

/**
 * Admin 역할 목록
 */
export const ADMIN_ROLES = ["admin"] as const

/**
 * 사이드바 메뉴별 권한 매핑
 *
 * AppSidebar에서 사용하는 메뉴 권한 정의
 * - "public": 모든 로그인 사용자에게 표시
 * - { resource, action }: 해당 권한이 있는 사용자에게만 표시
 */
export const SIDEBAR_PERMISSIONS = {
  // 홈 - 모든 사용자
  home: "public" as const,

  // 분석 - analytics:read
  analytics: { resource: IAM_RESOURCES.ANALYTICS, action: IAM_ACTIONS.READ },

  // 고객 탐색 - leads:discovery:read
  leadDiscovery: { resource: IAM_RESOURCES.LEADS_DISCOVERY, action: IAM_ACTIONS.READ },

  // 고객 관리 - leads:list
  leads: { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.LIST },

  // 캠페인 - sequences:list
  sequences: { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.LIST },

  // 인박스 - emails:list
  emails: { resource: IAM_RESOURCES.EMAILS, action: IAM_ACTIONS.LIST },

  // Rinda GPT - ai:chatbot:execute
  chatbot: { resource: IAM_RESOURCES.AI_CHATBOT, action: IAM_ACTIONS.EXECUTE },

  // 설정 - 모든 사용자
  settings: "public" as const,
} as const
