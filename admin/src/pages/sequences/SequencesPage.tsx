import { Play, Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useBulkDeleteSequences,
  useBulkUpdateSequenceStatus,
  useCreateSequence,
  useDeleteSequence,
  useUpdateSequence,
} from "@/lib/api/hooks/sequences";
import type { Sequence, SequenceStatus } from "@/lib/api/types/sequence";
import { BulkActionModal } from "./BulkActionModal";
import { SequenceDetailTabs } from "./SequenceDetailTabs";
import { SequenceFilters } from "./SequenceFilters";
import { SequenceForm } from "./SequenceForm";
import { SequencesTableWithPagination } from "./SequencesTableWithPagination";

export default function SequencesPage() {
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const [isCreating, setIsCreating] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [selectedSequences, setSelectedSequences] = useState<string[]>([]);
  const [showBulkActionModal, setShowBulkActionModal] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<
    "status" | "delete" | null
  >(null);

  const createSequence = useCreateSequence();
  const updateSequence = useUpdateSequence();
  const _deleteSequence = useDeleteSequence();
  const bulkUpdateStatus = useBulkUpdateSequenceStatus();
  const bulkDeleteSequences = useBulkDeleteSequences();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleCreateSequence = async (sequenceData: unknown) => {
    createSequence.mutate(
      sequenceData as {
        name: string;
        description?: string;
        workspaceId: string;
        status: SequenceStatus;
      },
      {
        onSuccess: () => {
          setIsCreating(false);
        },
      }
    );
  };

  const handleUpdateSequence = async (sequenceData: unknown) => {
    if (!editingSequence) return;
    updateSequence.mutate(
      {
        sequenceId: editingSequence.id,
        data: sequenceData as {
          name: string;
          description?: string;
          status: SequenceStatus;
        },
      },
      {
        onSuccess: () => {
          setEditingSequence(null);
        },
      }
    );
  };

  const handleBulkDelete = async () => {
    if (selectedSequences.length === 0) return;

    if (
      !confirm(
        `선택한 ${selectedSequences.length}개의 시퀀스를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`
      )
    )
      return;

    bulkDeleteSequences.mutate(selectedSequences, {
      onSuccess: () => {
        setSelectedSequences([]);
      },
    });
  };

  const handleBulkAction = async (
    actionType: string,
    value: string | string[]
  ) => {
    if (selectedSequences.length === 0) {
      toast.error("선택된 시퀀스가 없습니다.");
      return;
    }

    if (actionType === "status") {
      bulkUpdateStatus.mutate(
        { sequenceIds: selectedSequences, status: value as SequenceStatus },
        {
          onSuccess: () => {
            setSelectedSequences([]);
          },
        }
      );
    }
  };

  const openBulkActionModal = (type: "status" | "delete") => {
    if (selectedSequences.length === 0) {
      toast.error("선택된 시퀀스가 없습니다.");
      return;
    }
    setBulkActionType(type);
    setShowBulkActionModal(true);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearchQuery(searchInput);
    }
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSearchInput("");
    setSearchQuery("");
  };

  const toggleSequenceSelection = useCallback((sequenceId: string) => {
    setSelectedSequences((prev) =>
      prev.includes(sequenceId)
        ? prev.filter((id) => id !== sequenceId)
        : [...prev, sequenceId]
    );
  }, []);

  const toggleAllSequences = useCallback((sequenceIds: string[]) => {
    setSelectedSequences((prev) =>
      prev.length === sequenceIds.length ? [] : sequenceIds
    );
  }, []);

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Filters */}
      <SequenceFilters
        selectedStatuses={selectedStatuses}
        onStatusChange={setSelectedStatuses}
        onClearFilters={clearFilters}
      />

      {/* Sequences Table */}
      <Card>
        <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">시퀀스 관리</CardTitle>
          <Button onClick={() => setIsCreating(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />새 시퀀스
          </Button>
        </CardHeader>
        <CardContent>
          {/* Search input - positioned below title */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="시퀀스명으로 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-10 pr-10 w-full"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("");
                    setSearchQuery("");
                  }}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedSequences.length > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">
                  {selectedSequences.length}개 선택됨
                </span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkActionModal("status")}
                >
                  <Play className="h-4 w-4 mr-1" />
                  상태 변경
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  선택 삭제
                </Button>
              </div>
            </div>
          )}

          {/* Sequences Table with Pagination */}
          <SequencesTableWithPagination
            searchQuery={searchQuery}
            selectedStatuses={selectedStatuses}
            selectedSequences={selectedSequences}
            onToggleSequence={toggleSequenceSelection}
            onToggleAll={toggleAllSequences}
            onEditSequence={setEditingSequence}
          />
        </CardContent>
      </Card>

      {/* Create Sequence Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">
              새 시퀀스 생성
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            <SequenceForm
              isEdit={false}
              onSave={handleCreateSequence}
              onCancel={() => setIsCreating(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Sequence Dialog */}
      <Dialog
        open={!!editingSequence}
        onOpenChange={() => setEditingSequence(null)}
      >
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">
              시퀀스 관리
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            {editingSequence && (
              <div className="space-y-6">
                <SequenceForm
                  sequence={editingSequence}
                  isEdit={true}
                  onSave={handleUpdateSequence}
                  onCancel={() => setEditingSequence(null)}
                />
                <div className="border-t pt-6">
                  <SequenceDetailTabs sequenceId={editingSequence.id} />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Modal */}
      <BulkActionModal
        isOpen={showBulkActionModal}
        onClose={() => {
          setShowBulkActionModal(false);
          setBulkActionType(null);
        }}
        onConfirm={handleBulkAction}
        sequenceCount={selectedSequences.length}
        actionType={bulkActionType}
      />
    </div>
  );
}
