import { useCallback, useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { addressBookApi, type AddressBookContact, type AddressBookGroup } from "@/lib/api/services/address-book"
import { Button } from "@/components/ui/button"

export default function AddressBookGroupPage() {
  const params = useParams()
  const groupId = params.groupId as string
  const [group, setGroup] = useState<AddressBookGroup | null>(null)
  const [contacts, setContacts] = useState<AddressBookContact[]>([])
  const [company, setCompany] = useState("")
  const [email, setEmail] = useState("")

  const load = useCallback(async () => {
    const groups = await addressBookApi.listGroups({ limit: 100 })
    const found = groups.groups.find((g) => g.id === groupId) || null
    setGroup(found)
    const res = await addressBookApi.listContacts(groupId, { limit: 200 })
    setContacts(res.contacts)
  }, [groupId])

  useEffect(() => {
    if (groupId) load()
  }, [groupId, load])

  const add = async () => {
    if (!company.trim() || !email.trim()) return
    await addressBookApi.addContact(groupId, { company: company.trim(), email: email.trim() })
    setCompany("")
    setEmail("")
    await load()
  }

  const remove = async (id: string) => {
    await addressBookApi.deleteContact(id)
    await load()
  }

  if (!group) return <div className="p-4">그룹을 불러오는 중...</div>

  return (
    <div className="p-4 space-y-4">
      <div className="text-xl font-semibold">{group.name}</div>
      {group.description && <div className="text-sm text-muted-foreground">{group.description}</div>}

      <div className="flex items-center gap-2">
        <input className="border rounded px-2 py-1" placeholder="회사명" value={company} onChange={(e) => setCompany(e.target.value)} />
        <input className="border rounded px-2 py-1" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button onClick={add}>추가</Button>
      </div>

      <div className="border rounded overflow-x-auto">
        {contacts.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">연락처가 없습니다. 추가해보세요.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-1 text-left min-w-[120px]">회사명</th>
                <th className="px-2 py-1 text-left min-w-[80px]">산업</th>
                <th className="px-2 py-1 text-left min-w-[80px]">국가</th>
                <th className="px-2 py-1 text-left min-w-[200px]">설명</th>
                <th className="px-2 py-1 text-left min-w-[150px]">이메일</th>
                <th className="px-2 py-1 text-left min-w-[100px]">웹사이트</th>
                <th className="w-16"></th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-t hover:bg-muted/30">
                  <td className="px-2 py-1 font-medium">{c.company}</td>
                  <td className="px-2 py-1 text-muted-foreground text-xs">
                    {c.industryType && <div>{c.industryType}</div>}
                    {c.productCategory && <div className="text-xs opacity-70">{c.productCategory}</div>}
                  </td>
                  <td className="px-2 py-1 text-muted-foreground text-xs">{c.country}</td>
                  <td className="px-2 py-1 text-muted-foreground text-xs max-w-[200px]">
                    {c.description ? (
                      <div className="truncate" title={c.description}>
                        {c.description}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-muted-foreground text-xs">{c.email}</td>
                  <td className="px-2 py-1 text-xs">
                    {c.websiteUrl ? (
                      <a
                        href={c.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline truncate block max-w-[100px]"
                        title={c.websiteUrl}
                      >
                        웹사이트
                      </a>
                    ) : (
                      <span className="text-muted-foreground/50">-</span>
                    )}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>삭제</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}


