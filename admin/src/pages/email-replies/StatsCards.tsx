import { CheckCircle, Inbox, Mail, MessageSquare, XCircle } from "lucide-react"
import { Card } from "@/components/ui/card"

interface Category {
  id: string
  label: string
  count: number
}

interface StatsCardsProps {
  categories: Category[]
  selectedCategory: string
  onSelectCategory: (categoryId: string) => void
}

const getCategoryIcon = (categoryId: string) => {
  switch (categoryId) {
    case "all":
      return <Inbox className="h-5 w-5" />
    case "out_of_office":
      return <Mail className="h-5 w-5" />
    case "positive_interest":
      return <CheckCircle className="h-5 w-5" />
    case "not_interested":
      return <XCircle className="h-5 w-5" />
    case "neutral":
    case "unclassified":
      return <MessageSquare className="h-5 w-5" />
    default:
      return <MessageSquare className="h-5 w-5" />
  }
}

const getCategoryColor = (categoryId: string) => {
  switch (categoryId) {
    case "all":
      return "text-blue-600 bg-blue-50"
    case "out_of_office":
      return "text-gray-600 bg-gray-50"
    case "positive_interest":
      return "text-green-600 bg-green-50"
    case "not_interested":
      return "text-red-600 bg-red-50"
    case "neutral":
      return "text-purple-600 bg-purple-50"
    case "unclassified":
      return "text-orange-600 bg-orange-50"
    default:
      return "text-gray-600 bg-gray-50"
  }
}

export function StatsCards({ categories, selectedCategory, onSelectCategory }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {categories.map((category) => {
        const isSelected = selectedCategory === category.id
        const colorClass = getCategoryColor(category.id)

        return (
          <Card
            key={category.id}
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              isSelected ? "ring-2 ring-blue-500 bg-blue-50/50" : "hover:bg-gray-50"
            }`}
            onClick={() => onSelectCategory(category.id)}
          >
            <div className="flex flex-col gap-2">
              <div
                className={`w-10 h-10 rounded-lg ${colorClass} flex items-center justify-center`}
              >
                {getCategoryIcon(category.id)}
              </div>
              <div>
                <div className="text-2xl font-bold">{category.count}</div>
                <div className="text-sm text-gray-600">{category.label}</div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
