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
      animate="visible"
      className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-8"
      initial="hidden"
      variants={staggerContainerVariants}
    >
      <motion.div className="w-full max-w-2xl space-y-8" variants={staggerItemVariants}>
        {/* Logo or Title */}
        <div className="text-center">
          <motion.h1
            animate="visible"
            className="mb-2 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text font-bold text-5xl text-transparent"
            initial="hidden"
            variants={slideUpVariants}
          >
            {t("webset.page.title")}
          </motion.h1>
          <motion.p
            animate="visible"
            className="text-lg text-slate-600 dark:text-slate-400"
            initial="hidden"
            transition={{ delay: 0.2 }}
            variants={fadeVariants}
          >
            {t("webset.page.subtitle")}
          </motion.p>
        </div>

        {/* Search Bar */}
        <motion.form
          animate="visible"
          className="relative"
          initial="hidden"
          onSubmit={handleSearch}
          transition={{ delay: 0.3 }}
          variants={slideUpVariants}
        >
          <motion.div
            className="relative flex items-center"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Search className="absolute left-4 h-5 w-5 text-slate-400" />
            <Input
              className="h-14 w-full rounded-full border-2 border-slate-200 bg-white pr-4 pl-12 text-lg shadow-lg transition-all hover:shadow-xl focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-blue-500"
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("webset.search.placeholder")}
              type="text"
              value={query}
            />
          </motion.div>
        </motion.form>
      </motion.div>

      {/* Existing Websets */}
      {selectedWorkspace && selectedWorkspace.id !== "all" && (
        <motion.div
          animate="visible"
          className="mt-12 w-full max-w-2xl"
          initial="hidden"
          transition={{ delay: 0.5 }}
          variants={slideUpVariants}
        >
          {isLoading ? (
            <div className="grid grid-cols-1 gap-6">
              {[...new Array(6)].map((_, i) => (
                <Card className="animate-pulse" key={i}>
                  <CardHeader>
                    <div className="h-4 w-3/4 rounded bg-gray-200" />
                    <div className="h-3 w-1/2 rounded bg-gray-200" />
                  </CardHeader>
                  <CardContent>
                    <div className="mb-2 h-3 w-full rounded bg-gray-200" />
                    <div className="h-3 w-2/3 rounded bg-gray-200" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : websets?.data && websets.data.length > 0 ? (
            <motion.div
              animate="visible"
              className="grid grid-cols-1 gap-6"
              initial="hidden"
              variants={staggerContainerVariants}
            >
              {websets.data.map((webset, index) => (
                <motion.div
                  key={webset.id}
                  transition={{ delay: index * 0.1 }}
                  variants={staggerItemVariants}
                >
                  <Card
                    className="cursor-pointer border-2 border-slate-200 transition-colors duration-200 hover:border-indigo-500 dark:border-slate-700 dark:hover:border-indigo-400"
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
                      <p className="line-clamp-2 text-gray-600 text-sm dark:text-gray-400">
                        {webset.query}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="py-12 text-center">
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
