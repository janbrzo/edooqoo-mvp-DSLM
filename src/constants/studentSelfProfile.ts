/**
 * Student Self-Profile (v5.2) — 10 categories filled by the student in /my hub.
 * Each maps to one student_knowledge_entries row (category='Self-Profile',
 * metadata.field=<id>). All fields chosen for direct use in worksheet generation
 * context — no vanity fields.
 */
export type SelfProfileFieldType = 'text' | 'textarea' | 'single' | 'multi' | 'slider';

export interface SelfProfileFieldDef {
  id: string;
  label: string;
  helper: string;
  type: SelfProfileFieldType;
  options?: { value: string; label: string }[];
  maxLength?: number;
  maxSelect?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  allowFreeText?: boolean;
}

export const SELF_PROFILE_FIELDS: SelfProfileFieldDef[] = [
  {
    id: 'profession_role',
    label: 'Your profession or role',
    helper: 'e.g. "Software engineer at a fintech startup"',
    type: 'text',
    maxLength: 200,
  },
  {
    id: 'industry_sector',
    label: 'Industry or sector',
    helper: 'Used to tailor vocabulary topics in worksheets.',
    type: 'single',
    options: [
      { value: 'IT', label: 'IT / Software' },
      { value: 'Finance', label: 'Finance / Banking' },
      { value: 'Medical', label: 'Medical / Healthcare' },
      { value: 'Legal', label: 'Legal' },
      { value: 'Marketing', label: 'Marketing' },
      { value: 'Sales', label: 'Sales' },
      { value: 'Education', label: 'Education' },
      { value: 'HR', label: 'HR / People' },
      { value: 'Engineering', label: 'Engineering' },
      { value: 'Logistics', label: 'Logistics / Operations' },
      { value: 'Hospitality', label: 'Hospitality / Tourism' },
      { value: 'Other', label: 'Other' },
    ],
  },
  {
    id: 'daily_responsibilities',
    label: 'Your typical daily responsibilities',
    helper: 'A short paragraph helps generate realistic reading and roleplay scenarios.',
    type: 'textarea',
    maxLength: 500,
  },
  {
    id: 'english_use_contexts',
    label: 'When do you use English?',
    helper: 'Pick all that apply — drives skill emphasis.',
    type: 'multi',
    options: [
      { value: 'Meetings', label: 'Meetings' },
      { value: 'Emails', label: 'Emails' },
      { value: 'Presentations', label: 'Presentations' },
      { value: 'Phone calls', label: 'Phone calls' },
      { value: 'Customer support', label: 'Customer support' },
      { value: 'Reports', label: 'Reports / Documents' },
      { value: 'Networking', label: 'Networking / Small talk' },
      { value: 'Travel', label: 'Travel' },
    ],
  },
  {
    id: 'learning_obstacles',
    label: 'What gets in the way of your learning?',
    helper: 'Pick the obstacles that hit you the most.',
    type: 'multi',
    options: [
      { value: 'Time', label: 'Time / busy schedule' },
      { value: 'Confidence', label: 'Confidence speaking' },
      { value: 'Pronunciation', label: 'Pronunciation' },
      { value: 'Grammar', label: 'Grammar accuracy' },
      { value: 'Vocabulary', label: 'Limited vocabulary' },
      { value: 'Listening speed', label: 'Native-speed listening' },
    ],
  },
  {
    id: 'interests_passions',
    label: 'Topics you enjoy',
    helper: 'Pick up to 5. Used to make worksheets feel personal.',
    type: 'multi',
    maxSelect: 5,
    allowFreeText: true,
    options: [
      { value: 'Sports', label: 'Sports' },
      { value: 'Tech', label: 'Tech' },
      { value: 'Travel', label: 'Travel' },
      { value: 'Food', label: 'Food / Cooking' },
      { value: 'Music', label: 'Music' },
      { value: 'Movies', label: 'Movies / TV' },
      { value: 'Books', label: 'Books / Reading' },
      { value: 'Gaming', label: 'Gaming' },
      { value: 'Fitness', label: 'Fitness / Health' },
      { value: 'Other', label: 'Other (free text)' },
    ],
  },
  {
    id: 'learning_style_pref',
    label: 'How do you learn best?',
    helper: 'Helps shape the format of lessons.',
    type: 'single',
    options: [
      { value: 'Visual', label: 'Visual (images, diagrams)' },
      { value: 'Auditory', label: 'Auditory (listening, talking)' },
      { value: 'Kinesthetic', label: 'Kinesthetic (doing, role-play)' },
      { value: 'Reading-Writing', label: 'Reading / Writing' },
    ],
  },
  {
    id: 'motivation_driver',
    label: 'Your main motivation',
    helper: 'Why are you learning English right now?',
    type: 'single',
    options: [
      { value: 'Career growth', label: 'Career growth' },
      { value: 'Specific exam', label: 'Specific exam (IELTS, FCE, CAE…)' },
      { value: 'Travel', label: 'Travel' },
      { value: 'Daily life', label: 'Daily life / family' },
      { value: 'Hobby', label: 'Hobby / fun' },
    ],
  },
  {
    id: 'time_availability_per_week',
    label: 'Hours you can study per week',
    helper: 'Outside of lessons. Calibrates pacing intensity.',
    type: 'slider',
    min: 1,
    max: 15,
    step: 1,
    unit: 'h',
  },
  {
    id: 'cultural_context',
    label: 'Your native language / cultural context',
    helper: 'Helps your teacher anticipate L1 interference patterns.',
    type: 'single',
    allowFreeText: true,
    options: [
      { value: 'Spanish', label: 'Spanish' },
      { value: 'Polish', label: 'Polish' },
      { value: 'Portuguese', label: 'Portuguese' },
      { value: 'French', label: 'French' },
      { value: 'German', label: 'German' },
      { value: 'Italian', label: 'Italian' },
      { value: 'Mandarin', label: 'Mandarin' },
      { value: 'Other', label: 'Other (specify)' },
    ],
  },
];
