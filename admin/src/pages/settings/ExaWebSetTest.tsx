import { ExternalLink, FileText, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// 샘플 데이터 타입
interface WebSetData {
  id: string
  website_url: string
  business_type: string | null
  company_name: string | null
  final_url: string | null
  http_status: number | null
  found_company_name: string | null
  name_url_match: boolean | null
  is_business_type_matched: boolean | null
  description: string | null
  address: string | null
  country: string | null
  city: string | null
  state: string | null
  founded_year: string | null
  phone_number: string | null
  email: string | null
  facebook_url: string | null
  instagram_url: string | null
  twitter_url: string | null
  linkedin_url: string | null
  employee_count: string | null
  products: string | null
  business_sectors: string | null
  product_categories: string | null
  industry_types: string | null
  crawl_time_seconds: number | null
  gpt_time_seconds: number | null
  collected_at: string | null
  error_message: string | null
}

// 샘플 데이터
const SAMPLE_DATA: WebSetData[] = [
  {
    id: "1",
    website_url: "https://example.com",
    business_type: "Technology",
    company_name: "Example Inc.",
    final_url: "https://example.com",
    http_status: 200,
    found_company_name: "Example Inc.",
    name_url_match: true,
    is_business_type_matched: true,
    description: "A leading technology company",
    address: "123 Main St, San Francisco",
    country: "USA",
    city: "San Francisco",
    state: "CA",
    founded_year: "2015",
    phone_number: "+1-555-0100",
    email: "contact@example.com",
    facebook_url: "https://facebook.com/example",
    instagram_url: "https://instagram.com/example",
    twitter_url: "https://twitter.com/example",
    linkedin_url: "https://linkedin.com/company/example",
    employee_count: "50-100",
    products: "Software, SaaS",
    business_sectors: "Technology, Software",
    product_categories: "Enterprise Software",
    industry_types: "SaaS, B2B",
    crawl_time_seconds: 2.5,
    gpt_time_seconds: 1.8,
    collected_at: "2024-01-15 14:30:00",
    error_message: null,
  },
  {
    id: "2",
    website_url: "https://test.com",
    business_type: "E-commerce",
    company_name: "Test Store",
    final_url: "https://test.com",
    http_status: 200,
    found_company_name: "Test Store",
    name_url_match: true,
    is_business_type_matched: true,
    description: "Online retail platform",
    address: "456 Commerce Ave, New York",
    country: "USA",
    city: "New York",
    state: "NY",
    founded_year: "2018",
    phone_number: "+1-555-0200",
    email: "info@test.com",
    facebook_url: "https://facebook.com/teststore",
    instagram_url: "https://instagram.com/teststore",
    twitter_url: null,
    linkedin_url: "https://linkedin.com/company/teststore",
    employee_count: "10-50",
    products: "Electronics, Fashion",
    business_sectors: "Retail, E-commerce",
    product_categories: "Consumer Goods",
    industry_types: "B2C, E-commerce",
    crawl_time_seconds: 3.2,
    gpt_time_seconds: 2.1,
    collected_at: "2024-01-15 15:45:00",
    error_message: null,
  },
  {
    id: "3",
    website_url: "https://demo.com",
    business_type: null,
    company_name: null,
    final_url: null,
    http_status: 404,
    found_company_name: null,
    name_url_match: null,
    is_business_type_matched: null,
    description: null,
    address: null,
    country: null,
    city: null,
    state: null,
    founded_year: null,
    phone_number: null,
    email: null,
    facebook_url: null,
    instagram_url: null,
    twitter_url: null,
    linkedin_url: null,
    employee_count: null,
    products: null,
    business_sectors: null,
    product_categories: null,
    industry_types: null,
    crawl_time_seconds: 1.2,
    gpt_time_seconds: null,
    collected_at: "2024-01-15 16:20:00",
    error_message: "404 Not Found",
  },
  {
    id: "4",
    website_url: "https://sample.com",
    business_type: "Consulting",
    company_name: "Sample Consulting",
    final_url: "https://sample.com",
    http_status: 200,
    found_company_name: "Sample Consulting Group",
    name_url_match: false,
    is_business_type_matched: true,
    description: "Professional consulting services",
    address: "789 Business Blvd, Boston",
    country: "USA",
    city: "Boston",
    state: "MA",
    founded_year: "2010",
    phone_number: "+1-555-0300",
    email: "contact@sample.com",
    facebook_url: null,
    instagram_url: null,
    twitter_url: "https://twitter.com/sampleconsult",
    linkedin_url: "https://linkedin.com/company/sample-consulting",
    employee_count: "100-500",
    products: "Consulting Services",
    business_sectors: "Professional Services",
    product_categories: "Business Consulting",
    industry_types: "B2B, Consulting",
    crawl_time_seconds: 2.8,
    gpt_time_seconds: 2.3,
    collected_at: "2024-01-15 17:10:00",
    error_message: null,
  },
]

export function ExaWebSetTest() {
  const [data, setData] = useState<WebSetData[]>(SAMPLE_DATA)

  // localStorage에서 데이터 로드
  useEffect(() => {
    const loadDataFromStorage = () => {
      try {
        const storedData = localStorage.getItem("exaWebSetTestData")
        if (storedData) {
          const parsedData = JSON.parse(storedData) as unknown[]
          const convertedData: WebSetData[] = parsedData.map((item: unknown, index: number) => {
            const row = item as Record<string, unknown>
            return {
              id: String(index + 1),
              website_url: String(row.website_url || ""),
              business_type: null,
              company_name: null,
              final_url: row.final_url ? String(row.final_url) : null,
              http_status: row.http_status ? Number(row.http_status) : null,
              found_company_name: row.found_company_name ? String(row.found_company_name) : null,
              name_url_match: null,
              is_business_type_matched: null,
              description: row.description ? String(row.description) : null,
              address: row.address ? String(row.address) : null,
              country: row.country ? String(row.country) : null,
              city: row.city ? String(row.city) : null,
              state: row.state ? String(row.state) : null,
              founded_year: row.founded_year ? String(row.founded_year) : null,
              phone_number: row.phone_number ? String(row.phone_number) : null,
              email: row.email ? String(row.email) : null,
              facebook_url: row.facebook_url ? String(row.facebook_url) : null,
              instagram_url: row.instagram_url ? String(row.instagram_url) : null,
              twitter_url: row.twitter_url ? String(row.twitter_url) : null,
              linkedin_url: row.linkedin_url ? String(row.linkedin_url) : null,
              employee_count: row.employee_count ? String(row.employee_count) : null,
              products: row.products ? String(row.products) : null,
              business_sectors: row.business_sectors ? String(row.business_sectors) : null,
              product_categories: row.product_categories ? String(row.product_categories) : null,
              industry_types: row.industry_types ? String(row.industry_types) : null,
              crawl_time_seconds: row.crawl_time_seconds ? Number(row.crawl_time_seconds) : null,
              gpt_time_seconds: row.gpt_time_seconds ? Number(row.gpt_time_seconds) : null,
              collected_at: row.collected_at ? String(row.collected_at) : null,
              error_message: row.error_message ? String(row.error_message) : null,
            }
          })
          if (convertedData.length > 0) {
            setData(convertedData)
          }
        }
      } catch (error) {
        console.error("Failed to load data from storage:", error)
      }
    }

    // 초기 로드
    loadDataFromStorage()

    // storage 이벤트 리스너 (다른 탭/페이지에서 업데이트 시)
    const handleStorageChange = () => {
      loadDataFromStorage()
    }

    // 같은 페이지에서의 업데이트도 감지하기 위해 커스텀 이벤트 리스너 추가
    const handleCustomStorage = () => {
      loadDataFromStorage()
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("exaWebSetDataUpdated", handleCustomStorage)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("exaWebSetDataUpdated", handleCustomStorage)
    }
  }, [])

  // HTTP 상태 배지
  const getHttpStatusBadge = (status: number | null) => {
    if (!status) return <span className="text-xs text-muted-foreground">-</span>

    const styles = {
      success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    }

    const style = status >= 200 && status < 300 ? styles.success : styles.error

    return <span className={`text-xs px-2 py-1 rounded-full ${style}`}>{status}</span>
  }

  // 삭제 핸들러
  const handleDelete = (id: string) => {
    if (confirm("이 항목을 삭제하시겠습니까?")) {
      setData(data.filter((item) => item.id !== id))
    }
  }

  return (
    <div className="p-2">
      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="font-medium text-lg">데이터가 없습니다</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px] border-r p-1 sticky left-0 bg-background z-10">
                      Website URL
                    </TableHead>
                    <TableHead className="min-w-[200px] border-r p-1">Final URL</TableHead>
                    <TableHead className="min-w-[100px] border-r p-1">HTTP Status</TableHead>
                    <TableHead className="min-w-[150px] border-r p-1">Found Company</TableHead>
                    <TableHead className="min-w-[250px] border-r p-1">Description</TableHead>
                    <TableHead className="min-w-[200px] border-r p-1">Address</TableHead>
                    <TableHead className="min-w-[100px] border-r p-1">Country</TableHead>
                    <TableHead className="min-w-[120px] border-r p-1">City</TableHead>
                    <TableHead className="min-w-[80px] border-r p-1">State</TableHead>
                    <TableHead className="min-w-[100px] border-r p-1">Founded</TableHead>
                    <TableHead className="min-w-[130px] border-r p-1">Phone</TableHead>
                    <TableHead className="min-w-[180px] border-r p-1">Email</TableHead>
                    <TableHead className="min-w-[150px] border-r p-1">Facebook</TableHead>
                    <TableHead className="min-w-[150px] border-r p-1">Instagram</TableHead>
                    <TableHead className="min-w-[150px] border-r p-1">Twitter</TableHead>
                    <TableHead className="min-w-[150px] border-r p-1">LinkedIn</TableHead>
                    <TableHead className="min-w-[100px] border-r p-1">Employees</TableHead>
                    <TableHead className="min-w-[200px] border-r p-1">Products</TableHead>
                    <TableHead className="min-w-[180px] border-r p-1">Sectors</TableHead>
                    <TableHead className="min-w-[180px] border-r p-1">Categories</TableHead>
                    <TableHead className="min-w-[150px] border-r p-1">Industries</TableHead>
                    <TableHead className="min-w-[100px] border-r p-1">Crawl Time</TableHead>
                    <TableHead className="min-w-[100px] border-r p-1">GPT Time</TableHead>
                    <TableHead className="min-w-[150px] border-r p-1">Collected At</TableHead>
                    <TableHead className="min-w-[200px] border-r p-1">Error</TableHead>
                    <TableHead className="w-[80px] sticky right-0 bg-background z-10 text-right p-1">
                      작업
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="border-r p-1 sticky left-0 bg-background z-10">
                        <a
                          href={item.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <span className="truncate max-w-[180px]">{item.website_url}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                      </TableCell>
                      <TableCell className="border-r p-1">
                        {item.final_url ? (
                          <a
                            href={item.final_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate block max-w-[180px]"
                          >
                            {item.final_url}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="border-r p-1">
                        {getHttpStatusBadge(item.http_status)}
                      </TableCell>
                      <TableCell className="border-r p-1">
                        {item.found_company_name || "-"}
                      </TableCell>
                      <TableCell className="border-r p-1">
                        <div className="max-w-[230px] truncate" title={item.description || ""}>
                          {item.description || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="border-r p-1">{item.address || "-"}</TableCell>
                      <TableCell className="border-r p-1">{item.country || "-"}</TableCell>
                      <TableCell className="border-r p-1">{item.city || "-"}</TableCell>
                      <TableCell className="border-r p-1">{item.state || "-"}</TableCell>
                      <TableCell className="border-r p-1">{item.founded_year || "-"}</TableCell>
                      <TableCell className="border-r p-1">{item.phone_number || "-"}</TableCell>
                      <TableCell className="border-r p-1">
                        {item.email ? (
                          <a href={`mailto:${item.email}`} className="text-primary hover:underline">
                            {item.email}
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="border-r p-1">
                        {item.facebook_url ? (
                          <a
                            href={item.facebook_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <span className="truncate max-w-[120px]">Link</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="border-r p-1">
                        {item.instagram_url ? (
                          <a
                            href={item.instagram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <span className="truncate max-w-[120px]">Link</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="border-r p-1">
                        {item.twitter_url ? (
                          <a
                            href={item.twitter_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <span className="truncate max-w-[120px]">Link</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="border-r p-1">
                        {item.linkedin_url ? (
                          <a
                            href={item.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <span className="truncate max-w-[120px]">Link</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          </a>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="border-r p-1">{item.employee_count || "-"}</TableCell>
                      <TableCell className="border-r p-1">
                        <div className="max-w-[180px] truncate" title={item.products || ""}>
                          {item.products || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="border-r p-1">
                        <div className="max-w-[160px] truncate" title={item.business_sectors || ""}>
                          {item.business_sectors || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="border-r p-1">
                        <div
                          className="max-w-[160px] truncate"
                          title={item.product_categories || ""}
                        >
                          {item.product_categories || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="border-r p-1">
                        <div className="max-w-[130px] truncate" title={item.industry_types || ""}>
                          {item.industry_types || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="border-r p-1 text-right">
                        {item.crawl_time_seconds ? `${item.crawl_time_seconds}s` : "-"}
                      </TableCell>
                      <TableCell className="border-r p-1 text-right">
                        {item.gpt_time_seconds ? `${item.gpt_time_seconds}s` : "-"}
                      </TableCell>
                      <TableCell className="border-r p-1 text-muted-foreground">
                        {item.collected_at || "-"}
                      </TableCell>
                      <TableCell className="border-r p-1">
                        {item.error_message ? (
                          <span className="text-red-600 text-xs">{item.error_message}</span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right sticky right-0 bg-background z-10 p-1">
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default ExaWebSetTest
