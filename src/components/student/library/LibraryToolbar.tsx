/** LibraryToolbar — search, sort and primary action for worksheet materials. */
import React from 'react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { LibrarySort } from '@/lib/students/libraryItems';

export interface LibraryToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sort: LibrarySort;
  onSortChange: (value: LibrarySort) => void;
  onGenerate: () => void;
}

const isLibrarySort = (value: string): value is LibrarySort =>
  value === 'newest' || value === 'oldest' || value === 'title';

export const LibraryToolbar: React.FC<LibraryToolbarProps> = ({
  search,
  onSearchChange,
  sort,
  onSortChange,
  onGenerate,
}) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
    <div className="relative min-w-0 flex-1">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search materials…"
        aria-label="Search worksheet materials"
        className="pl-9"
      />
    </div>

    <div className="flex items-center gap-2">
      <Select
        value={sort}
        onValueChange={(value) => {
          if (isLibrarySort(value)) onSortChange(value);
        }}
      >
        <SelectTrigger className="min-w-0 flex-1 sm:w-36" aria-label="Sort worksheet materials">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="title">Title A–Z</SelectItem>
        </SelectContent>
      </Select>

      <Button type="button" onClick={onGenerate} className="shrink-0">
        <Plus aria-hidden="true" />
        Generate worksheet
      </Button>
    </div>
  </div>
);

export default LibraryToolbar;
