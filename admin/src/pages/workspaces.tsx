import { Building2, Edit2, ExternalLink, Globe, Mail, Plus, Search } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Workspace {
  id: string
  companyName: string
  companyEmail: string
  companyDescription: string
  website: string
  targetCountries: string[]
  targetCompanies: string
  plan: "Free" | "Pro" | "Enterprise"
  status: "active" | "inactive"
  members: number
  createdAt: string
}

export default function WorkspacesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([])

  const toggleWorkspace = (id: string) => {
    setSelectedWorkspaces((prev) =>
      prev.includes(id) ? prev.filter((wId) => wId !== id) : [...prev, id]
    )
  }

  const toggleAll = () => {
    if (selectedWorkspaces.length === filteredWorkspaces.length) {
      setSelectedWorkspaces([])
    } else {
      setSelectedWorkspaces(filteredWorkspaces.map((w) => w.id))
    }
  }

  // 예시 워크스페이스 데이터 - 해외 진출을 원하는 뷰티 업체
  const workspaces: Workspace[] = [
    {
      id: "1",
      companyName: "루카스에듀테인먼트",
      companyEmail: "lukas@tam9.me",
      companyDescription: "K-뷰티 전문 화장품 제조 및 유통 기업",
      website: "https://lucasedu.com",
      targetCountries: ["미국", "일본", "중국"],
      targetCompanies: "백화점, 드럭스토어, 온라인 리테일러",
      plan: "Pro",
      status: "active",
      members: 5,
      createdAt: "2024-01-15",
    },
    {
      id: "2",
      companyName: "예지상사",
      companyEmail: "yamy0612@naver.com",
      companyDescription: "자연주의 스킨케어 브랜드",
      website: "https://yejisangsa.com",
      targetCountries: ["유럽", "호주"],
      targetCompanies: "오가닉 화장품 유통사, 백화점 바이어",
      plan: "Enterprise",
      status: "active",
      members: 8,
      createdAt: "2024-02-20",
    },
    {
      id: "3",
      companyName: "익투스",
      companyEmail: "ictuskorea@gmail.com",
      companyDescription: "메이크업 전문 브랜드",
      website: "https://ictus.co.kr",
      targetCountries: ["동남아", "중동"],
      targetCompanies: "화장품 유통사, 바이어",
      plan: "Pro",
      status: "active",
      members: 4,
      createdAt: "2024-03-10",
    },
    {
      id: "4",
      companyName: "리오닉스",
      companyEmail: "rionix@kakao.com",
      companyDescription: "헤어케어 전문 기업",
      website: "https://rionix.com",
      targetCountries: ["미국", "캐나다"],
      targetCompanies: "살롱, 뷰티 디스트리뷰터",
      plan: "Free",
      status: "active",
      members: 2,
      createdAt: "2024-04-05",
    },
    {
      id: "5",
      companyName: "브이시드니",
      companyEmail: "vmsydney@gmail.com",
      companyDescription: "프리미엄 향수 브랜드",
      website: "https://vsydney.com",
      targetCountries: ["호주", "뉴질랜드"],
      targetCompanies: "백화점, 면세점",
      plan: "Pro",
      status: "inactive",
      members: 3,
      createdAt: "2024-05-12",
    },
  ]

  const filteredWorkspaces = workspaces.filter(
    (workspace) =>
      workspace.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workspace.companyEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workspace.targetCountries.some((country) =>
        country.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      workspace.targetCompanies.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex-none">
        <div className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="회사명, 이메일, 진출 국가, 찾는 기업으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />새 워크스페이스
          </Button>
        </div>
      </div>

      <div className="flex-1 border rounded-lg overflow-hidden">
        <div className="h-full overflow-auto">
          <Table className="min-w-max">
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      selectedWorkspaces.length === filteredWorkspaces.length &&
                      filteredWorkspaces.length > 0
                    }
                    onCheckedChange={toggleAll}
                  />
                </TableHead>
                <TableHead className="min-w-[150px]">회사명</TableHead>
                <TableHead className="min-w-[200px]">회사 이메일</TableHead>
                <TableHead className="min-w-[250px]">회사 설명</TableHead>
                <TableHead className="min-w-[250px]">웹사이트</TableHead>
                <TableHead className="min-w-[200px]">진출 희망 국가</TableHead>
                <TableHead className="min-w-[200px]">찾는 기업</TableHead>
                <TableHead className="w-[100px]">플랜</TableHead>
                <TableHead className="w-[80px]">상태</TableHead>
                <TableHead className="w-[80px]">멤버</TableHead>
                <TableHead className="w-[100px]">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkspaces.map((workspace) => (
                <TableRow key={workspace.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedWorkspaces.includes(workspace.id)}
                      onCheckedChange={() => toggleWorkspace(workspace.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{workspace.companyName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">{workspace.companyEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {workspace.companyDescription}
                    </span>
                  </TableCell>
                  <TableCell>
                    <a
                      href={workspace.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <Globe className="h-3 w-3 shrink-0" />
                      <span className="truncate">{workspace.website}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {workspace.targetCountries.map((country) => (
                        <Badge key={country} variant="outline">
                          {country}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {workspace.targetCompanies}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={workspace.plan === "Enterprise" ? "default" : "secondary"}>
                      {workspace.plan}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={workspace.status === "active" ? "default" : "secondary"}>
                      {workspace.status === "active" ? "활성" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{workspace.members}명</span>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {filteredWorkspaces.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">검색 결과가 없습니다.</p>
          </div>
        </div>
      )}
    </div>
  )
}
