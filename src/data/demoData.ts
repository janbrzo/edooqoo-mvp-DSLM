
import { getDemoLocale, type DemoLocaleNames } from './demoLocales';
// v6.9.7 — DEMO_WORKSHEET_CONTENT is lazy-imported below to keep ~150 KiB of
// production-grade demo content out of the initial bundle (IP protection +
// LCP). Static import would defeat the manualChunks split in vite.config.ts.

// Helper to generate dates relative to today
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

const dateOnly = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
};

// Student profiles (static structure, names injected from locale)
const STUDENT_PROFILES = [
  {
    id: 'demo-student-1',
    english_level: 'B2',
    main_goal: 'Business English — prepare for presentations and meetings',
    native_language: 'Polish',
    send_overdue_emails: true,
    is_demo_student: false,
  },
  {
    id: 'demo-student-2',
    english_level: 'A2',
    main_goal: 'General English — travel and daily communication',
    native_language: 'Spanish',
    send_overdue_emails: true,
    is_demo_student: false,
  },
  {
    id: 'demo-student-3',
    english_level: 'C1',
    main_goal: 'Academic English — PhD research papers',
    native_language: 'Chinese',
    send_overdue_emails: false,
    is_demo_student: false,
  },
];

// Worksheets per student
const WORKSHEETS = [
  // Student 1 worksheets (B2 Business)
  {
    id: 'demo-ws-1',
    title: 'Business Presentations — Persuasive Language',
    student_id: 'demo-student-1',
    created_at: daysAgo(2),
    form_data: { topic: 'Business Presentations', english_level: 'B2', exercise_types: ['gap-fill', 'matching', 'open-ended'] },
    ai_response: '{"exercises":[{"type":"gap-fill","title":"Complete the presentation phrases","items":[{"text":"I would like to ___ your attention to the key findings.","answer":"draw"},{"text":"Let me ___ by summarizing the main points.","answer":"conclude"},{"text":"The data clearly ___ that our strategy is working.","answer":"shows"}]},{"type":"matching","title":"Match formal and informal equivalents","items":[{"left":"I would like to propose","right":"How about we try"},{"left":"It is essential that","right":"We really need to"},{"left":"I appreciate your input","right":"Thanks for sharing"}]}]}',
    html_content: '<div class="worksheet"><h1>Business Presentations</h1></div>',
    generation_time_seconds: 12,
    share_token: null,
  },
  {
    id: 'demo-ws-2',
    title: 'Email Writing — Professional Correspondence',
    student_id: 'demo-student-1',
    created_at: daysAgo(5),
    form_data: { topic: 'Professional Emails', english_level: 'B2', exercise_types: ['rewriting', 'gap-fill', 'categorization'] },
    ai_response: '{"exercises":[{"type":"gap-fill","title":"Complete the email phrases","items":[{"text":"I am writing to ___ about the upcoming meeting.","answer":"inquire"},{"text":"Please find ___ the requested documents.","answer":"attached"}]}]}',
    html_content: '<div class="worksheet"><h1>Email Writing</h1></div>',
    generation_time_seconds: 10,
    share_token: 'demo-share-1',
  },
  {
    id: 'demo-ws-3',
    title: 'Meeting Vocabulary — Chairing and Contributing',
    student_id: 'demo-student-1',
    created_at: daysAgo(9),
    form_data: { topic: 'Meeting Skills', english_level: 'B2', exercise_types: ['matching', 'gap-fill'] },
    ai_response: '{"exercises":[{"type":"matching","title":"Match meeting phrases to functions","items":[{"left":"Shall we move on to the next point?","right":"Transitioning"},{"left":"Could you elaborate on that?","right":"Requesting clarification"}]}]}',
    html_content: '<div class="worksheet"><h1>Meeting Vocabulary</h1></div>',
    generation_time_seconds: 8,
    share_token: null,
  },
  {
    id: 'demo-ws-4',
    title: 'Negotiation Strategies — Conditionals in Action',
    student_id: 'demo-student-1',
    created_at: daysAgo(14),
    form_data: { topic: 'Negotiation Language', english_level: 'B2', exercise_types: ['gap-fill', 'sentence-transformation'] },
    ai_response: '{"exercises":[{"type":"gap-fill","title":"Conditional negotiations","items":[{"text":"If you ___ the price by 10%, we would sign today.","answer":"reduced"}]}]}',
    html_content: '<div class="worksheet"><h1>Negotiation Strategies</h1></div>',
    generation_time_seconds: 11,
    share_token: null,
  },
  {
    id: 'demo-ws-5',
    title: 'Phrasal Verbs in Business Context',
    student_id: 'demo-student-1',
    created_at: daysAgo(20),
    form_data: { topic: 'Phrasal Verbs Business', english_level: 'B2', exercise_types: ['gap-fill', 'matching', 'multiple-choice'] },
    ai_response: '{"exercises":[{"type":"gap-fill","title":"Business phrasal verbs","items":[{"text":"We need to ___ up with a solution quickly.","answer":"come"}]}]}',
    html_content: '<div class="worksheet"><h1>Phrasal Verbs</h1></div>',
    generation_time_seconds: 9,
    share_token: null,
  },
  // Student 2 worksheets (A2 General)
  {
    id: 'demo-ws-6',
    title: 'At the Airport — Travel Vocabulary',
    student_id: 'demo-student-2',
    created_at: daysAgo(3),
    form_data: { topic: 'Airport Travel', english_level: 'A2', exercise_types: ['gap-fill', 'matching'] },
    ai_response: '{"exercises":[{"type":"gap-fill","title":"Airport vocabulary","items":[{"text":"Please show your boarding ___ at the gate.","answer":"pass"},{"text":"You can check in your ___ at the counter.","answer":"luggage"}]}]}',
    html_content: '<div class="worksheet"><h1>At the Airport</h1></div>',
    generation_time_seconds: 7,
    share_token: null,
  },
  {
    id: 'demo-ws-7',
    title: 'Ordering Food — Restaurant English',
    student_id: 'demo-student-2',
    created_at: daysAgo(8),
    form_data: { topic: 'Restaurant English', english_level: 'A2', exercise_types: ['gap-fill', 'dialogue-completion'] },
    ai_response: '{"exercises":[{"type":"gap-fill","title":"At the restaurant","items":[{"text":"Could I have the ___, please?","answer":"menu"},{"text":"I would like to ___ the chicken salad.","answer":"order"}]}]}',
    html_content: '<div class="worksheet"><h1>Ordering Food</h1></div>',
    generation_time_seconds: 6,
    share_token: null,
  },
  {
    id: 'demo-ws-8',
    title: 'Asking for Directions — City Navigation',
    student_id: 'demo-student-2',
    created_at: daysAgo(15),
    form_data: { topic: 'Asking Directions', english_level: 'A2', exercise_types: ['matching', 'gap-fill'] },
    ai_response: '{"exercises":[{"type":"matching","title":"Directions vocabulary","items":[{"left":"Turn left","right":"Go to the left side"},{"left":"Go straight ahead","right":"Continue forward"}]}]}',
    html_content: '<div class="worksheet"><h1>Asking for Directions</h1></div>',
    generation_time_seconds: 5,
    share_token: null,
  },
  // Student 3 worksheets (C1 Academic)
  {
    id: 'demo-ws-9',
    title: 'Academic Writing — Hedging and Modality',
    student_id: 'demo-student-3',
    created_at: daysAgo(4),
    form_data: { topic: 'Hedging Language', english_level: 'C1', exercise_types: ['gap-fill', 'rewriting', 'categorization'] },
    ai_response: '{"exercises":[{"type":"gap-fill","title":"Hedging expressions","items":[{"text":"The results ___ suggest a correlation between the variables.","answer":"appear to"},{"text":"It ___ be argued that this approach has limitations.","answer":"could"}]}]}',
    html_content: '<div class="worksheet"><h1>Academic Writing</h1></div>',
    generation_time_seconds: 14,
    share_token: null,
  },
  {
    id: 'demo-ws-10',
    title: 'Research Paper Vocabulary — Linking Words',
    student_id: 'demo-student-3',
    created_at: daysAgo(12),
    form_data: { topic: 'Linking Words', english_level: 'C1', exercise_types: ['gap-fill', 'categorization'] },
    ai_response: '{"exercises":[{"type":"gap-fill","title":"Academic linking words","items":[{"text":"___, the study has several limitations.","answer":"Nevertheless"},{"text":"The findings are consistent with ___ research.","answer":"previous"}]}]}',
    html_content: '<div class="worksheet"><h1>Research Paper Vocabulary</h1></div>',
    generation_time_seconds: 13,
    share_token: null,
  },
];

// Homework assignments
const HOMEWORK = [
  {
    id: 'demo-hw-1',
    title: 'Business Presentations — Homework',
    teacher_id: 'demo-teacher',
    student_id: 'demo-student-1',
    source_worksheet_id: 'demo-ws-1',
    share_token: 'demo-hw-token-1',
    selected_exercises: [0, 1],
    created_at: daysAgo(2),
    updated_at: daysAgo(2),
    completed_at: daysAgo(1),
    view_count: 3,
    viewed_at: daysAgo(1),
    deadline: null,
    prompt: null,
    reminder_hours: 24,
  },
  {
    id: 'demo-hw-2',
    title: 'Email Writing Practice',
    teacher_id: 'demo-teacher',
    student_id: 'demo-student-1',
    source_worksheet_id: 'demo-ws-2',
    share_token: 'demo-hw-token-2',
    selected_exercises: [0],
    created_at: daysAgo(5),
    updated_at: daysAgo(3),
    completed_at: null,
    view_count: 1,
    viewed_at: daysAgo(4),
    deadline: daysFromNow(2),
    prompt: 'Focus on formal register',
    reminder_hours: 24,
  },
  {
    id: 'demo-hw-3',
    title: 'Meeting Vocabulary Quiz',
    teacher_id: 'demo-teacher',
    student_id: 'demo-student-1',
    source_worksheet_id: 'demo-ws-3',
    share_token: 'demo-hw-token-3',
    selected_exercises: [0],
    created_at: daysAgo(9),
    updated_at: daysAgo(7),
    completed_at: daysAgo(7),
    view_count: 5,
    viewed_at: daysAgo(7),
    deadline: null,
    prompt: null,
    reminder_hours: 24,
  },
  {
    id: 'demo-hw-4',
    title: 'Airport Vocabulary — Homework',
    teacher_id: 'demo-teacher',
    student_id: 'demo-student-2',
    source_worksheet_id: 'demo-ws-6',
    share_token: 'demo-hw-token-4',
    selected_exercises: [0],
    created_at: daysAgo(3),
    updated_at: daysAgo(1),
    completed_at: daysAgo(1),
    view_count: 2,
    viewed_at: daysAgo(1),
    deadline: null,
    prompt: null,
    reminder_hours: 24,
  },
  {
    id: 'demo-hw-5',
    title: 'Hedging Language Practice',
    teacher_id: 'demo-teacher',
    student_id: 'demo-student-3',
    source_worksheet_id: 'demo-ws-9',
    share_token: 'demo-hw-token-5',
    selected_exercises: [0],
    created_at: daysAgo(4),
    updated_at: daysAgo(2),
    completed_at: null,
    view_count: 0,
    viewed_at: null,
    deadline: daysFromNow(5),
    prompt: 'Review hedging in your latest paper draft',
    reminder_hours: 48,
  },
];

// Flashcard sets
const FLASHCARD_SETS = [
  {
    id: 'demo-fc-set-1',
    title: 'Business Presentation Phrases',
    description: 'Key phrases for delivering effective presentations',
    teacher_id: 'demo-teacher',
    student_id: 'demo-student-1',
    is_bidirectional: true,
    back_type: 'translation',
    share_token: 'demo-fc-token-1',
    created_at: daysAgo(2),
    updated_at: daysAgo(1),
    deleted_at: null,
    cards: [
      { id: 'demo-fc-1', front_text: 'draw attention to', back_text: 'zwrócić uwagę na', front_example: 'I would like to draw your attention to the key findings.', cefr_level: 'B2' },
      { id: 'demo-fc-2', front_text: 'in conclusion', back_text: 'podsumowując', front_example: 'In conclusion, our Q3 results exceeded expectations.', cefr_level: 'B2' },
      { id: 'demo-fc-3', front_text: 'to outline', back_text: 'przedstawić zarys', front_example: "Let me outline today's agenda.", cefr_level: 'B2' },
      { id: 'demo-fc-4', front_text: 'to elaborate on', back_text: 'rozwinąć temat', front_example: 'Could you elaborate on that point?', cefr_level: 'B2' },
      { id: 'demo-fc-5', front_text: 'stakeholder', back_text: 'interesariusz', front_example: 'All stakeholders have been informed.', cefr_level: 'B2' },
    ],
  },
  {
    id: 'demo-fc-set-2',
    title: 'Email Formal Phrases',
    description: 'Professional email writing vocabulary',
    teacher_id: 'demo-teacher',
    student_id: 'demo-student-1',
    is_bidirectional: true,
    back_type: 'definition',
    share_token: 'demo-fc-token-2',
    created_at: daysAgo(5),
    updated_at: daysAgo(3),
    deleted_at: null,
    cards: [
      { id: 'demo-fc-6', front_text: 'I am writing to inquire', back_text: 'A formal way to start an email asking for information', front_example: 'I am writing to inquire about the status of my application.', cefr_level: 'B2' },
      { id: 'demo-fc-7', front_text: 'Please find attached', back_text: 'A formal phrase used to refer to a file sent with the email', front_example: 'Please find attached the quarterly report.', cefr_level: 'B1' },
      { id: 'demo-fc-8', front_text: 'at your earliest convenience', back_text: 'A polite way of saying "as soon as possible"', front_example: 'Could you reply at your earliest convenience?', cefr_level: 'B2' },
    ],
  },
  {
    id: 'demo-fc-set-3',
    title: 'Travel Vocabulary — Airport',
    description: 'Essential airport and travel words',
    teacher_id: 'demo-teacher',
    student_id: 'demo-student-2',
    is_bidirectional: true,
    back_type: 'translation',
    share_token: 'demo-fc-token-3',
    created_at: daysAgo(3),
    updated_at: daysAgo(2),
    deleted_at: null,
    cards: [
      { id: 'demo-fc-9', front_text: 'boarding pass', back_text: 'tarjeta de embarque', front_example: 'Please show your boarding pass at the gate.', cefr_level: 'A2' },
      { id: 'demo-fc-10', front_text: 'luggage', back_text: 'equipaje', front_example: 'You can check in your luggage at the counter.', cefr_level: 'A2' },
      { id: 'demo-fc-11', front_text: 'departure gate', back_text: 'puerta de embarque', front_example: 'Your departure gate is B12.', cefr_level: 'A2' },
      { id: 'demo-fc-12', front_text: 'customs', back_text: 'aduana', front_example: 'You must go through customs after landing.', cefr_level: 'A2' },
    ],
  },
];

// Calendar slots (2 weeks)
const generateCalendarSlots = () => {
  const slots: any[] = [];
  const statuses = ['available', 'booked', 'completed', 'cancelled'];
  const studentIds = ['demo-student-1', 'demo-student-2', 'demo-student-3', null];

  for (let day = -7; day <= 7; day++) {
    // Skip weekends
    const d = new Date();
    d.setDate(d.getDate() + day);
    if (d.getDay() === 0 || d.getDay() === 6) continue;

    const slotDate = dateOnly(day);
    const times = [
      { start: '09:00', end: '10:00' },
      { start: '10:30', end: '11:30' },
      { start: '14:00', end: '15:00' },
      { start: '16:00', end: '17:00' },
    ];

    times.forEach((time, idx) => {
      const slotIdx = (day + 7) * 4 + idx;
      let status: string;
      let studentId: string | null = null;

      if (day < 0) {
        // Past: mostly completed
        status = idx === 3 ? 'cancelled' : 'completed';
        studentId = studentIds[idx % 3] || 'demo-student-1';
      } else if (day === 0) {
        // Today: mix
        status = idx === 0 ? 'booked' : idx === 1 ? 'available' : 'booked';
        studentId = status === 'booked' ? (studentIds[idx % 3] || 'demo-student-1') : null;
      } else {
        // Future: mix of available and booked
        status = idx % 3 === 0 ? 'available' : 'booked';
        studentId = status === 'booked' ? (studentIds[idx % 3] || 'demo-student-1') : null;
      }

      slots.push({
        id: `demo-slot-${slotIdx}`,
        teacher_id: 'demo-teacher',
        student_id: studentId,
        slot_date: slotDate,
        start_time: time.start,
        end_time: time.end,
        status,
        booking_type: 'manual',
        slot_type: 'slot',
        is_paid: status === 'completed',
        notes: status === 'completed' ? 'Good progress today' : null,
        created_at: daysAgo(14),
        updated_at: daysAgo(Math.max(0, -day)),
      });
    });
  }

  return slots;
};

// Student knowledge entries
const KNOWLEDGE_ENTRIES = [
  // Student 1
  { id: 'demo-know-1', student_id: 'demo-student-1', teacher_id: 'demo-teacher', category: 'Personal', content: 'Works as a marketing manager at a tech startup. Needs English for international client meetings and quarterly presentations.', entry_source: 'manual', tags: ['Work'], created_at: daysAgo(30) },
  { id: 'demo-know-2', student_id: 'demo-student-1', teacher_id: 'demo-teacher', category: 'Personal', content: 'Enjoys hiking and photography. Traveled to Scotland last summer. Interested in British culture.', entry_source: 'manual', tags: ['Hobbies', 'Travel'], created_at: daysAgo(28) },
  { id: 'demo-know-3', student_id: 'demo-student-1', teacher_id: 'demo-teacher', category: 'Goals', content: 'Wants to achieve C1 level within 6 months. Immediate goal: deliver a 15-minute presentation at the European Marketing Summit in September.', entry_source: 'manual', tags: [], created_at: daysAgo(25) },
  { id: 'demo-know-4', student_id: 'demo-student-1', teacher_id: 'demo-teacher', category: 'Skill Assessment', content: 'Strong reading comprehension. Writing needs work — especially formal register. Speaking is fluent but lacks precision in business idioms. Grammar: conditionals and reported speech need review.', entry_source: 'manual', tags: ['Writing', 'Speaking', 'Grammar'], created_at: daysAgo(20), metadata: { mastery: 65, skills: ['conditionals', 'reported-speech', 'formal-register'] } },
  { id: 'demo-know-5', student_id: 'demo-student-1', teacher_id: 'demo-teacher', category: 'Notes', content: 'Responds well to role-play exercises. Prefers correction after speaking, not during.', entry_source: 'manual', tags: [], created_at: daysAgo(15) },
  { id: 'demo-know-6', student_id: 'demo-student-1', teacher_id: 'demo-teacher', category: 'Next Lesson Ideas', content: 'Practice handling difficult questions during Q&A sessions. Use TED Talk as model.', entry_source: 'manual', tags: [], created_at: daysAgo(3) },

  // Student 2
  { id: 'demo-know-7', student_id: 'demo-student-2', teacher_id: 'demo-teacher', category: 'Personal', content: 'University student, 22 years old. Planning a backpacking trip across Southeast Asia. Loves cooking and watching Netflix series in English.', entry_source: 'manual', tags: ['Travel', 'Hobbies'], created_at: daysAgo(20) },
  { id: 'demo-know-8', student_id: 'demo-student-2', teacher_id: 'demo-teacher', category: 'Goals', content: 'Reach B1 before the trip in August. Focus: survival English — airports, hotels, restaurants, asking for help.', entry_source: 'manual', tags: [], created_at: daysAgo(18) },
  { id: 'demo-know-9', student_id: 'demo-student-2', teacher_id: 'demo-teacher', category: 'Skill Assessment', content: 'Basic grammar is solid. Vocabulary limited to everyday topics. Listening comprehension: struggles with native speaker speed. Pronunciation: good intonation, needs work on /θ/ and /ð/.', entry_source: 'manual', tags: ['Vocabulary', 'Listening', 'Pronunciation'], created_at: daysAgo(15), metadata: { mastery: 35, skills: ['basic-grammar', 'travel-vocabulary', 'pronunciation'] } },

  // Student 3
  { id: 'demo-know-10', student_id: 'demo-student-3', teacher_id: 'demo-teacher', category: 'Personal', content: 'PhD candidate in Environmental Science. Needs to publish in English-language journals. Native Mandarin speaker with strong IELTS score (7.5).', entry_source: 'manual', tags: ['Work', 'Academic'], created_at: daysAgo(25) },
  { id: 'demo-know-11', student_id: 'demo-student-3', teacher_id: 'demo-teacher', category: 'Goals', content: 'Submit first paper to Nature Sustainability. Improve academic hedging and argumentation. Prepare for viva voce (oral defense).', entry_source: 'manual', tags: [], created_at: daysAgo(22) },
  { id: 'demo-know-12', student_id: 'demo-student-3', teacher_id: 'demo-teacher', category: 'Skill Assessment', content: 'Excellent grammar and vocabulary range. Academic writing style sometimes too direct — needs more hedging. Speaking: occasionally over-relies on memorized phrases. Needs to develop spontaneous argumentation skills.', entry_source: 'manual', tags: ['Academic Writing', 'Hedging', 'Speaking'], created_at: daysAgo(18), metadata: { mastery: 82, skills: ['academic-writing', 'hedging', 'argumentation'] } },
];

// Teacher profile
const TEACHER_PROFILE = {
  id: 'demo-teacher',
  available_tokens: 15,
  is_tokens_frozen: false,
  subscription_type: 'professional',
  subscription_status: 'active',
  subscription_expires_at: daysFromNow(180),
  monthly_worksheet_limit: 50,
  monthly_worksheets_used: 12,
  total_worksheets_created: 47,
  total_tokens_consumed: 35,
  total_tokens_received: 50,
  rollover_tokens: 0,
  onboarding_progress: { completed: true, dismissed: true, steps: { add_student: true, generate_worksheet: true, share_worksheet: true, create_homework: true } },
  teaching_preferences: {},
  created_at: daysAgo(90),
  updated_at: daysAgo(1),
  deleted_at: null,
};

export interface DemoDataSet {
  teacher: typeof TEACHER_PROFILE & { first_name: string; last_name: string; email: string };
  students: any[];
  worksheets: any[];
  homework: any[];
  flashcardSets: any[];
  calendarSlots: any[];
  knowledgeEntries: any[];
}

export async function buildDemoData(countryCode: string): Promise<DemoDataSet> {
  const locale = getDemoLocale(countryCode);
  // Lazy chunk: only fetched when demo mode is actually entered.
  const { DEMO_WORKSHEET_CONTENT } = await import('./demoWorksheetContent');

  const teacher = {
    ...TEACHER_PROFILE,
    first_name: locale.teacherFirstName,
    last_name: locale.teacherLastName,
    email: `${locale.teacherFirstName.toLowerCase()}.${locale.teacherLastName.toLowerCase()}@demo.edooqoo.com`,
  };

  const students = STUDENT_PROFILES.map((s, i) => ({
    ...s,
    name: `${locale.students[i].firstName} ${locale.students[i].lastName}`,
    student_email: locale.students[i].email,
    teacher_id: 'demo-teacher',
    teacher_email: teacher.email,
    created_at: daysAgo(30 - i * 5),
    updated_at: daysAgo(i + 1),
    deleted_at: null,
  }));

  // Map student names to worksheets, overlaying full production content when available
  const worksheets = WORKSHEETS.map((ws) => {
    const overlay = DEMO_WORKSHEET_CONTENT[ws.id];
    return {
      ...ws,
      ...(overlay || {}),
      id: ws.id,
      student_id: ws.student_id,
      created_at: ws.created_at,
      share_token: ws.share_token,
      teacher_id: 'demo-teacher',
    };
  });

  const homework = HOMEWORK.map((hw) => ({ ...hw }));

  const flashcardSets = FLASHCARD_SETS.map((fs) => ({ ...fs }));

  const calendarSlots = generateCalendarSlots().map((slot) => {
    // Assign student names for display
    if (slot.student_id) {
      const studentIdx = STUDENT_PROFILES.findIndex((s) => s.id === slot.student_id);
      if (studentIdx >= 0) {
        slot.title = `Lesson — ${locale.students[studentIdx].firstName} ${locale.students[studentIdx].lastName}`;
      }
    }
    return slot;
  });

  const knowledgeEntries = KNOWLEDGE_ENTRIES.map((ke) => ({
    ...ke,
    updated_at: ke.created_at,
    deleted_at: null,
    is_outdated: false,
    outdated_at: null,
    outdated_reason: null,
  }));

  return {
    teacher,
    students,
    worksheets,
    homework,
    flashcardSets,
    calendarSlots,
    knowledgeEntries,
  };
}
