import { motion } from "framer-motion"
import { Search } from "lucide-react"
import { useQueryState } from "nuqs"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  fadeVariants,
  slideUpVariants,
  staggerContainerVariants,
  staggerItemVariants,
} from "@/lib/animations"
import { useWebsets } from "@/lib/api/hooks/websets"
import { useWorkspace } from "@/lib/hooks/useWorkspace"

export default function WebsetPage() {
  const { t } = useTranslation()
  const [query, setQuery] = useQueryState("query", { defaultValue: "" })
  const navigate = useNavigate()
  const { selectedWorkspace } = useWorkspace()
  const { data: websets, isLoading } = useWebsets(selectedWorkspace?.id || "", 20, 0)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      navigate(`/websets/criteria?query=${encodeURIComponent(query)}`)
    }
  }

  return (
    <motion.div
      className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4 py-8"
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div className="w-full max-w-2xl space-y-8" variants={staggerItemVariants}>
        {/* Logo or Title */}
        <div className="text-center">
          <motion.h1
            className="text-5xl font-bold mb-2 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent"
            variants={slideUpVariants}
            initial="hidden"
            animate="visible"
          >
            {t("webset.page.title")}
          </motion.h1>
          <motion.p
            className="text-lg text-slate-600 dark:text-slate-400"
            variants={fadeVariants}
            initial="hidden"
            animate="visible"
            transition={{ delay: 0.2 }}
          >
            {t("webset.page.subtitle")}
          </motion.p>
        </div>

        {/* Search Bar */}
        <motion.form
          onSubmit={handleSearch}
          className="relative"
          variants={slideUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.3 }}
        >
          <motion.div
            className="relative flex items-center"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Search className="absolute left-4 h-5 w-5 text-slate-400" />
            <Input
              type="text"
              placeholder={t("webset.search.placeholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-14 pl-12 pr-4 text-lg rounded-full border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 dark:focus:border-blue-500 shadow-lg hover:shadow-xl transition-all bg-white dark:bg-slate-800"
            />
          </motion.div>
        </motion.form>
      </motion.div>

      {/* Existing Websets */}
      {selectedWorkspace && selectedWorkspace.id !== "all" && (
        <motion.div
          className="w-full max-w-2xl mt-12"
          variants={slideUpVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.5 }}
        >
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : websets?.data && websets.data.length > 0 ? (
            <motion.div
              className="grid grid-cols-1 gap-6"
              variants={staggerContainerVariants}
              initial="hidden"
              animate="visible"
            >
              {websets.data.map((webset, index) => (
                <motion.div
                  key={webset.id}
                  variants={staggerItemVariants}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card
                    className="cursor-pointer border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors duration-200"
                    onClick={() => navigate(`/websets/${webset.id}`)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{webset.title || "Untitled Webset"}</CardTitle>
                      <CardDescription>
                        {webset.criterias?.length || 0} criteria • {webset.targetValidatedRows || 0}{" "}
                        target rows
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {webset.query}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500 dark:text-gray-400">
                No websets found. Create your first webset by searching above.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}
