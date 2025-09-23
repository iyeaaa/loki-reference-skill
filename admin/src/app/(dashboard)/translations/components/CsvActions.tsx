'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Upload } from 'lucide-react'
import toast from 'react-hot-toast'

interface CsvActionsProps {
  onDownload: () => void
  onUpload: (file: File) => void
}

export function CsvActions({ onDownload, onUpload }: CsvActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        toast.error('CSV 파일만 업로드 가능합니다.')
        return
      }
      onUpload(file)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={onDownload}
      >
        <Download className="w-4 h-4 mr-2" />
        CSV 다운로드
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-4 h-4 mr-2" />
        CSV 업로드
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        className="hidden"
      />
    </>
  )
}