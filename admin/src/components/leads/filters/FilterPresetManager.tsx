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

type FilterPresetManagerProps = {
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
          <Button className="gap-2" size="sm" variant="outline">
            <BookmarkIcon className="h-4 w-4" />
            Filter Presets
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[250px]">
          <DropdownMenuLabel>Saved Filter Presets</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {presets.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">No saved presets</div>
          ) : (
            presets.map((preset) => (
              <div
                className="group flex items-center justify-between rounded-sm px-2 py-1.5 hover:bg-accent"
                key={preset.id}
              >
                <button
                  className="flex flex-1 items-center gap-2 text-left text-sm"
                  onClick={() => onLoadPreset(preset)}
                  type="button"
                >
                  <StarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{preset.name}</span>
                </button>
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      openRenameDialog(preset)
                    }}
                    size="sm"
                    title="Rename preset"
                    variant="ghost"
                  >
                    <span className="sr-only">Rename</span>📝
                  </Button>
                  <Button
                    className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeletePreset(preset.id)
                    }}
                    size="sm"
                    title="Delete preset"
                    variant="ghost"
                  >
                    <TrashIcon className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="gap-2"
            disabled={!hasCurrentFilters}
            onClick={() => setIsSaveDialogOpen(true)}
          >
            <PlusIcon className="h-4 w-4" />
            Save Current Filters
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Preset Dialog */}
      <Dialog onOpenChange={setIsSaveDialogOpen} open={isSaveDialogOpen}>
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
                autoFocus
                id={presetNameId}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSavePreset()
                  }
                }}
                placeholder="e.g., My Active Leads"
                value={presetName}
              />
            </div>
            <div className="text-muted-foreground text-sm">
              {currentFilters.length} filter{currentFilters.length !== 1 ? "s" : ""} will be saved
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsSaveDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button disabled={!presetName.trim()} onClick={handleSavePreset}>
              Save Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Preset Dialog */}
      <Dialog onOpenChange={setIsRenameDialogOpen} open={isRenameDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Filter Preset</DialogTitle>
            <DialogDescription>Enter a new name for this filter preset.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={newPresetNameId}>Preset Name</Label>
              <Input
                autoFocus
                id={newPresetNameId}
                onChange={(e) => setNewPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenamePreset()
                  }
                }}
                placeholder="Enter new name"
                value={newPresetName}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsRenameDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button disabled={!newPresetName.trim()} onClick={handleRenamePreset}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
