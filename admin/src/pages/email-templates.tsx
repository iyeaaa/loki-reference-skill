import { Copy, Edit2, Eye, Gift, Heart, ShoppingBag, Sparkles, Star, Trash2 } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function EmailTemplatesPage() {
  const [filterCategory, setFilterCategory] = useState("all")

  const templates = [
    {
      id: 1,
      name: "신규 고객 환영",
      category: "welcome",
      subject: "{{name}}님, 뷰티플 월드에 오신 것을 환영합니다! 🌸",
      type: "시퀀스",
      usageCount: 234,
      lastModified: "2024-09-28",
      status: "active",
      icon: Sparkles,
      performance: { openRate: 68, clickRate: 32 },
    },
    {
      id: 2,
      name: "VIP 스킨케어 추천",
      category: "product",
      subject: "{{name}}님을 위한 맞춤형 스킨케어 추천 ✨",
      type: "단독",
      usageCount: 89,
      lastModified: "2024-09-27",
      status: "active",
      icon: Star,
      performance: { openRate: 72, clickRate: 38 },
    },
    {
      id: 3,
      name: "장바구니 이탈 리마인더",
      category: "cart",
      subject: "잊으신 제품이 있으신가요? 10% 할인 쿠폰 증정 🛍️",
      type: "시퀀스",
      usageCount: 156,
      lastModified: "2024-09-26",
      status: "active",
      icon: ShoppingBag,
      performance: { openRate: 45, clickRate: 28 },
    },
    {
      id: 4,
      name: "생일 축하 쿠폰",
      category: "special",
      subject: "🎂 {{name}}님, 생일 축하드려요! 특별한 선물을 준비했어요",
      type: "자동",
      usageCount: 45,
      lastModified: "2024-09-25",
      status: "active",
      icon: Gift,
      performance: { openRate: 85, clickRate: 62 },
    },
    {
      id: 5,
      name: "구매 감사 메시지",
      category: "transaction",
      subject: "구매해 주셔서 감사합니다 💖 리뷰 작성시 5,000원 적립",
      type: "자동",
      usageCount: 523,
      lastModified: "2024-09-24",
      status: "active",
      icon: Heart,
      performance: { openRate: 58, clickRate: 23 },
    },
    {
      id: 6,
      name: "시즌 세일 안내",
      category: "promotion",
      subject: "🌟 봄맞이 최대 50% 세일! 단 3일간",
      type: "단독",
      usageCount: 0,
      lastModified: "2024-09-29",
      status: "draft",
      icon: Sparkles,
      performance: { openRate: 0, clickRate: 0 },
    },
  ]

  const getCategoryBadge = (category: string) => {
    const categoryMap: { [key: string]: string } = {
      welcome: "환영",
      product: "제품추천",
      cart: "장바구니",
      special: "특별이벤트",
      transaction: "거래",
      promotion: "프로모션",
    }
    const label = categoryMap[category] || category
    return <Badge variant="outline">{label}</Badge>
  }

  const getTypeBadge = (type: string) => {
    const variant = type === "시퀀스" ? "default" : type === "자동" ? "secondary" : "outline"
    return <Badge variant={variant}>{type}</Badge>
  }

  return (
    <div className="p-6">
      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">전체 템플릿</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">활성 템플릿</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.filter((t) => t.status === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">총 발송 횟수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {templates.reduce((sum, t) => sum + t.usageCount, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">평균 오픈율</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(
                templates
                  .filter((t) => t.performance.openRate > 0)
                  .reduce((sum, t) => sum + t.performance.openRate, 0) /
                  templates.filter((t) => t.performance.openRate > 0).length
              )}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 mb-4">
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="카테고리 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 카테고리</SelectItem>
            <SelectItem value="welcome">환영</SelectItem>
            <SelectItem value="product">제품추천</SelectItem>
            <SelectItem value="cart">장바구니</SelectItem>
            <SelectItem value="special">특별이벤트</SelectItem>
            <SelectItem value="transaction">거래</SelectItem>
            <SelectItem value="promotion">프로모션</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>템플릿 목록</CardTitle>
          <CardDescription>이메일 템플릿 관리 및 성과 추적</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>템플릿명</TableHead>
                <TableHead>제목</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>사용 횟수</TableHead>
                <TableHead>성과</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>수정일</TableHead>
                <TableHead>액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates
                .filter((t) => filterCategory === "all" || t.category === filterCategory)
                .map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <span className="font-medium">{template.name}</span>
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">{template.subject}</TableCell>
                    <TableCell>{getCategoryBadge(template.category)}</TableCell>
                    <TableCell>{getTypeBadge(template.type)}</TableCell>
                    <TableCell>
                      <span className="font-medium">{template.usageCount.toLocaleString()}회</span>
                    </TableCell>
                    <TableCell>
                      {template.performance.openRate > 0 ? (
                        <div className="text-xs space-y-0.5">
                          <div>오픈: {template.performance.openRate}%</div>
                          <div>클릭: {template.performance.clickRate}%</div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.status === "draft" ? "secondary" : "default"}>
                        {template.status === "active" ? "활성" : "초안"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {template.lastModified}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
