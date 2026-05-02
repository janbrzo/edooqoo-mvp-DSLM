import { Search, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { KnowledgeCategory, KNOWLEDGE_CATEGORIES, SORT_OPTIONS } from '@/types/studentKnowledge';

interface StudentKnowledgeFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: KnowledgeCategory | null;
  onCategoryChange: (category: KnowledgeCategory | null) => void;
  sortBy: 'newest' | 'oldest' | 'category';
  onSortChange: (sort: 'newest' | 'oldest' | 'category') => void;
  showOutdated: boolean;
  onShowOutdatedChange: (value: boolean) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
  groupBy?: 'none' | 'category';
  onGroupByChange?: (value: 'none' | 'category') => void;
  totalCount?: number;
}

export const StudentKnowledgeFilterBar = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
  showOutdated,
  onShowOutdatedChange,
  onReset,
  hasActiveFilters,
  groupBy,
  onGroupByChange,
  totalCount,
}: StudentKnowledgeFilterBarProps) => {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Search Input */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search in notes..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 pr-4"
        />
      </div>

      {/* Filters - compact layout in one line */}
      <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
        {/* View Type (Group By) */}
        {groupBy !== undefined && onGroupByChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">View:</span>
            <Select value={groupBy} onValueChange={onGroupByChange}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Timeline</SelectItem>
                <SelectItem value="category">By Category</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Category Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-9">
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Category</span>
              {selectedCategory && (
                <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-xs">
                  1
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm">Filter by Category</h4>
                {selectedCategory && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCategoryChange(null)}
                    className="h-auto p-1 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {KNOWLEDGE_CATEGORIES.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onCategoryChange(cat.id)}
                    className="justify-start gap-2 h-auto py-2"
                  >
                    <span className="text-base">{cat.icon}</span>
                    <span className="text-xs truncate">{cat.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Sort By */}
        <Select value={sortBy} onValueChange={onSortChange}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Show Outdated Toggle */}
        <div className="flex items-center gap-1.5 border rounded-md px-2.5 h-9 bg-background">
          <Switch
            id="show-outdated"
            checked={showOutdated}
            onCheckedChange={onShowOutdatedChange}
            className="scale-90"
          />
          <Label htmlFor="show-outdated" className="text-xs cursor-pointer whitespace-nowrap">
            Outdated
          </Label>
        </div>

        {/* Total Count */}
        {totalCount !== undefined && (
          <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
            {totalCount} {totalCount === 1 ? 'note' : 'notes'}
          </span>
        )}

        {/* Reset Filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 h-9 px-2.5">
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </Button>
        )}
      </div>
    </div>
  );
};
