"use client"

import { Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { type AddressBookGroup, addressBookApi } from "@/lib/api/services/address-book"

interface AddressBookModalProps {
  open: boolean
  onClose: () => void
  onSelectGroup: (groupId: string) => Promise<void>
}

export function AddressBookModal({ open, onClose, onSelectGroup }: AddressBookModalProps) {
  const [groups, setGroups] = useState<AddressBookGroup[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // 그룹 데이터 로드
  useEffect(() => {
    if (!open) return

    const fetchGroups = async () => {
      setLoading(true)
      try {
        const res = await addressBookApi.listGroups({ limit: 100 })
        setGroups(res.groups)
      } catch (error) {
        console.error("주소록 그룹 로드 오류:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchGroups()
  }, [open])

  // 검색 필터링된 그룹
  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups

    const term = searchTerm.toLowerCase()
    return groups.filter(
      (group) =>
        group.name.toLowerCase().includes(term) || group.description?.toLowerCase().includes(term)
    )
  }, [groups, searchTerm])

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / itemsPerPage))
  const paginatedGroups = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredGroups.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredGroups, currentPage])

  // 검색어 변경 시 첫 페이지로 이동
  useEffect(() => {
    setCurrentPage(1)
  }, [])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="주소록에서 그룹 선택"
      className="w-fit"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 w-[800px]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="그룹 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
            <p className="mt-2 text-sm text-muted-foreground">그룹 로딩 중...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            그룹이 없습니다. 먼저 주소록에서 그룹을 생성하세요.
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">
            검색 결과가 없습니다.
          </div>
        ) : (
          <>
            <div className="border rounded">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left">그룹명</th>
                    <th className="px-4 py-2 text-left">설명</th>
                    <th className="w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedGroups.map((group) => (
                    <tr key={group.id} className="border-t">
                      <td className="px-4 py-2 font-medium">{group.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {group.description || "-"}
                      </td>
                      <td className="px-4 py-2">
                        <Button size="sm" onClick={() => onSelectGroup(group.id)}>
                          선택
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredGroups.length > 0 && (
              <div className="flex justify-between items-center mt-2">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        className={
                          currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                        }
                      />
                    </PaginationItem>

                    {/* First page */}
                    {currentPage > 2 && (
                      <PaginationItem>
                        <PaginationLink onClick={() => setCurrentPage(1)}>1</PaginationLink>
                      </PaginationItem>
                    )}

                    {/* Ellipsis */}
                    {currentPage > 3 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}

                    {/* Previous page */}
                    {currentPage > 1 && (
                      <PaginationItem>
                        <PaginationLink onClick={() => setCurrentPage(currentPage - 1)}>
                          {currentPage - 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    {/* Current page */}
                    <PaginationItem>
                      <PaginationLink isActive>{currentPage}</PaginationLink>
                    </PaginationItem>

                    {/* Next page */}
                    {currentPage < totalPages && (
                      <PaginationItem>
                        <PaginationLink onClick={() => setCurrentPage(currentPage + 1)}>
                          {currentPage + 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    {/* Ellipsis */}
                    {currentPage < totalPages - 2 && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}

                    {/* Last page */}
                    {currentPage < totalPages - 1 && (
                      <PaginationItem>
                        <PaginationLink onClick={() => setCurrentPage(totalPages)}>
                          {totalPages}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        className={
                          currentPage === totalPages
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
