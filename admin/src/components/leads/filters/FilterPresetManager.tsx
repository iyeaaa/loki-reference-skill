import { BookmarkIcon, PlusIcon, StarIcon, TrashIcon } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ColumnFilter, FilterPreset } from "@/lib/api/types/lead-filters"

interface FilterPresetManagerProps {
  presets: FilterPreset[]
  currentFilters: ColumnFilter[]
  onLoadPreset: (preset: FilterPreset) => void
  onSavePreset: (name: string) => void
  onDeletePreset: (id: string) => void
  onRenamePreset: (id: string, newName: string) => void
}

/**
 * Component for managing filter presets
 * Allows saving, loading, renaming, and deleting filter presets
 */
export function FilterPresetManager({
  presets,
  currentFilters,
  onLoadPreset,
  onSavePreset,
  onDeletePreset,
  onRenamePreset,
}: FilterPresetManagerProps) {
  const presetNameId = useId()
  const newPresetNameId = useId()
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [presetName, setPresetName] = useState("")
  const [selectedPreset, setSelectedPreset] = useState<FilterPreset | null>(null)
  const [newPresetName, setNewPresetName] = useState("")

  const handleSavePreset = () => {
    if (presetName.trim()) {
      onSavePreset(presetName.trim())
      setPresetName("")
      setIsSaveDialogOpen(false)
    }
  }

  const handleRenamePreset = () => {
    if (selectedPreset && newPresetName.trim()) {
      onRenamePreset(selectedPreset.id, newPresetName.trim())
      setNewPresetName("")
      setSelectedPreset(null)
      setIsRenameDialogOpen(false)
    }
  }

  const openRenameDialog = (preset: FilterPreset) => {
    setSelectedPreset(preset)
    setNewPresetName(preset.name)
    setIsRenameDialogOpen(true)
  }

  const hasCurrentFilters = currentFilters.length > 0

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <BookmarkIcon className="h-4 w-4" />
            Filter Presets
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[250px]">
          <DropdownMenuLabel>Saved Filter Presets</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {presets.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">No saved presets</div>
          ) : (
            presets.map((preset) => (
              <div
                key={preset.id}
                className="group flex items-center justify-between px-2 py-1.5 hover:bg-accent rounded-sm"
              >
                <button
                  type="button"
                  onClick={() => onLoadPreset(preset)}
                  className="flex-1 flex items-center gap-2 text-left text-sm"
                >
                  <StarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{preset.name}</span>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      openRenameDialog(preset)
                    }}
                    className="h-6 w-6 p-0"
                    title="Rename preset"
                  >
                    <span className="sr-only">Rename</span>📝
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeletePreset(preset.id)
                    }}
                    className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    title="Delete preset"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setIsSaveDialogOpen(true)}
            disabled={!hasCurrentFilters}
            className="gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            Save Current Filters
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Preset Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Save Filter Preset</DialogTitle>
            <DialogDescription>
              Save your current filter configuration for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={presetNameId}>Preset Name</Label>
              <Input
                id={presetNameId}
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g., My Active Leads"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSavePreset()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {currentFilters.length} filter{currentFilters.length !== 1 ? "s" : ""} will be saved
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreset} disabled={!presetName.trim()}>
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Preset Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Filter Preset</DialogTitle>
            <DialogDescription>Enter a new name for this filter preset.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={newPresetNameId}>Preset Name</Label>
              <Input
                id={newPresetNameId}
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Enter new name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenamePreset()
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenamePreset} disabled={!newPresetName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
