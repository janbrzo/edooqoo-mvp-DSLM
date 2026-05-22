import { useState, useMemo } from 'react';
import { Plus, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { StudentKnowledgeFilterBar } from './StudentKnowledgeFilterBar';
import { StudentKnowledgeEntryCard } from './StudentKnowledgeEntryCard';
import { StudentKnowledgeSidePanel } from './StudentKnowledgeSidePanel';
import { useStudentKnowledge } from '@/hooks/useStudentKnowledge';
import {
  StudentKnowledgeEntry,
  UpdateKnowledgeEntry,
  NewKnowledgeEntry,
  KnowledgeCategory,
  DEFAULT_FILTERS,
  KNOWLEDGE_CATEGORIES,
} from '@/types/studentKnowledge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface StudentKnowledgeSectionProps {
  studentId: string;
  teacherId: string;
  studentName: string;
}

export const StudentKnowledgeSection = ({
  studentId,
  teacherId,
  studentName,
}: StudentKnowledgeSectionProps) => {
  const {
    entries,
    isLoading,
    filters,
    totalCount,
    hasMore,
    suggestedTags,
    addEntry,
    updateEntry,
    deleteEntry,
    markAsOutdated,
    markAsCurrent,
    fetchEntries,
    loadMore,
    resetFilters,
  } = useStudentKnowledge({ studentId, teacherId });

  const [panelMode, setPanelMode] = useState<'add' | 'view' | 'edit'>('add');
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<StudentKnowledgeEntry | null>(null);
  const [groupBy, setGroupBy] = useState<'none' | 'category'>('none');

  // Group entries by category if needed
  const groupedEntries = useMemo(() => {
    if (groupBy === 'none') {
      return { Timeline: entries };
    }

    const grouped: Record<string, StudentKnowledgeEntry[]> = {};
    entries.forEach((entry) => {
      if (!grouped[entry.category]) {
        grouped[entry.category] = [];
      }
      grouped[entry.category].push(entry);
    });

    return grouped;
  }, [entries, groupBy]);

  const handleSearchChange = (value: string) => {
    fetchEntries({ ...filters, search: value, offset: 0 });
  };

  const handleCategoryChange = (category: KnowledgeCategory | null) => {
    fetchEntries({ ...filters, category, offset: 0 });
  };

  const handleSortChange = (sortBy: 'newest' | 'oldest' | 'category') => {
    fetchEntries({ ...filters, sortBy, offset: 0 });
  };

  const handleShowOutdatedChange = (showOutdated: boolean) => {
    fetchEntries({ ...filters, showOutdated, offset: 0 });
  };

  const handleReset = () => {
    resetFilters();
  };

  const handleOpenAddPanel = () => {
    setPanelMode('add');
    setSelectedEntry(null);
    setIsPanelOpen(true);
  };

  const handleViewEntry = (entry: StudentKnowledgeEntry) => {
    setPanelMode('view');
    setSelectedEntry(entry);
    setIsPanelOpen(true);
  };

  const handleEditEntry = (entry: StudentKnowledgeEntry) => {
    setPanelMode('edit');
    setSelectedEntry(entry);
    setIsPanelOpen(true);
  };

  const handlePanelSave = async (data: NewKnowledgeEntry | { entryId: string; updates: UpdateKnowledgeEntry }) => {
    if ('entryId' in data) {
      // Edit mode
      await updateEntry(data.entryId, data.updates);
    } else {
      // Add mode
      await addEntry(data);
    }
    setIsPanelOpen(false);
    setSelectedEntry(null);
  };

  const handleDelete = async (entryId: string) => {
    await deleteEntry(entryId);
  };

  const handleMarkOutdated = async (entryId: string) => {
    await markAsOutdated(entryId);
  };

  const handleMarkCurrent = async (entryId: string) => {
    await markAsCurrent(entryId);
  };

  const hasActiveFilters =
    filters.search !== '' ||
    filters.category !== null ||
    filters.sortBy !== DEFAULT_FILTERS.sortBy ||
    filters.showOutdated !== DEFAULT_FILTERS.showOutdated;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Student Knowledge</h2>
          <p className="text-sm text-muted-foreground">
            Notes and observations about {studentName}
          </p>
        </div>
        <Button onClick={handleOpenAddPanel} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Note
        </Button>
      </div>

      <Separator />

      {/* Filter Bar */}
      <StudentKnowledgeFilterBar
        searchQuery={filters.search || ''}
        onSearchChange={handleSearchChange}
        selectedCategory={filters.category || null}
        onCategoryChange={handleCategoryChange}
        sortBy={filters.sortBy || 'newest'}
        onSortChange={handleSortChange}
        showOutdated={filters.showOutdated || false}
        onShowOutdatedChange={handleShowOutdatedChange}
        onReset={handleReset}
        hasActiveFilters={hasActiveFilters}
        groupBy={groupBy}
        onGroupByChange={(v) => setGroupBy(v)}
        totalCount={totalCount}
      />

      {/* Loading State */}
      {isLoading && entries.length === 0 && (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-6 w-32 mb-3" />
                <Skeleton className="h-20 w-full mb-3" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && entries.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No notes yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Start building your knowledge base about {studentName} by adding your first note.
            </p>
            <Button onClick={handleOpenAddPanel} className="gap-2">
              <Plus className="h-4 w-4" />
              Add your first note
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Entries List */}
      {!isLoading && entries.length > 0 && (
        <div className="space-y-6">
          {Object.entries(groupedEntries).map(([groupName, groupEntries]) => (
            <div key={groupName} className="space-y-3">
              {/* Group Header (only show if grouped by category) */}
              {groupBy === 'category' && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">
                    {KNOWLEDGE_CATEGORIES.find((c) => c.id === groupName)?.icon}
                  </span>
                  <h3 className="text-lg font-semibold">
                    {KNOWLEDGE_CATEGORIES.find((c) => c.id === groupName)?.label || groupName}
                  </h3>
                  <span className="text-sm text-muted-foreground">
                    ({groupEntries.length})
                  </span>
                </div>
              )}

              {/* Entry Cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {groupEntries.map((entry) => (
                  <StudentKnowledgeEntryCard
                    key={entry.id}
                    entry={entry}
                    onView={handleViewEntry}
                    onEdit={handleEditEntry}
                    onDelete={handleDelete}
                    onMarkOutdated={handleMarkOutdated}
                    onMarkCurrent={handleMarkCurrent}
                    worksheetTitle={entry.worksheet_id ? 'Worksheet' : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && !isLoading && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={loadMore}>
            Load More
          </Button>
        </div>
      )}

      {/* Side Panel */}
      <StudentKnowledgeSidePanel
        mode={panelMode}
        isOpen={isPanelOpen}
        onClose={() => {
          setIsPanelOpen(false);
          setSelectedEntry(null);
        }}
        entry={selectedEntry}
        studentId={studentId}
        teacherId={teacherId}
        studentName={studentName}
        onSave={handlePanelSave}
        suggestedTags={suggestedTags}
      />
    </div>
  );
};
