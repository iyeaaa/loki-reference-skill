import { useCallback, useEffect, useState } from "react"
import { addressBookApi, type AddressBookGroup } from "@/lib/api/services/address-book"
import { Button } from "@/components/ui/button"

export default function AddressBookListPage() {
  const [groups, setGroups] = useState<AddressBookGroup[]>([])
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")

  const load = useCallback(async () => {
    const res = await addressBookApi.listGroups({ limit: 50 })
    setGroups(res.groups)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const create = async () => {
    if (!name.trim()) return
    await addressBookApi.createGroup({ name: name.trim(), description: desc.trim() || undefined })
    setName("")
    setDesc("")
    await load()
  }

  const remove = async (id: string) => {
    await addressBookApi.deleteGroup(id)
    await load()
  }

  return (
    <div className="p-4 space-y-4">
      <div className="text-xl font-semibold">주소록 그룹</div>
      <div className="flex items-center gap-2">
        <input className="border rounded px-2 py-1" placeholder="그룹명" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="border rounded px-2 py-1 w-80" placeholder="설명(선택)" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button onClick={create}>생성</Button>
      </div>
      <div className="border rounded">
        {groups.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">그룹이 없습니다. 새로 생성해보세요.</div>
        ) : (
          <ul className="divide-y">
            {groups.map((g) => (
              <li key={g.id} className="p-3 flex items-center gap-2">
                <div className="flex-1">
                  <div className="font-medium">{g.name}</div>
                  {g.description && <div className="text-xs text-muted-foreground">{g.description}</div>}
                </div>
                <Button asChild variant="outline">
                  <a href={`/address-book/${g.id}`}>열기</a>
                </Button>
                <Button variant="ghost" onClick={() => remove(g.id)}>삭제</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}


