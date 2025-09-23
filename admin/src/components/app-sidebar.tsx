'use client'

import {
  Archive,
  BarChart3,
  Brain,
  Cpu,
  Database,
  MessageSquare,
  Settings,
  TrendingUp,
  Users,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const menuItems = [
  {
    title: 'NTIS 인사이트',
    url: '/dashboard',
    icon: BarChart3,
  },
  {
    title: '유저 관리',
    url: '/users',
    icon: Users,
  },
  // 추천 기능 관리
  {
    title: '추천 모델 관리',
    url: '/recommendation/models',
    icon: Brain,
  },
  {
    title: '학습 데이터 관리',
    url: '/recommendation/data',
    icon: Database,
  },
  {
    title: '추천 분석',
    url: '/recommendation/analytics',
    icon: TrendingUp,
  },
  // RAG 기능 관리
  {
    title: 'LLM 모델 관리',
    url: '/rag/models',
    icon: Cpu,
  },
  {
    title: '벡터 DB 관리',
    url: '/rag/vectordb',
    icon: Archive,
  },
  {
    title: '질의응답 관리',
    url: '/rag/qa',
    icon: MessageSquare,
  },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="flex aspect-square size-10 items-center justify-center">
                  <Image
                    src="/images/ntis-logo.png"
                    alt="NTIS 로고"
                    width={40}
                    height={40}
                    className="size-10 object-contain rounded-xl"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">NTIS AI Insight</span>
                  <span className="truncate text-xs">AI 기반 데이터 분석 시스템</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive}
                      className={isActive ? 'bg-[#FF6B35]/10 border-r-2 border-[#FF6B35]' : ''}
                    >
                      <Link href={item.url || '#'}>
                        {item.icon && (
                          <item.icon 
                            className={isActive ? 'text-[#FF6B35]' : ''} 
                          />
                        )}
                        <span 
                          className={isActive ? 'text-[#FF6B35] font-medium' : ''}
                        >
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip="설정"
              isActive={pathname === '/settings'}
            >
              <Link href="/settings">
                <Settings />
                <span>설정</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
