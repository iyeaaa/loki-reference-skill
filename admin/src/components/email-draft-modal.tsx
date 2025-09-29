import { useAtom } from "jotai"
import { useEffect, useId, useState } from "react"
import { emailDraftsAtom, leadsAtom } from "../lib/atoms"
import { Modal } from "./ui/modal"

export default function EmailDraftModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

  return (
    <Modal className="w-[900px] fixed" open={open} onClose={onClose} title="이메일 초안 작성">
      {/* 빈 컨텐츠 */}
      <div className="flex gap-4 ">
        <SelectableLeadsList onSelectLead={setSelectedLeadId} selectedLeadId={selectedLeadId} />
        <EmailDraftContent selectedLeadId={selectedLeadId} />
      </div>
    </Modal>
  )
}

const SelectableLeadsList = ({
  onSelectLead,
  selectedLeadId,
}: {
  onSelectLead: (id: string) => void
  selectedLeadId: string | null
}) => {
  const [leads] = useAtom(leadsAtom)
  const [emailDrafts] = useAtom(emailDraftsAtom)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  const totalPages = Math.ceil(leads.length / itemsPerPage)

  const currentLeads = leads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="w-[200px] flex flex-col">
      <div className="flex-1 flex flex-col gap-4 py-2">
        {currentLeads.map((lead) => (
          <button
            type="button"
            onClick={() => onSelectLead(lead.id)}
            key={lead.id}
            className={`w-full text-left cursor-pointer p-2 rounded ${
              selectedLeadId === lead.id ? "bg-blue-100" : "hover:bg-gray-50"
            }`}
          >
            <p className="font-semibold">{lead.company}</p>
            <p className="text-[10px] text-gray-500">{lead.email}</p>
            {emailDrafts[lead.id] && (
              <div className="mt-1 text-[10px] text-green-600">저장된 초안 있음</div>
            )}
          </button>
        ))}
      </div>

      {/* Pagination controls */}
      <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2 px-2">
        <button
          type="button"
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="text-sm px-2 py-1 disabled:opacity-50"
        >
          이전
        </button>
        <span className="text-xs">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="text-sm px-2 py-1 disabled:opacity-50"
        >
          다음
        </button>
      </div>
    </div>
  )
}

const EmailDraftContent = ({ selectedLeadId }: { selectedLeadId: string | null }) => {
  const [leads] = useAtom(leadsAtom)
  const [emailDrafts, setEmailDrafts] = useAtom(emailDraftsAtom)
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const subjectInputId = useId()
  const bodyTextareaId = useId()

  // Find the selected lead
  const selectedLead = selectedLeadId ? leads.find((lead) => lead.id === selectedLeadId) : null

  // Load draft when lead changes
  useEffect(() => {
    if (selectedLeadId) {
      const draft = emailDrafts[selectedLeadId]
      if (draft) {
        setSubject(draft.subject)
        setBody(draft.body)
      } else {
        // Reset form if no draft exists
        setSubject("")
        setBody("")
      }
    }
    setSaveStatus("idle")
  }, [selectedLeadId, emailDrafts])

  const handleSave = () => {
    if (!selectedLeadId) return

    setSaveStatus("saving")
    try {
      // Update the drafts atom
      setEmailDrafts((prev) => ({
        ...prev,
        [selectedLeadId]: { subject, body },
      }))

      setSaveStatus("saved")

      // Reset status after 2 seconds
      setTimeout(() => {
        setSaveStatus("idle")
      }, 2000)
    } catch (error) {
      console.error("Failed to save draft:", error)
      setSaveStatus("error")
    }
  }

  return (
    <div className="p-4 flex flex-col gap-6 w-full">
      {selectedLead ? (
        <>
          <div className="text-sm mb-2">
            <span className="font-medium">선택된 회사:</span> {selectedLead.company} (
            {selectedLead.email})
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={subjectInputId}>제목</label>
            <input
              className="w-full border border-gray-200 p-2 rounded-2xl"
              type="text"
              id={subjectInputId}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={bodyTextareaId}>본문</label>
            <textarea
              className="w-full border border-gray-200 p-2 rounded-2xl resize-none"
              id={bodyTextareaId}
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            ></textarea>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === "saving"}
              className="px-4 py-2 bg-black text-white rounded hover:bg-black/80 disabled:opacity-50"
            >
              {saveStatus === "saving"
                ? "저장 중..."
                : saveStatus === "saved"
                  ? "저장됨"
                  : saveStatus === "error"
                    ? "저장 실패"
                    : "임시 저장"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          왼쪽에서 리드를 선택해주세요
        </div>
      )}
    </div>
  )
}
