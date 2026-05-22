/**
 * Student Knowledge Types & Interfaces
 * 
 * DSLM-aligned structure for teacher notes about students.
 * Categories: Skill Assessment, Personal, Goals, Notes, Next Lesson Ideas
 */

// ============================================
// ENUMS & UNION TYPES
// ============================================

export type KnowledgeCategory =
  | 'Skill Assessment'   // Replaces: Strengths, Weaknesses, Common Mistakes, To Practice
  | 'Personal'           // Replaces: Personal Info, Professional/Work Context, Interests & Hobbies
  | 'Goals'
  | 'Notes'
  | 'Next Lesson Ideas'
  | 'Self-Profile';      // v5.2: student-filled profile from /my hub

export type SkillSubtype = 'strength' | 'weakness' | 'mistake' | 'practice';

export type PersonalSubCategory = 'personal_info' | 'work' | 'interests' | 'travel' | 'relationships' | 'personality' | 'other';

export type SkillElementType = 'grammar' | 'vocabulary' | 'speaking' | 'writing' | 'reading' | 'listening' | 'pronunciation';

/**
 * Extended metadata stored in JSONB column
 */
export interface KnowledgeMetadata {
  // For Skill Assessment entries
  skill_subtype?: SkillSubtype;
  element_type?: SkillElementType;
  nano_skill?: string;       // e.g. "past simple", "phrasal verbs"
  reason?: string;            // why this is a strength/weakness
  mastery?: number;           // 0-100 slider value
  // For Personal entries
  sub_category?: PersonalSubCategory;
}

export type EntrySource = 'manual' | 'worksheet' | 'vocabulary' | 'ai-suggested' | 'student_self';
export type SortOption = 'newest' | 'oldest' | 'category';
export type GroupOption = 'none' | 'category' | 'date';

// ============================================
// INTERFACES
// ============================================

export interface StudentKnowledgeEntry {
  id: string;
  student_id: string;
  teacher_id: string;
  category: KnowledgeCategory;
  content: string;
  tags: string[];
  worksheet_id: string | null;
  entry_source: EntrySource;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_outdated: boolean;
  outdated_at: string | null;
  outdated_reason: string | null;
  metadata?: KnowledgeMetadata;
  // v6.9.8/9.9 additions (nullable on legacy rows)
  ai_classified?: boolean | null;
  ai_confidence?: number | null;
  archived_at?: string | null;
  used_in_worksheet_id?: string | null;
}

export interface NewKnowledgeEntry {
  student_id: string;
  teacher_id: string;
  category: KnowledgeCategory;
  content: string;
  tags?: string[];
  worksheet_id?: string | null;
  entry_source?: EntrySource;
  metadata?: KnowledgeMetadata;
}

export interface UpdateKnowledgeEntry {
  category?: KnowledgeCategory;
  content?: string;
  tags?: string[];
  worksheet_id?: string | null;
  is_outdated?: boolean;
  outdated_reason?: string | null;
  metadata?: KnowledgeMetadata;
}

export interface KnowledgeFilters {
  category?: KnowledgeCategory | null;
  tags?: string[];
  search?: string;
  worksheetId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
  sortBy?: SortOption;
  showOutdated?: boolean;
}

export interface KnowledgeEntriesResponse {
  entries: StudentKnowledgeEntry[];
  total: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
}

// ============================================
// CONSTANTS
// ============================================

export const SKILL_SUBTYPES: { id: SkillSubtype; label: string; icon: string }[] = [
  { id: 'strength', label: 'Strength', icon: '💪' },
  { id: 'weakness', label: 'Weakness', icon: '📉' },
  { id: 'mistake', label: 'Common Mistake', icon: '❌' },
  { id: 'practice', label: 'To Practice', icon: '📝' },
];

export const SKILL_ELEMENT_TYPES: { id: SkillElementType; label: string }[] = [
  { id: 'grammar', label: 'Grammar' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'speaking', label: 'Speaking' },
  { id: 'writing', label: 'Writing' },
  { id: 'reading', label: 'Reading' },
  { id: 'listening', label: 'Listening' },
  { id: 'pronunciation', label: 'Pronunciation' },
];

export const PERSONAL_SUBCATEGORIES: { id: PersonalSubCategory; label: string; icon: string }[] = [
  { id: 'personal_info', label: 'Personal Info', icon: '👤' },
  { id: 'work', label: 'Professional/Work', icon: '💼' },
  { id: 'interests', label: 'Interests & Hobbies', icon: '🎨' },
  { id: 'travel', label: 'Travel', icon: '✈️' },
  { id: 'relationships', label: 'Relationships', icon: '👥' },
  { id: 'personality', label: 'Personality', icon: '🧠' },
  { id: 'other', label: 'Other', icon: '📋' },
];

export const KNOWLEDGE_CATEGORIES = [
  {
    id: 'Skill Assessment' as KnowledgeCategory,
    label: 'Skill Assessment',
    icon: '🎯',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Strengths, weaknesses, common mistakes, skills to practice'
  },
  {
    id: 'Personal' as KnowledgeCategory,
    label: 'Personal',
    icon: '👤',
    color: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Personal info, work, hobbies, travel, relationships'
  },
  {
    id: 'Goals' as KnowledgeCategory,
    label: 'Goals',
    icon: '🏆',
    color: 'bg-green-100 text-green-800 border-green-300',
    description: 'Learning objectives, short-term and long-term goals'
  },
  {
    id: 'Notes' as KnowledgeCategory,
    label: 'Notes',
    icon: '📋',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    description: 'General notes, observations, miscellaneous'
  },
  {
    id: 'Next Lesson Ideas' as KnowledgeCategory,
    label: 'Next Lesson Ideas',
    icon: '💡',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    description: 'Ideas and topics for upcoming lessons'
  }
] as const;

export const DEFAULT_FILTERS: KnowledgeFilters = {
  category: null,
  tags: [],
  search: '',
  limit: 20,
  offset: 0,
  sortBy: 'newest',
  showOutdated: true
};

export const SORT_OPTIONS = [
  { value: 'newest' as SortOption, label: 'Newest First' },
  { value: 'oldest' as SortOption, label: 'Oldest First' },
  { value: 'category' as SortOption, label: 'By Category' }
] as const;

export const GROUP_OPTIONS = [
  { value: 'none' as GroupOption, label: 'Timeline View' },
  { value: 'category' as GroupOption, label: 'Group by Category' },
  { value: 'date' as GroupOption, label: 'Group by Date' }
] as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

export const getCategoryMetadata = (category: KnowledgeCategory) => {
  return KNOWLEDGE_CATEGORIES.find(cat => cat.id === category);
};

export const normalizeTag = (tag: string): string => {
  return tag.toLowerCase().trim().replace(/\s+/g, '_');
};

export const parseTagsFromInput = (input: string): string[] => {
  if (!input.trim()) return [];
  return Array.from(new Set(
    input
      .split(',')
      .map(tag => normalizeTag(tag))
      .filter(tag => tag.length > 0)
  ));
};

export const formatTagForDisplay = (tag: string): string => {
  return tag
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
};