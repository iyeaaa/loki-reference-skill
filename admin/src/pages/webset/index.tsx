import { Search } from "lucide-react"
import { useQueryState } from "nuqs"
import { useNavigate } from "react-router-dom"
import { Input } from "@/components/ui/input"

export default function WebsetPage() {
  const [query, setQuery] = useQueryState("query", { defaultValue: "" })
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/websets/criteria?query=${encodeURIComponent(query)}`)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Logo or Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">Web Search</h1>
          <p className="text-gray-600 dark:text-gray-400">Search the web for information</p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="relative">
          <div className="relative flex items-center">
            <Search className="absolute left-4 h-5 w-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search anything..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-14 pl-12 pr-4 text-lg rounded-full border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500 shadow-lg hover:shadow-xl transition-all"
            />
          </div>
        </form>
      </div>
    </div>
  )
}
