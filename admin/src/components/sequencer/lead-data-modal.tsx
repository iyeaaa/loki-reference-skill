"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import type { Lead } from "../../lib/atoms"
import { LeadDataDisplay } from "./lead-data-display"

interface LeadDataModalProps {
  open: boolean
  onClose: () => void
  leads: Lead[]
}

export function LeadDataModal({ open, onClose, leads }: LeadDataModalProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterBy, setFilterBy] = useState<"all" | "company" | "email">("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  // 검색어나 필터 변경 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1)
  }, [])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="리드 데이터 관리"
      className="w-fit absolute"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <div className="py-2">
        <LeadDataDisplay
          leads={leads}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterBy={filterBy}
          onFilterChange={setFilterBy}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      </div>
    </Modal>
  )
}
