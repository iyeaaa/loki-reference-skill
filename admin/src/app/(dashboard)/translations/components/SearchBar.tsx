'use client'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  placeholder?: string
}

export function SearchBar({ 
  value, 
  onChange, 
  onSearch, 
  placeholder = "원문 또는 번역 검색..." 
}: SearchBarProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  return (
    <div className="flex gap-2">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={handleKeyPress}
        className="max-w-sm"
      />
      <Button onClick={onSearch} size="icon" variant="outline">
        <Search className="h-4 w-4" />
      </Button>
    </div>
  )
}