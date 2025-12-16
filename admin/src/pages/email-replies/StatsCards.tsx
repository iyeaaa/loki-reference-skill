import { CheckCircle, Inbox, Mail, MessageSquare, XCircle } from "lucide-react"
import { Card } from "@/components/ui/card"

type Category = {
  id: string
  label: string
  count: number
}

type StatsCardsProps = {
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {categories.map((category) => {
        const isSelected = selectedCategory === category.id
        const colorClass = getCategoryColor(category.id)

        return (
          <Card
            className={`cursor-pointer p-4 transition-all hover:shadow-md ${
              isSelected ? "bg-blue-50/50 ring-2 ring-blue-500" : "hover:bg-gray-50"
            }`}
            key={category.id}
            onClick={() => onSelectCategory(category.id)}
          >
            <div className="flex flex-col gap-2">
              <div
                className={`h-10 w-10 rounded-lg ${colorClass} flex items-center justify-center`}
              >
                {getCategoryIcon(category.id)}
              </div>
              <div>
                <div className="font-bold text-2xl">{category.count}</div>
                <div className="text-gray-600 text-sm">{category.label}</div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
