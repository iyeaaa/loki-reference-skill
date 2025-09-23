'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Activity, 
  AlertCircle, 
  Brain, 
  Database, 
  MessageSquare, 
  TrendingUp,
  Users,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  Search,
  FileText,
  GitBranch,
  Cpu
} from 'lucide-react'

export default function DashboardPage() {
  return (
    <div className="space-y-6 h-full overflow-y-auto">
     

      {/* 2. AI R&D 추천 서비스 인사이트 */}
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          {/* 추천 품질 및 성과 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">추천 클릭률 (CTR)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-center py-2">
                <div className="text-3xl font-bold text-primary">34.2%</div>
                <div className="text-xs text-muted-foreground">전체 평균 CTR</div>
              </div>
              <div className="space-y-2 pt-2 border-t">
                {[
                  { type: '과제 추천', ctr: 42.3, trend: 'up' },
                  { type: '연구자 추천', ctr: 38.7, trend: 'up' },
                  { type: '논문 추천', ctr: 31.2, trend: 'down' },
                  { type: '기관 추천', ctr: 28.9, trend: 'stable' },
                  { type: '특허 추천', ctr: 26.4, trend: 'up' }
                ].map((item) => (
                  <div key={item.type} className="flex items-center justify-between">
                    <span className="text-xs">{item.type}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold">{item.ctr}%</span>
                      {item.trend === 'up' && <TrendingUp className="h-3 w-3 text-green-600" />}
                      {item.trend === 'down' && <TrendingUp className="h-3 w-3 text-red-600 rotate-180" />}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top 5 추천 콘텐츠 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Top 5 추천 콘텐츠</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Tabs defaultValue="projects" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-8">
                  <TabsTrigger value="projects" className="text-xs">과제</TabsTrigger>
                  <TabsTrigger value="researchers" className="text-xs">연구자</TabsTrigger>
                  <TabsTrigger value="papers" className="text-xs">논문</TabsTrigger>
                </TabsList>
                <TabsContent value="projects" className="space-y-2 mt-2">
                  {[
                    'AI 기반 신약개발 플랫폼',
                    '차세대 배터리 소재 연구',
                    '양자컴퓨팅 알고리즘 개발',
                    '탄소중립 에너지 시스템',
                    '바이오 헬스케어 빅데이터'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="truncate flex-1">{idx + 1}. {item}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {1234 - idx * 123}
                      </Badge>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="researchers" className="space-y-2 mt-2">
                  {[
                    '김철수 (KAIST)',
                    '이영희 (서울대)',
                    '박민수 (POSTECH)',
                    '정하나 (연세대)',
                    '최동욱 (GIST)'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="truncate flex-1">{idx + 1}. {item}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {987 - idx * 98}
                      </Badge>
                    </div>
                  ))}
                </TabsContent>
                <TabsContent value="papers" className="space-y-2 mt-2">
                  {[
                    'Transformer 기반 추천시스템',
                    'GNN을 활용한 신소재 예측',
                    '연합학습 프레임워크 연구',
                    '자율주행 인지 알고리즘',
                    '양자 머신러닝 최적화'
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="truncate flex-1">{idx + 1}. {item}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {765 - idx * 76}
                      </Badge>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* 신규 추천 기능 분석 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">신규 추천 기능</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">협업연구자 추천</span>
                  <Badge className="text-[10px]">Beta</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">사용횟수</span>
                    <div className="font-semibold">3,847</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CTR</span>
                    <div className="font-semibold text-green-600">41.2%</div>
                  </div>
                </div>
              </div>
              
              <div className="p-3 bg-purple-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">평가위원 추천</span>
                  <Badge className="text-[10px]">Beta</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">사용횟수</span>
                    <div className="font-semibold">1,234</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CTR</span>
                    <div className="font-semibold text-green-600">38.9%</div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-orange-50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">기술이전 매칭</span>
                  <Badge variant="secondary" className="text-[10px]">Pilot</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">매칭시도</span>
                    <div className="font-semibold">892</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">성공률</span>
                    <div className="font-semibold text-amber-600">24.3%</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. LLM 질의응답 서비스 인사이트 */}
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* 질의응답 사용 통계 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">질의응답 통계</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">총 질의</div>
                  <div className="text-lg font-semibold">128,492</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">평균/세션</div>
                  <div className="text-lg font-semibold">4.8</div>
                </div>
              </div>
              <div className="pt-2 border-t space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">단순 질문</span>
                  <span>45%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">복합 질문</span>
                  <span>38%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">추천 질문</span>
                  <span>17%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 주요 질문 키워드 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">인기 키워드</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { word: 'AI', size: 'lg' },
                  { word: '신소재', size: 'md' },
                  { word: '바이오', size: 'lg' },
                  { word: '에너지', size: 'md' },
                  { word: '반도체', size: 'lg' },
                  { word: '양자', size: 'sm' },
                  { word: '탄소중립', size: 'md' },
                  { word: '빅데이터', size: 'sm' },
                  { word: '로봇', size: 'sm' },
                  { word: '헬스케어', size: 'md' }
                ].map((item) => (
                  <Badge 
                    key={item.word} 
                    variant="secondary"
                    className={`
                      ${item.size === 'lg' ? 'text-sm px-2.5 py-1' : ''}
                      ${item.size === 'md' ? 'text-xs px-2 py-0.5' : ''}
                      ${item.size === 'sm' ? 'text-[10px] px-1.5 py-0' : ''}
                    `}
                  >
                    {item.word}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 답변 품질 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">답변 만족도</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-center items-center py-2">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">97%</div>
                  <div className="text-xs text-muted-foreground">긍정 평가</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-600" />
                  <span>좋아요: 124K</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-600" />
                  <span>싫어요: 4K</span>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* 4. 데이터 및 AI 모델 관리 */}
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* 데이터 파이프라인 현황 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                데이터 파이프라인
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {[
                  { source: '과제 데이터', lastSync: '10분 전', status: 'success', count: '892K' },
                  { source: '성과 데이터', lastSync: '25분 전', status: 'success', count: '1.2M' },
                  { source: '연구자 정보', lastSync: '1시간 전', status: 'success', count: '234K' },
                  { source: '논문 메타데이터', lastSync: '2시간 전', status: 'success', count: '3.4M' },
                  { source: '특허 정보', lastSync: '3시간 전', status: 'success', count: '567K' }
                ].map((item) => (
                  <div key={item.source} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs font-medium">{item.source}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{item.count}</Badge>
                      <span className="text-xs text-muted-foreground">{item.lastSync}</span>
                      {item.status === 'success' && <CheckCircle className="h-3 w-3 text-green-600" />}
                      {item.status === 'warning' && <AlertCircle className="h-3 w-3 text-yellow-600" />}
                    </div>
                  </div>
                ))}
              </div>
              
              <Alert className="py-2">
                <AlertDescription className="text-xs">
                  벡터 DB: 5.6M 문서 | 최종 업데이트: 2024-01-11 14:30
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* AI 모델 운영 현황 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Cpu className="h-4 w-4" />
                AI 모델 운영
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3">
                <div className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">주 LLM 모델</span>
                    <Badge>Active</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">모델명</span>
                      <div className="font-mono">Qwen3-30B-A3B</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">버전</span>
                      <div className="font-mono">v2.4.0</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">GPU:</span>
                      <span>68%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Mem:</span>
                      <span>48GB/64GB</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">보조 모델 풀</span>
                    <Badge variant="secondary">5 Active</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-2 w-2 text-green-600" />
                      <span className="font-mono">Kisti 고니</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-2 w-2 text-green-600" />
                      <span className="font-mono">DeepSeek R1</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-2 w-2 text-green-600" />
                      <span className="font-mono">Llama 4 34B</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-2 w-2 text-green-600" />
                      <span className="font-mono">Mixtral 8x22b</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-2 w-2 text-green-600" />
                      <span className="font-mono">gpt-oss-20b</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-2 w-2" />
                      <span>Load Balanced</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t">
                <div className="text-xs font-medium mb-2">모델 성능 추이</div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">CTR (7일)</span>
                    <div className="flex items-center gap-1">
                      <span>34.2%</span>
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">답변 만족도 (7일)</span>
                    <div className="flex items-center gap-1">
                      <span>97%</span>
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Drift Score</span>
                    <div className="flex items-center gap-1">
                      <span>0.03</span>
                      <Badge variant="outline" className="text-[10px] ml-1">정상</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 시스템 알림 */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <span className="font-medium">시스템 공지:</span> 다음 주 화요일(1/16) 02:00-04:00 정기 점검이 예정되어 있습니다. LLM 모델 업그레이드 및 벡터 DB 인덱스 재구성 작업이 진행됩니다.
        </AlertDescription>
      </Alert>
    </div>
  )
}