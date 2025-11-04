import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { EmailIntent } from "@/lib/api/types/email"

interface CategoryFilterProps {
  categories: {
    id: string
    label: string
    count: number
    intent?: EmailIntent | "all" | "unclassified"
  }[]
  selectedCategory: string
  onSelectCategory: (categoryId: string) => void
}

export function CategoryFilter({
  categories,
  selectedCategory,
  onSelectCategory,
}: CategoryFilterProps) {
  const getCategoryColor = (categoryId: string, isSelected: boolean) => {
    if (categoryId === "all") {
      return isSelected
        ? "bg-blue-500 text-white hover:bg-blue-600"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
    }

    if (categoryId === "positive_interest") {
      return isSelected
        ? "bg-green-500 text-white hover:bg-green-600"
        : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300"
    }

    if (categoryId === "not_interested" || categoryId === "negative") {
      return isSelected
        ? "bg-red-500 text-white hover:bg-red-600"
        : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300"
    }

    if (categoryId === "out_of_office") {
      return isSelected
        ? "bg-gray-500 text-white hover:bg-gray-600"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
    }

    if (categoryId === "unclassified") {
      return isSelected
        ? "bg-gray-500 text-white hover:bg-gray-600"
        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
    }

    // Default colors for other categories
    return isSelected
      ? "bg-blue-500 text-white hover:bg-blue-600"
      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {categories.map((category) => {
        const isSelected = selectedCategory === category.id
        return (
          <Button
            key={category.id}
            variant="ghost"
            size="sm"
            className={`${getCategoryColor(category.id, isSelected)} rounded-full px-4 py-2 h-auto font-medium transition-colors`}
            onClick={() => onSelectCategory(category.id)}
          >
            {category.label}
            <Badge
              variant="secondary"
              className={`ml-2 ${isSelected ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}
            >
              {category.count}
            </Badge>
          </Button>
        )
      })}
    </div>
  )
}
