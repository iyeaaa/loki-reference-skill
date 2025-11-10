import { Download, FileSpreadsheet, Upload } from "lucide-react"
import { useCallback, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface LeadUploadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFileSelect: (file: File) => void
}

export function LeadUploadModal({ open, onOpenChange, onFileSelect }: LeadUploadModalProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        const fileName = file.name.toLowerCase()
        if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
          onFileSelect(file)
          onOpenChange(false)
        } else {
          alert("Only XLSX or XLS files are allowed.")
        }
      }
    },
    [onFileSelect, onOpenChange],
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const fileName = file.name.toLowerCase()
      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        onFileSelect(file)
        onOpenChange(false)
      } else {
        alert("Only XLSX or XLS files are allowed.")
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [onFileSelect, onOpenChange],
  )

  const handleDownloadTemplate = useCallback(() => {
    // Create a sample template with all required headers
    const headers = [
      "website_url",
      "business_type",
      "company_name",
      "final_url",
      "http_status",
      "found_company_name",
      "name_url_match",
      "is_business_type_matched",
      "description",
      "address",
      "country",
      "city",
      "state",
      "founded_year",
      "phone_number",
      "email",
      "facebook_url",
      "instagram_url",
      "twitter_url",
      "linkedin_url",
      "employee_count",
      "products",
      "business_sectors",
      "product_categories",
      "industry_types",
      "crawl_time_seconds",
      "gpt_time_seconds",
      "collected_at",
      "error_message",
    ]

    const sampleData = [
      [
        "https://acme.com",
        "Technology",
        "Acme Corp",
        "https://acme.com",
        "200",
        "Acme Corp",
        "true",
        "true",
        "Leading provider of enterprise software solutions",
        "123 Tech Street, San Francisco, CA 94105",
        "United States",
        "San Francisco",
        "California",
        "2015",
        "+1-555-0100",
        "contact@acme.com",
        "https://facebook.com/acmecorp",
        "https://instagram.com/acmecorp",
        "https://twitter.com/acmecorp",
        "https://linkedin.com/company/acmecorp",
        "150",
        "Enterprise Software, Cloud Solutions",
        "Technology, SaaS",
        "Software, Enterprise",
        "B2B SaaS, Enterprise Software",
        "2.5",
        "1.8",
        new Date().toISOString(),
        "",
      ],
      [
        "https://beta.com",
        "Finance",
        "Beta Inc",
        "https://beta.com",
        "200",
        "Beta Inc",
        "true",
        "true",
        "Innovative fintech solutions for modern businesses",
        "456 Finance Ave, New York, NY 10001",
        "United States",
        "New York",
        "New York",
        "2018",
        "+1-555-0101",
        "info@beta.com",
        "https://facebook.com/betainc",
        "https://instagram.com/betainc",
        "https://twitter.com/betainc",
        "https://linkedin.com/company/betainc",
        "85",
        "Payment Processing, Financial Analytics",
        "Finance, Fintech",
        "Financial Services, Payments",
        "Fintech, B2B Finance",
        "3.1",
        "2.2",
        new Date().toISOString(),
        "",
      ],
    ]

    // Escape CSV values properly
    const escapeCSV = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...sampleData.map((row) => row.map((cell) => escapeCSV(String(cell))).join(",")),
    ].join("\n")

    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "lead-import-template.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Import Your Lead List
          </DialogTitle>
          <DialogDescription>
            I'll research each prospect, write personalized sequences, and automate follow-ups for every lead in your file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Template Download Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Step 1: Get the Template (Optional)</h4>
            <p className="text-sm text-muted-foreground">
              Use this format so I can work with your data instantly.
            </p>
            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              className="w-full justify-start"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Step 2: Upload Your Leads</h4>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors
                ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"
                }
              `}
            >
              <Upload
                className={`h-10 w-10 mb-3 ${isDragging ? "text-primary" : "text-muted-foreground"}`}
              />
              <p className="text-sm font-medium mb-1">
                {isDragging ? "Drop your file here" : "Drop your file here or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">Accepts .xlsx or .xls files</p>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
