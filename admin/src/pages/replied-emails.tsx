import { Mail } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function RepliedEmailsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">답장 받은 이메일</h1>
          <p className="text-muted-foreground">첫 메일을 보내고 답장 받은 이메일 목록입니다.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            답장 이메일 목록
          </CardTitle>
          <CardDescription>고객으로부터 답장 받은 이메일을 확인하고 관리하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Mail className="h-12 w-12 mb-4 opacity-50" />
            <p>답장 받은 이메일이 없습니다.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
