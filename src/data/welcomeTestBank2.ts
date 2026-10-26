/**
 * Welcome Test bank 2: 14 new keyed questions (ids wt_q59..wt_q72) and their
 * Form B variants for retakes. They are appended after the 58 questions of bank 1
 * (so question_index 58..71) and shown inside their sections; the display order
 * and the adaptive blocks live in lib/welcomeTest/flow.ts.
 *
 * Every Form B variant keeps the id, section, skill (nano_skill), CEFR level and
 * type of its Form A item and changes only the content, so a retake measures
 * progress and not memory of the items.
 */
import type { WelcomeTestQuestionDef } from '@/types/welcomeTest';

const FILL_INSTRUCTION = 'Write the correct word.';

// Audio is generated with generate-welcome-test-audio (see mem/features/welcome-test).
export const BANK2_NEW_QUESTIONS: WelcomeTestQuestionDef[] = [
  // ---- Grammar A1 ----
  {
    id: 'wt_q59', section: 'grammar', question_type: 'fill_blank',
    question_text: 'My brother ___ a doctor.',
    description: FILL_INSTRUCTION,
    correct_answer: 'is',
    element_type: 'grammar', difficulty_level: 1, cefr: 'A1',
    scoring_logic: 'To be, present simple, third person. A1 level grammar.',
    nano_skill: 'ns.grammar.to_be_present_simple',
  },
  {
    id: 'wt_q60', section: 'grammar', question_type: 'multiple_choice',
    question_text: '___ you like coffee?',
    options: ['Do', 'Does', 'Are', 'Is'],
    correct_answer: 'Do',
    element_type: 'grammar', difficulty_level: 1, cefr: 'A1',
    scoring_logic: 'Present simple questions with do/does. A1 level grammar.',
    nano_skill: 'ns.grammar.present_simple_questions',
  },
  // ---- Grammar C1 ----
  {
    id: 'wt_q61', section: 'grammar', question_type: 'multiple_choice',
    question_text: 'Rarely ___ such a well-organised presentation.',
    options: ['have I seen', 'I have seen', 'did I saw', 'I saw'],
    correct_answer: 'have I seen',
    element_type: 'grammar', difficulty_level: 4, cefr: 'C1',
    scoring_logic: 'Inversion after negative adverbials. C1 level grammar.',
    nano_skill: 'ns.grammar.inversion_negative_adverbials',
  },
  {
    id: 'wt_q62', section: 'grammar', question_type: 'multiple_choice',
    question_text: 'If the board ___ the merger last year, we would not be facing these losses now.',
    options: ['had not approved', 'did not approve', 'would not approve', 'has not approved'],
    correct_answer: 'had not approved',
    element_type: 'grammar', difficulty_level: 4, cefr: 'C1',
    scoring_logic: 'Mixed conditionals (past condition, present result). C1 level grammar.',
    nano_skill: 'ns.grammar.mixed_conditionals',
  },
  // ---- Vocabulary A1 ----
  {
    id: 'wt_q63', section: 'vocabulary', question_type: 'multiple_choice',
    question_text: 'What do you wear on your feet?',
    options: ['shoes', 'gloves', 'a hat', 'a scarf'],
    correct_answer: 'shoes',
    element_type: 'vocabulary', difficulty_level: 1, cefr: 'A1',
    scoring_logic: 'Everyday words: clothes. A1 level vocabulary.',
    nano_skill: 'ns.vocabulary.everyday_clothes',
  },
  {
    id: 'wt_q64', section: 'vocabulary', question_type: 'multiple_choice',
    question_text: 'Monday, Tuesday, ___',
    options: ['Wednesday', 'January', 'summer', 'morning'],
    correct_answer: 'Wednesday',
    element_type: 'vocabulary', difficulty_level: 1, cefr: 'A1',
    scoring_logic: 'Days of the week and months. A1 level vocabulary.',
    nano_skill: 'ns.vocabulary.days_months',
  },
  // ---- Vocabulary A2 ----
  {
    id: 'wt_q65', section: 'vocabulary', question_type: 'multiple_choice',
    question_text: 'I\'m tired. I need to ___ a break.',
    options: ['take', 'make', 'do', 'get'],
    correct_answer: 'take',
    element_type: 'vocabulary', difficulty_level: 1, cefr: 'A2',
    scoring_logic: 'Collocation: take/make. A2 level vocabulary.',
    nano_skill: 'ns.vocabulary.collocation_take_make',
  },
  // ---- Vocabulary C1 ----
  {
    id: 'wt_q66', section: 'vocabulary', question_type: 'multiple_choice',
    question_text: 'The CEO\'s remarks were deliberately ___, so nobody could tell what she really thought.',
    options: ['equivocal', 'candid', 'explicit', 'emphatic'],
    correct_answer: 'equivocal',
    element_type: 'vocabulary', difficulty_level: 4, cefr: 'C1',
    scoring_logic: 'Advanced adjectives: meaning in context. C1 level vocabulary.',
    nano_skill: 'ns.vocabulary.advanced_adjectives',
  },
  {
    id: 'wt_q67', section: 'vocabulary', question_type: 'multiple_choice',
    question_text: 'Her ___ attention to detail meant that not a single error escaped her.',
    options: ['meticulous', 'mediocre', 'modest', 'mutual'],
    correct_answer: 'meticulous',
    element_type: 'vocabulary', difficulty_level: 4, cefr: 'C1',
    scoring_logic: 'Advanced adjectives: character. C1 level vocabulary.',
    nano_skill: 'ns.vocabulary.advanced_adjectives_character',
  },
  // ---- Reading A2 / B1 / C1 (section: Reading & Listening) ----
  {
    id: 'wt_q68', section: 'receptive', question_type: 'multiple_choice',
    question_text: 'Read the notice and answer the question below.\n\n"The office will be closed on Friday 12 May because of building work. Please send urgent emails to the support team. The office will open again on Monday at 9:00."\n\nWhen will the office open again?',
    options: ['Friday 12 May', 'Monday at 9:00', 'Saturday morning', 'Tuesday at 9:00'],
    correct_answer: 'Monday at 9:00',
    element_type: 'reading', difficulty_level: 1, cefr: 'A2',
    scoring_logic: 'Reading: finding specific information. A2 level.',
    nano_skill: 'ns.reading.find_specific_information',
  },
  {
    id: 'wt_q69', section: 'receptive', question_type: 'multiple_choice',
    question_text: 'Read the email and answer the question below.\n\n"Hi Marta, I\'m afraid I can\'t make Thursday\'s meeting because my train was cancelled and the next one only arrives at 3 pm. Could we move it to Friday morning? If that is not possible, I can join online for the first half hour and Piotr can take notes for me afterwards. Let me know what works best. Thanks, Jan"\n\nWhat does Jan offer to do if the meeting cannot move to Friday?',
    options: ['Join online for the first half hour', 'Send Piotr in his place', 'Travel by car', 'Cancel the meeting'],
    correct_answer: 'Join online for the first half hour',
    element_type: 'reading', difficulty_level: 2, cefr: 'B1',
    scoring_logic: 'Reading: understanding requests and offers in an email. B1 level.',
    nano_skill: 'ns.reading.understand_email_requests',
  },
  {
    id: 'wt_q70', section: 'receptive', question_type: 'multiple_choice',
    question_text: 'Read the text and answer the question below.\n\n"Although remote work is often praised for its flexibility, several studies suggest that its benefits are unevenly distributed. Employees with a dedicated home office report higher focus, whereas those in shared accommodation describe more interruptions and blurred boundaries between work and rest. Consequently, some employers who introduced blanket remote-work policies have since quietly reintroduced office days, not because productivity fell, but because they underestimated how unequally their staff could benefit."\n\nWhy did some employers reintroduce office days?',
    options: [
      'Productivity fell significantly',
      'Employees asked for stricter supervision',
      'They realised the policy did not suit all employees equally',
      'The cost of home offices was too high',
    ],
    correct_answer: 'They realised the policy did not suit all employees equally',
    element_type: 'reading', difficulty_level: 4, cefr: 'C1',
    scoring_logic: 'Reading: inference from a connected argument. C1 level.',
    nano_skill: 'ns.reading.inference',
  },
  // ---- Listening A2 / B2 ----
  {
    id: 'wt_q71', section: 'receptive', question_type: 'listening_comprehension',
    question_text: 'Listen to the conversation and answer: what time does the next bus to the airport leave?',
    audio_url: 'https://pub-1b974ada9ae240948229c52d927980ee.r2.dev/audio/welcome-test-listening-1793037331618.mp3',
    audio_transcript: 'A: "Excuse me, what time does the next bus to the airport leave?"\nB: "The next one leaves at ten past four, from stop number three."\nA: "Ten past four... and how long does it take?"\nB: "About forty minutes."',
    options: ['4:10', '4:15', '4:40', '3:10'],
    correct_answer: '4:10',
    element_type: 'listening', difficulty_level: 1, cefr: 'A2',
    scoring_logic: 'Listening: detail extraction (a time). A2 level.',
    nano_skill: 'ns.listening.detail_extraction',
  },
  {
    id: 'wt_q72', section: 'receptive', question_type: 'listening_comprehension',
    question_text: 'Listen to the conversation and answer: why is the man hesitating?',
    audio_url: 'https://pub-1b974ada9ae240948229c52d927980ee.r2.dev/audio/welcome-test-listening-1793037340290.mp3',
    audio_transcript: 'A: "So, have you decided whether to take the job in Lisbon?"\nB: "Honestly, I keep going back and forth. The salary is nearly thirty percent higher, but I\'d have to leave my team just when we\'re launching the new product."\nA: "And what about the relocation package?"\nB: "They\'d cover the move and three months of rent, which helps. But my manager has hinted that a promotion might come up here next spring, so I\'d be walking away from that."\nA: "Sounds like you\'re not really ready to leave."\nB: "Maybe. I\'ll tell them on Monday either way."',
    options: [
      'The salary in Lisbon is lower than he expected',
      'He would miss a product launch and a possible promotion',
      'The relocation package does not include rent',
      'His manager asked him to decide immediately',
    ],
    correct_answer: 'He would miss a product launch and a possible promotion',
    element_type: 'listening', difficulty_level: 3, cefr: 'B2',
    scoring_logic: 'Listening: understanding reasons across a conversation. B2 level.',
    nano_skill: 'ns.listening.reasons_and_attitude',
  },
];

/** Form B: same id, section, skill, level and type as Form A, different content. */
export const BANK2_VARIANTS_B: Record<string, WelcomeTestQuestionDef> = {
  wt_q59: {
    ...BANK2_NEW_QUESTIONS[0],
    question_text: 'Anna and Tom ___ colleagues.',
    correct_answer: 'are',
  },
  wt_q60: {
    ...BANK2_NEW_QUESTIONS[1],
    question_text: '___ your brother live in London?',
    options: ['Do', 'Does', 'Is', 'Are'],
    correct_answer: 'Does',
  },
  wt_q61: {
    ...BANK2_NEW_QUESTIONS[2],
    question_text: 'Not until the contract was signed ___ the risks.',
    options: ['did we realise', 'we realised', 'we did realise', 'realised we'],
    correct_answer: 'did we realise',
  },
  wt_q62: {
    ...BANK2_NEW_QUESTIONS[3],
    question_text: 'If I had taken the earlier flight, I ___ in the meeting right now.',
    options: ['would be', 'would have been', 'had been', 'will be'],
    correct_answer: 'would be',
  },
  wt_q63: {
    ...BANK2_NEW_QUESTIONS[4],
    question_text: 'What do you wear on your head?',
    options: ['a hat', 'shoes', 'gloves', 'socks'],
    correct_answer: 'a hat',
  },
  wt_q64: {
    ...BANK2_NEW_QUESTIONS[5],
    question_text: 'January, February, ___',
    options: ['March', 'Monday', 'winter', 'evening'],
    correct_answer: 'March',
  },
  wt_q65: {
    ...BANK2_NEW_QUESTIONS[6],
    question_text: 'I need to ___ an appointment with the dentist.',
    options: ['make', 'take', 'do', 'put'],
    correct_answer: 'make',
  },
  wt_q66: {
    ...BANK2_NEW_QUESTIONS[7],
    question_text: 'The scandal had a ___ effect on the firm\'s reputation, causing long-term harm.',
    options: ['detrimental', 'negligible', 'marginal', 'ephemeral'],
    correct_answer: 'detrimental',
  },
  wt_q67: {
    ...BANK2_NEW_QUESTIONS[8],
    question_text: 'He is ___ about his plans, giving away as few details as possible.',
    options: ['reticent', 'reluctant', 'resilient', 'relevant'],
    correct_answer: 'reticent',
  },
  wt_q68: {
    ...BANK2_NEW_QUESTIONS[9],
    question_text: 'Read the hotel note and answer the question below.\n\n"Breakfast is served from 7:00 to 10:00 in the restaurant on the ground floor. Guests who want an early breakfast at 6:00 can order a breakfast box at reception the evening before."\n\nWhat should a guest do to have breakfast at 6:00?',
    options: [
      'Go to the restaurant at 6:00',
      'Order a breakfast box the evening before',
      'Ask the receptionist in the morning',
      'Come back at 7:00',
    ],
    correct_answer: 'Order a breakfast box the evening before',
  },
  wt_q69: {
    ...BANK2_NEW_QUESTIONS[10],
    question_text: 'Read the email and answer the question below.\n\n"Hi Anna, thanks for the invitation, but I won\'t be able to attend the workshop on Tuesday because I have a client visit. I\'d really like to see the materials, though. Could you send me the slides, and maybe we could have a short call on Wednesday to go through them? Best, Tom"\n\nWhat does Tom ask Anna to do?',
    options: [
      'Move the workshop to Wednesday',
      'Send him the slides and arrange a call',
      'Invite his client',
      'Cancel the workshop',
    ],
    correct_answer: 'Send him the slides and arrange a call',
  },
  wt_q70: {
    ...BANK2_NEW_QUESTIONS[11],
    question_text: 'Read the text and answer the question below.\n\n"Proponents of automatic enrolment in pension schemes argue that people rarely change defaults, so employers can protect workers simply by choosing sensible ones. Critics counter that this nudges people into decisions they might not otherwise make, and that contribution rates set by default often become a ceiling rather than a starting point. Evidence from several countries suggests that, while participation rises sharply, average savings per person grow far more modestly."\n\nWhat does the evidence mentioned in the text suggest?',
    options: [
      'Participation and savings rise by the same amount',
      'Automatic enrolment raises participation more than it raises savings',
      'People quickly change their default contribution rates',
      'The critics\' concerns are unfounded',
    ],
    correct_answer: 'Automatic enrolment raises participation more than it raises savings',
  },
  wt_q71: {
    ...BANK2_NEW_QUESTIONS[12],
    question_text: 'Listen to the conversation and answer: what kind of room does the customer book?',
    audio_url: 'https://pub-1b974ada9ae240948229c52d927980ee.r2.dev/audio/welcome-test-listening-1793037335224.mp3',
    audio_transcript: 'A: "Hi, I\'d like to book a room for two nights, from Friday."\nB: "Certainly. A single or a double room?"\nA: "A double, please. And is breakfast included?"\nB: "Yes, it is, from seven o\'clock."',
    options: [
      'A single room for two nights',
      'A double room for two nights',
      'A double room for one night',
      'A single room for one night',
    ],
    correct_answer: 'A double room for two nights',
  },
  wt_q72: {
    ...BANK2_NEW_QUESTIONS[13],
    question_text: 'Listen to the conversation and answer: what compromise does the man support?',
    audio_url: 'https://pub-1b974ada9ae240948229c52d927980ee.r2.dev/audio/welcome-test-listening-1793037346592.mp3',
    audio_transcript: 'A: "Did you read the proposal for the new office layout?"\nB: "I skimmed it. Open plan again, apparently, which I\'m not thrilled about."\nA: "The architect says it increases collaboration by about a fifth."\nB: "Perhaps, but on the pilot floor people started wearing headphones all day, so I\'m not convinced it\'s actually collaboration."\nA: "Fair point. Maybe we should ask for quiet zones."\nB: "Yes, that\'s the compromise I\'d support."',
    options: [
      'Keeping the old layout completely',
      'Including quiet areas in the open-plan office',
      'Asking the architect for a new study',
      'Giving everyone headphones',
    ],
    correct_answer: 'Including quiet areas in the open-plan office',
  },
};
