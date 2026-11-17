export const GENERATOR_PREVIEW_EXERCISES = [
  { id: 'reading', label: 'Reading Comprehension', category: 'core', description: 'Read a workplace text and respond in full sentences.' },
  { id: 'fill-in-blanks', label: 'Fill in the Blanks', category: 'core', description: 'Complete a meaningful sentence with the missing language.' },
  { id: 'multiple-choice', label: 'Multiple Choice', category: 'core', description: 'Choose the best answer using context, not isolated words.' },
  { id: 'true-false', label: 'True / False', category: 'core', description: 'Check a precise statement against the text.' },
  { id: 'matching', label: 'Matching', category: 'core', description: 'Connect professional terms with their meanings.' },
  { id: 'dialogue', label: 'Dialogue Practice', category: 'core', description: 'Complete a realistic workplace exchange.' },
  { id: 'answer-questions', label: 'Answer Questions', category: 'core', description: 'Answer open questions about a short text.' },
  { id: 'discussion', label: 'Discussion Questions', category: 'core', description: 'Transfer the topic to the learner\'s own work.' },
  { id: 'error-correction', label: 'Error Correction', category: 'core', description: 'Diagnose and repair a realistic language error.' },
  { id: 'odd-one-out', label: 'Odd One Out', category: 'core', description: 'Identify the item that does not belong and explain why.' },
  { id: 'matching-halves', label: 'Matching Halves', category: 'core', description: 'Complete ideas by joining sentence halves.' },
  { id: 'word-order', label: 'Word Order', category: 'core', description: 'Rebuild a professional sentence from scrambled words.' },
  { id: 'gap-text', label: 'Gap Text (Cloze)', category: 'core', description: 'Restore missing language in connected text.' },
  { id: 'negative-prefixes', label: 'Negative Prefixes', category: 'core', description: 'Use a negative prefix in a workplace context.' },
  { id: 'categorize', label: 'Categorization', category: 'core', description: 'Sort useful language by communicative purpose.' },
  { id: 'paraphrasing', label: 'Paraphrasing', category: 'core', description: 'Keep the meaning while changing the wording.' },
  { id: 'complete-word', label: 'Complete the Word', category: 'core', description: 'Recall and spell a word from context.' },
  { id: 'synonyms', label: 'Synonyms Matching', category: 'core', description: 'Choose a precise word with a similar meaning.' },
  { id: 'antonyms', label: 'Antonyms Matching', category: 'core', description: 'Choose a word with the opposite meaning.' },
  { id: 'describe-picture', label: 'Describe Picture', category: 'picture', description: 'Describe a workplace scene in useful detail.' },
  { id: 'answer-questions-picture', label: 'Answer Questions (Picture)', category: 'picture', description: 'Answer open questions about a workplace scene.' },
  { id: 'true-false-picture', label: 'True / False (Picture)', category: 'picture', description: 'Verify a statement against visual evidence.' },
  { id: 'multiple-choice-picture', label: 'Multiple Choice (Picture)', category: 'picture', description: 'Choose the statement that matches the scene.' },
  { id: 'listening-comprehension', label: 'Listening Comprehension', category: 'audio', description: 'Listen for meaning and answer open questions.' },
  { id: 'answer-questions-audio', label: 'Answer Questions (Audio)', category: 'audio', description: 'Respond to detailed questions after listening.' },
  { id: 'true-false-audio', label: 'True / False (Audio)', category: 'audio', description: 'Check a statement against what you hear.' },
  { id: 'multiple-choice-audio', label: 'Multiple Choice (Audio)', category: 'audio', description: 'Select the answer supported by the recording.' },
  { id: 'fill-in-blanks-audio', label: 'Fill in the Blanks (Audio)', category: 'audio', description: 'Complete a transcript while listening.' },
];

export const GENERATOR_PREVIEW_SCENARIOS = [
  {
    id: 'small-talk-before-a-meeting', level: 'A1', topic: 'Small talk before a meeting',
    reading: 'Marta arrives at the office at nine. She works in marketing. Before the meeting, she talks to a new colleague about his first week.',
    gapSentence: '___ name is Marta.', gapAnswer: 'My',
    question: 'What does Marta do?', options: ['She works in marketing.', 'She works in a hospital.', 'She is a driver.'], answer: 'She works in marketing.',
    statement: 'Marta arrives at the office at nine.', statementAnswer: 'True',
    pairs: [['colleague', 'a person you work with'], ['meeting', 'a planned work conversation'], ['marketing', 'the activity of promoting a product']],
    dialogue: ['A: Hi, I am Marta. Nice to meet you.', 'B: Nice to meet you too. I am Daniel.', 'A: How is your first week?'],
    dialogueModel: 'B: It is good, thank you. Everyone is very helpful.',
    questions: ['What is Marta\'s job?', 'Who does she talk to before the meeting?'], questionAnswers: ['She works in marketing.', 'She talks to a new colleague.'],
    discussion: ['What do you usually say when you meet a new colleague?', 'What is a good small-talk topic in your workplace?'],
    error: 'She work in marketing.', correction: 'She works in marketing.',
    oddOptions: ['colleague', 'manager', 'meeting', 'apple'], oddAnswer: 'apple',
    halves: [['I work', 'in marketing.'], ['Nice', 'to meet you.'], ['The meeting starts', 'at ten.']],
    wordOrder: ['marketing', 'Marta', 'in', 'works'], wordOrderAnswer: 'Marta works in marketing.',
    gapText: 'Marta ___ in marketing. She ___ to a new colleague.', gapTextAnswers: ['works', 'talks'],
    prefixBase: 'happy', prefixAnswer: 'unhappy', prefixSentence: 'The new colleague is unhappy with the noisy room.',
    categories: { 'People': ['colleague', 'manager'], 'Work activities': ['meet', 'talk'] },
    paraphrase: 'Marta likes her job.', paraphrasePrompt: 'Use: enjoys', paraphraseAnswer: 'Marta enjoys her job.',
    completeSentence: 'Marta works with a new c_______.', completeAnswer: 'colleague',
    synonymWord: 'big', synonymOptions: ['large', 'late', 'busy'], synonymAnswer: 'large',
    antonymWord: 'early', antonymOptions: ['late', 'new', 'friendly'], antonymAnswer: 'late',
    pictureAlt: 'Two colleagues sitting at a table with laptops before a meeting.', pictureStatement: 'There are two people in the room.', pictureStatementAnswer: 'True',
    pictureQuestion: 'What are the colleagues doing?', pictureOptions: ['They are preparing for a meeting.', 'They are eating in a restaurant.', 'They are driving to work.'], pictureAnswer: 'They are preparing for a meeting.',
    audioTranscript: 'My name is Marta. I arrive at the office at nine. I work in marketing. Before the meeting, I talk to a new colleague about his first week.',
  },
  {
    id: 'arranging-a-client-call', level: 'A2', topic: 'Arranging a client call',
    reading: 'Tomas needs to speak with a client about a new order. He suggests Tuesday at eleven. The client prefers Wednesday afternoon, so Tomas sends a new invitation.',
    gapSentence: 'Can we ___ on Wednesday afternoon?', gapAnswer: 'meet',
    question: 'When does the client prefer to speak?', options: ['Wednesday afternoon.', 'Tuesday at eleven.', 'Monday morning.'], answer: 'Wednesday afternoon.',
    statement: 'Tomas keeps the Tuesday time.', statementAnswer: 'False',
    pairs: [['suggest', 'offer an idea'], ['prefer', 'like one option more'], ['invitation', 'a request to join an event']],
    dialogue: ['A: Are you free on Tuesday at eleven?', 'B: I am afraid I have another call then.', 'A: How about Wednesday afternoon?'],
    dialogueModel: 'B: Wednesday at two works for me. Thank you.',
    questions: ['Why does Tomas contact the client?', 'What does he send after they choose a time?'], questionAnswers: ['He needs to speak about a new order.', 'He sends a new invitation.'],
    discussion: ['Which days and times are usually best for your client calls?', 'What do you write when you need to change a meeting?'],
    error: 'How about to meet on Wednesday?', correction: 'How about meeting on Wednesday?',
    oddOptions: ['Tuesday', 'Wednesday', 'Thursday', 'invoice'], oddAnswer: 'invoice',
    halves: [['Are you free', 'on Tuesday?'], ['Wednesday afternoon', 'works for me.'], ['I will send', 'a new invitation.']],
    wordOrder: ['we', 'Can', 'Wednesday', 'meet', 'on'], wordOrderAnswer: 'Can we meet on Wednesday?',
    gapText: 'Tomas ___ a call for Tuesday. The client ___ Wednesday.', gapTextAnswers: ['suggests', 'prefers'],
    prefixBase: 'available', prefixAnswer: 'unavailable', prefixSentence: 'The client is unavailable on Tuesday.',
    categories: { 'Times': ['Tuesday', 'afternoon'], 'Actions': ['suggest', 'invite'] },
    paraphrase: 'Tomas wants to change the call time.', paraphrasePrompt: 'Use: reschedule', paraphraseAnswer: 'Tomas wants to reschedule the call.',
    completeSentence: 'Tomas sends a calendar i_________.', completeAnswer: 'invitation',
    synonymWord: 'suggest', synonymOptions: ['propose', 'cancel', 'repeat'], synonymAnswer: 'propose',
    antonymWord: 'accept', antonymOptions: ['decline', 'arrange', 'confirm'], antonymAnswer: 'decline',
    pictureAlt: 'Two colleagues at a table checking a calendar on a laptop.', pictureStatement: 'The colleagues are looking at a laptop.', pictureStatementAnswer: 'True',
    pictureQuestion: 'What are the colleagues arranging?', pictureOptions: ['A call or meeting.', 'A holiday flight.', 'A product delivery.'], pictureAnswer: 'A call or meeting.',
    audioTranscript: 'Tomas needs to speak with a client about a new order. He suggests Tuesday at eleven. Can we meet on Wednesday afternoon? The client prefers Wednesday afternoon, so Tomas sends a new invitation.',
  },
  {
    id: 'project-status-update', level: 'B1', topic: 'Project status update',
    reading: 'The website redesign is two days behind schedule because the final images arrived late. The development work is finished, but the team still needs to test the checkout. The project manager will give the client a revised launch date today.',
    gapSentence: 'The team has not tested the checkout ___.', gapAnswer: 'yet',
    question: 'Why is the redesign behind schedule?', options: ['The final images arrived late.', 'The developer left the team.', 'The client cancelled the checkout.'], answer: 'The final images arrived late.',
    statement: 'The development work is still in progress.', statementAnswer: 'False',
    pairs: [['behind schedule', 'later than planned'], ['revised date', 'an updated date'], ['checkout', 'the payment part of a website']],
    dialogue: ['A: How is the website redesign progressing?', 'B: Development is finished, but we still need to test the checkout.', 'A: What will you tell the client?'],
    dialogueModel: 'B: I will explain the delay and give them a revised launch date today.',
    questions: ['Which part of the project is finished?', 'What will the project manager tell the client?'], questionAnswers: ['The development work is finished.', 'The manager will give the client a revised launch date.'],
    discussion: ['How do you usually explain a short delay to a client?', 'Which project update is hardest for you to give in English?'],
    error: 'We are working on this project since March.', correction: 'We have been working on this project since March.',
    oddOptions: ['delay', 'schedule', 'deadline', 'lunch'], oddAnswer: 'lunch',
    halves: [['The images arrived late,', 'so we are behind schedule.'], ['We have finished development,', 'but we still need to test.'], ['I will give the client', 'a revised launch date.']],
    wordOrder: ['not', 'We', 'tested', 'have', 'checkout', 'the', 'yet'], wordOrderAnswer: 'We have not tested the checkout yet.',
    gapText: 'Development ___ finished, but testing ___ not.', gapTextAnswers: ['is', 'is'],
    prefixBase: 'complete', prefixAnswer: 'incomplete', prefixSentence: 'The testing is incomplete, so we cannot launch today.',
    categories: { 'Progress': ['finished', 'completed'], 'Delay': ['behind schedule', 'revised date'] },
    paraphrase: 'The project is later than planned.', paraphrasePrompt: 'Use: behind schedule', paraphraseAnswer: 'The project is behind schedule.',
    completeSentence: 'The manager will share a revised launch d___.', completeAnswer: 'date',
    synonymWord: 'revised', synonymOptions: ['updated', 'cancelled', 'repeated'], synonymAnswer: 'updated',
    antonymWord: 'early', antonymOptions: ['late', 'ready', 'final'], antonymAnswer: 'late',
    pictureAlt: 'Two colleagues reviewing a project timeline beside laptops.', pictureStatement: 'The colleagues are reviewing work together.', pictureStatementAnswer: 'True',
    pictureQuestion: 'What are the colleagues most likely discussing?', pictureOptions: ['A project timeline.', 'A lunch menu.', 'A holiday itinerary.'], pictureAnswer: 'A project timeline.',
    audioTranscript: 'The website redesign is two days behind schedule because the final images arrived late. Development is finished, but the team has not tested the checkout yet. The project manager will give the client a revised launch date today.',
  },
  {
    id: 'negotiating-a-deadline', level: 'B2', topic: 'Negotiating a deadline',
    reading: 'A supplier asks for an extra week to deliver the packaging. The operations manager cannot accept a full week because the launch campaign has already been booked. They agree on a three-day extension and a partial delivery on Friday.',
    gapSentence: 'Could you ___ the delivery by three days?', gapAnswer: 'postpone',
    question: 'Why is a full week unacceptable?', options: ['The launch campaign has been booked.', 'The packaging is unnecessary.', 'The supplier is closing.'], answer: 'The launch campaign has been booked.',
    statement: 'They agree on a three-day extension.', statementAnswer: 'True',
    pairs: [['extension', 'additional time'], ['partial delivery', 'only part of an order delivered'], ['booked campaign', 'promotion arranged in advance']],
    dialogue: ['A: We need an extra week for the packaging.', 'B: A full week would affect the launch. Could you deliver part of the order on Friday?', 'A: We can manage that if the remaining items arrive three days later.'],
    dialogueModel: 'B: That works for us. Let us confirm the two delivery dates in writing.',
    questions: ['What does the supplier request?', 'What compromise do they reach?'], questionAnswers: ['The supplier requests an extra week.', 'They agree on a three-day extension and a partial delivery on Friday.'],
    discussion: ['When is a deadline extension reasonable in your work?', 'How do you keep a firm position without damaging a supplier relationship?'],
    error: 'We cannot to accept a full week.', correction: 'We cannot accept a full week.',
    oddOptions: ['extension', 'deadline', 'delivery', 'salary'], oddAnswer: 'salary',
    halves: [['A full week', 'would affect the launch.'], ['Could you deliver', 'part of the order on Friday?'], ['Let us confirm', 'the dates in writing.']],
    wordOrder: ['you', 'Could', 'delivery', 'postpone', 'the'], wordOrderAnswer: 'Could you postpone the delivery?',
    gapText: 'The supplier asked ___ an extension. They agreed ___ a partial delivery.', gapTextAnswers: ['for', 'on'],
    prefixBase: 'acceptable', prefixAnswer: 'unacceptable', prefixSentence: 'A full week is unacceptable because the campaign has been booked.',
    categories: { 'Negotiation': ['compromise', 'extension'], 'Logistics': ['delivery', 'packaging'] },
    paraphrase: 'They found a solution acceptable to both sides.', paraphrasePrompt: 'Use: compromise', paraphraseAnswer: 'They reached a compromise.',
    completeSentence: 'They agree on a three-day e________.', completeAnswer: 'extension',
    synonymWord: 'postpone', synonymOptions: ['delay', 'confirm', 'deliver'], synonymAnswer: 'delay',
    antonymWord: 'accept', antonymOptions: ['reject', 'request', 'negotiate'], antonymAnswer: 'reject',
    pictureAlt: 'Two colleagues negotiating across a table with laptops and a timeline.', pictureStatement: 'One person is using a laptop.', pictureStatementAnswer: 'True',
    pictureQuestion: 'Which workplace situation best fits the scene?', pictureOptions: ['A deadline discussion.', 'A job dismissal.', 'A fire drill.'], pictureAnswer: 'A deadline discussion.',
    audioTranscript: 'A supplier asks for an extra week to deliver the packaging. The operations manager cannot accept a full week because the launch campaign has already been booked. Could you postpone the delivery by three days? They agree on a three-day extension and a partial delivery on Friday.',
  },
  {
    id: 'executive-summary', level: 'C1', topic: 'Executive summary for leadership',
    reading: 'Customer retention improved after the onboarding team introduced weekly check-ins. However, the report cautions that the sample covers only one quarter and two client segments. The author recommends validating the pattern before expanding the programme.',
    gapSentence: 'The findings should be ___ before the programme is expanded.', gapAnswer: 'validated',
    question: 'What limitation does the report identify?', options: ['A limited sample.', 'A fall in retention.', 'A lack of customer check-ins.'], answer: 'A limited sample.',
    statement: 'The author recommends immediate expansion.', statementAnswer: 'False',
    pairs: [['retention', 'the continued use of a service'], ['validate', 'test whether a conclusion is supported'], ['segment', 'a distinct group within a population']],
    dialogue: ['A: What does the report conclude about weekly check-ins?', 'B: They coincided with better retention, but the sample is limited.', 'A: What would you recommend before a wider rollout?'],
    dialogueModel: 'B: I would validate the pattern across more segments and another quarter.',
    questions: ['What changed after weekly check-ins were introduced?', 'Why does the author advise caution?'], questionAnswers: ['Customer retention improved.', 'The sample covers only one quarter and two client segments.'],
    discussion: ['How much evidence do you need before changing an established process?', 'Which caveat is most often missing from executive summaries in your field?'],
    error: 'The report recommend caution before expansion.', correction: 'The report recommends caution before expansion.',
    oddOptions: ['validate', 'substantiate', 'verify', 'overlook'], oddAnswer: 'overlook',
    halves: [['Although retention improved,', 'the sample was limited.'], ['The author cautions', 'against immediate expansion.'], ['The pattern should be validated', 'across additional segments.']],
    wordOrder: ['be', 'findings', 'The', 'validated', 'should'], wordOrderAnswer: 'The findings should be validated.',
    gapText: 'Retention improved, ___ the sample was limited. Further validation ___ recommended.', gapTextAnswers: ['but', 'is'],
    prefixBase: 'significant', prefixAnswer: 'insignificant', prefixSentence: 'The difference may be statistically insignificant until more data is collected.',
    categories: { 'Evidence': ['sample', 'pattern'], 'Caution': ['caveat', 'limitation'] },
    paraphrase: 'The report advises against expanding too soon.', paraphrasePrompt: 'Use: cautions', paraphraseAnswer: 'The report cautions against premature expansion.',
    completeSentence: 'The report includes an important c_____ about the sample.', completeAnswer: 'caveat',
    synonymWord: 'validate', synonymOptions: ['substantiate', 'dismiss', 'summarise'], synonymAnswer: 'substantiate',
    antonymWord: 'expand', antonymOptions: ['contract', 'validate', 'recommend'], antonymAnswer: 'contract',
    pictureAlt: 'Two colleagues examining charts and a concise report on a table.', pictureStatement: 'The colleagues appear to be reviewing evidence.', pictureStatementAnswer: 'True',
    pictureQuestion: 'Which task best matches the scene?', pictureOptions: ['Reviewing a report.', 'Recording an advertisement.', 'Packing an order.'], pictureAnswer: 'Reviewing a report.',
    audioTranscript: 'Customer retention improved after the onboarding team introduced weekly check-ins. However, the sample covers only one quarter and two client segments. The findings should be validated before the programme is expanded.',
  },
  {
    id: 'stakeholder-disagreement', level: 'C2', topic: 'Nuanced stakeholder disagreement',
    reading: 'The finance director acknowledges the proposal\'s commercial potential but questions whether the projected savings account for implementation risk. Rather than rejecting the plan outright, she asks the team to stress-test its assumptions and define the conditions under which it would no longer be viable.',
    gapSentence: 'She does not reject the proposal ___; she asks for a more rigorous assessment.', gapAnswer: 'outright',
    question: 'What is the finance director\'s position?', options: ['Qualified scepticism.', 'Unconditional support.', 'Complete rejection.'], answer: 'Qualified scepticism.',
    statement: 'She wants the assumptions tested.', statementAnswer: 'True',
    pairs: [['outright', 'completely and immediately'], ['stress-test', 'examine under adverse conditions'], ['viable', 'capable of succeeding']],
    dialogue: ['A: I thought finance rejected the proposal.', 'B: Not outright. The director questioned the assumptions behind the savings.', 'A: What has she asked the team to do next?'],
    dialogueModel: 'B: She wants us to stress-test the assumptions and specify when the plan would cease to be viable.',
    questions: ['Which risk does the finance director identify?', 'What does she request instead of rejecting the plan?'], questionAnswers: ['She questions whether implementation risk is included in the projected savings.', 'She asks for stress-tested assumptions and clear limits to viability.'],
    discussion: ['How can you challenge a senior stakeholder without sounding obstructive?', 'When does cautious scrutiny become an unnecessary barrier to action?'],
    error: 'She suggested to stress-test the assumptions.', correction: 'She suggested stress-testing the assumptions.',
    oddOptions: ['viable', 'feasible', 'sustainable', 'implausible'], oddAnswer: 'implausible',
    halves: [['Rather than rejecting the plan,', 'she questioned its assumptions.'], ['The projected savings', 'may omit implementation risk.'], ['The team must define', 'when the plan would cease to be viable.']],
    wordOrder: ['assumptions', 'stress-test', 'We', 'the', 'should'], wordOrderAnswer: 'We should stress-test the assumptions.',
    gapText: 'She acknowledged the potential ___ questioned the projections. The plan was not rejected ___.', gapTextAnswers: ['but', 'outright'],
    prefixBase: 'credible', prefixAnswer: 'incredible', prefixSentence: 'In this context, incredible means not credible, not impressive.',
    categories: { 'Qualified stance': ['acknowledge', 'question'], 'Decision limits': ['assumption', 'viability'] },
    paraphrase: 'She did not reject the plan completely.', paraphrasePrompt: 'Use: outright', paraphraseAnswer: 'She did not reject the plan outright.',
    completeSentence: 'The director asks when the plan would cease to be v_____.', completeAnswer: 'viable',
    synonymWord: 'viable', synonymOptions: ['feasible', 'generous', 'immediate'], synonymAnswer: 'feasible',
    antonymWord: 'plausible', antonymOptions: ['implausible', 'commercial', 'qualified'], antonymAnswer: 'implausible',
    pictureAlt: 'Two colleagues in a serious discussion over charts and a laptop.', pictureStatement: 'The colleagues appear to be discussing a business document.', pictureStatementAnswer: 'True',
    pictureQuestion: 'Which interpretation is most plausible?', pictureOptions: ['They are examining a proposal.', 'They are celebrating a birthday.', 'They are interviewing a job candidate.'], pictureAnswer: 'They are examining a proposal.',
    audioTranscript: 'The finance director acknowledges the proposal\'s commercial potential but questions whether the projected savings account for implementation risk. She does not reject the proposal outright. She asks the team to stress-test its assumptions and define when it would no longer be viable.',
  },
];

function escapePreviewHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function previewTextInput(label, multiline = false) {
  const safeLabel = escapePreviewHtml(label);
  if (multiline) {
    return `<label class="eq-generator-field"><span>${safeLabel}</span><textarea rows="3"></textarea></label>`;
  }
  return `<label class="eq-generator-field"><span>${safeLabel}</span><input type="text" autocomplete="off"></label>`;
}

function previewRadioGroup(name, options) {
  const safeName = escapePreviewHtml(name);
  return `<div class="eq-generator-options">${options.map((option) => `<label><input type="radio" name="${safeName}" value="${escapePreviewHtml(option)}"><span>${escapePreviewHtml(option)}</span></label>`).join('')}</div>`;
}

function previewSelect(name, options) {
  return `<select aria-label="${escapePreviewHtml(name)}"><option value="">Choose...</option>${options.map((option) => `<option>${escapePreviewHtml(option)}</option>`).join('')}</select>`;
}

function previewAudio() {
  return `<div class="eq-generator-media"><button type="button" class="eq-generator-play" data-eq-preview-audio>Play cached transcript with browser voice</button><p class="eq-generator-media-note">This demonstration uses an available browser voice. It does not generate audio or call Edooqoo AI.</p><p class="eq-generator-audio-status" data-eq-audio-status role="status"></p></div>`;
}

function previewPicture(scenario) {
  return `<svg class="eq-generator-picture" viewBox="0 0 640 280" role="img" aria-label="${escapePreviewHtml(scenario.pictureAlt)}" xmlns="http://www.w3.org/2000/svg"><rect class="eq-illustration-wall" x="0" y="0" width="640" height="280" rx="20"/><rect class="eq-illustration-board" x="360" y="32" width="220" height="112" rx="10"/><path class="eq-illustration-line" d="M390 112l40-32 34 18 54-44 38 22"/><circle class="eq-illustration-person" cx="190" cy="92" r="34"/><circle class="eq-illustration-person" cx="300" cy="96" r="34"/><path class="eq-illustration-body" d="M132 198c8-48 28-70 60-70s54 22 60 70M244 198c8-46 27-66 58-66s51 20 58 66"/><rect class="eq-illustration-table" x="94" y="188" width="330" height="24" rx="12"/><path class="eq-illustration-laptop" d="M176 148h76v46h-76zM258 148h76v46h-76z"/></svg>`;
}

export function renderExercisePreview(exercise, scenario) {
  const key = `${scenario.id}-${exercise.id}`;
  const reading = `<p class="eq-generator-passage">${escapePreviewHtml(scenario.reading)}</p>`;
  const openAnswers = 'Open response. Review relevance, clarity and the learner\'s control of the target language rather than expecting one exact wording.';
  let instructions = exercise.description;
  let content = '';
  let answers = '';

  switch (exercise.id) {
    case 'reading':
      content = reading + previewTextInput(scenario.questions[0]) + previewTextInput(scenario.questions[1]);
      answers = `1. ${scenario.questionAnswers[0]} 2. ${scenario.questionAnswers[1]}`;
      break;
    case 'answer-questions':
      instructions = 'Read the short workplace text, then answer both questions in your own words.';
      content = reading + previewTextInput(scenario.questions[0]) + previewTextInput(scenario.questions[1]);
      answers = `1. ${scenario.questionAnswers[0]} 2. ${scenario.questionAnswers[1]}`;
      break;
    case 'fill-in-blanks':
      content = `<p class="eq-generator-sentence">${escapePreviewHtml(scenario.gapSentence)}</p>${previewTextInput('Missing word')}`;
      answers = scenario.gapAnswer;
      break;
    case 'multiple-choice':
      content = reading + `<p class="eq-generator-sentence">${escapePreviewHtml(scenario.question)}</p>` + previewRadioGroup(key, scenario.options);
      answers = scenario.answer;
      break;
    case 'true-false':
      content = reading + `<p class="eq-generator-sentence">${escapePreviewHtml(scenario.statement)}</p>` + previewRadioGroup(key, ['True', 'False']);
      answers = scenario.statementAnswer;
      break;
    case 'matching':
      content = scenario.pairs.map(([term], index) => `<div class="eq-generator-match"><strong>${escapePreviewHtml(term)}</strong>${previewSelect(`Match for ${term}`, scenario.pairs.map((pair) => pair[1]))}</div>`).join('');
      answers = scenario.pairs.map(([term, definition]) => `${term}: ${definition}`).join(' | ');
      break;
    case 'dialogue':
      content = `<div class="eq-generator-dialogue">${scenario.dialogue.map((line) => `<p>${escapePreviewHtml(line)}</p>`).join('')}</div>${previewTextInput('Write the next response', true)}`;
      answers = scenario.dialogueModel;
      break;
    case 'discussion':
      content = previewTextInput(scenario.discussion[0], true) + previewTextInput(scenario.discussion[1], true);
      answers = openAnswers;
      break;
    case 'error-correction':
      content = `<p class="eq-generator-sentence">${escapePreviewHtml(scenario.error)}</p>${previewTextInput('Corrected sentence')}`;
      answers = scenario.correction;
      break;
    case 'odd-one-out':
      content = previewRadioGroup(key, scenario.oddOptions) + previewTextInput('Why does it not belong?');
      answers = `${scenario.oddAnswer}. The other items belong to the workplace context.`;
      break;
    case 'matching-halves':
      content = scenario.halves.map(([start]) => `<div class="eq-generator-match"><span>${escapePreviewHtml(start)}</span>${previewSelect(`Ending for ${start}`, scenario.halves.map((pair) => pair[1]))}</div>`).join('');
      answers = scenario.halves.map(([start, end]) => `${start} ${end}`).join(' | ');
      break;
    case 'word-order':
      content = `<p class="eq-generator-words">${scenario.wordOrder.map((word) => `<span>${escapePreviewHtml(word)}</span>`).join('')}</p>${previewTextInput('Complete sentence')}`;
      answers = scenario.wordOrderAnswer;
      break;
    case 'gap-text':
      content = `<p class="eq-generator-passage">${escapePreviewHtml(scenario.gapText)}</p>${previewTextInput('Gap 1')}${previewTextInput('Gap 2')}`;
      answers = scenario.gapTextAnswers.join(' | ');
      break;
    case 'negative-prefixes':
      instructions = `Use a negative prefix with "${scenario.prefixBase}" to complete the sentence.`;
      content = `<p class="eq-generator-sentence">${escapePreviewHtml(scenario.prefixSentence.replace(scenario.prefixAnswer, '__________'))}</p>${previewTextInput('Complete word')}`;
      answers = scenario.prefixAnswer;
      break;
    case 'categorize': {
      const categoryNames = Object.keys(scenario.categories);
      const items = categoryNames.flatMap((category) => scenario.categories[category]);
      content = items.map((item) => `<div class="eq-generator-match"><strong>${escapePreviewHtml(item)}</strong>${previewSelect(`Category for ${item}`, categoryNames)}</div>`).join('');
      answers = categoryNames.map((category) => `${category}: ${scenario.categories[category].join(', ')}`).join(' | ');
      break;
    }
    case 'paraphrasing':
      content = `<p class="eq-generator-sentence">${escapePreviewHtml(scenario.paraphrase)}</p><p>${escapePreviewHtml(scenario.paraphrasePrompt)}</p>${previewTextInput('Your paraphrase', true)}`;
      answers = scenario.paraphraseAnswer;
      break;
    case 'complete-word':
      content = `<p class="eq-generator-sentence">${escapePreviewHtml(scenario.completeSentence)}</p>${previewTextInput('Complete word')}`;
      answers = scenario.completeAnswer;
      break;
    case 'synonyms':
      instructions = `Choose the closest synonym for "${scenario.synonymWord}".`;
      content = previewRadioGroup(key, scenario.synonymOptions);
      answers = scenario.synonymAnswer;
      break;
    case 'antonyms':
      instructions = `Choose the opposite of "${scenario.antonymWord}".`;
      content = previewRadioGroup(key, scenario.antonymOptions);
      answers = scenario.antonymAnswer;
      break;
    case 'describe-picture':
      content = previewPicture(scenario) + previewTextInput('Describe what is happening and what the people may be discussing.', true);
      answers = openAnswers;
      break;
    case 'answer-questions-picture':
      content = previewPicture(scenario) + previewTextInput(scenario.pictureQuestion) + previewTextInput('What detail supports your answer?');
      answers = `${scenario.pictureAnswer} Supporting details will vary.`;
      break;
    case 'true-false-picture':
      content = previewPicture(scenario) + `<p class="eq-generator-sentence">${escapePreviewHtml(scenario.pictureStatement)}</p>` + previewRadioGroup(key, ['True', 'False']);
      answers = scenario.pictureStatementAnswer;
      break;
    case 'multiple-choice-picture':
      content = previewPicture(scenario) + `<p class="eq-generator-sentence">${escapePreviewHtml(scenario.pictureQuestion)}</p>` + previewRadioGroup(key, scenario.pictureOptions);
      answers = scenario.pictureAnswer;
      break;
    case 'listening-comprehension':
    case 'answer-questions-audio':
      instructions = 'Listen once for the general message and again for detail, then answer both questions.';
      content = previewAudio() + previewTextInput(scenario.questions[0]) + previewTextInput(scenario.questions[1]);
      answers = `${scenario.questionAnswers[0]} | ${scenario.questionAnswers[1]} | Transcript: ${scenario.audioTranscript}`;
      break;
    case 'true-false-audio':
      content = previewAudio() + `<p class="eq-generator-sentence">${escapePreviewHtml(scenario.statement)}</p>` + previewRadioGroup(key, ['True', 'False']);
      answers = `${scenario.statementAnswer} | Transcript: ${scenario.audioTranscript}`;
      break;
    case 'multiple-choice-audio':
      content = previewAudio() + `<p class="eq-generator-sentence">${escapePreviewHtml(scenario.question)}</p>` + previewRadioGroup(key, scenario.options);
      answers = `${scenario.answer} | Transcript: ${scenario.audioTranscript}`;
      break;
    case 'fill-in-blanks-audio':
      content = previewAudio() + `<p class="eq-generator-sentence">${escapePreviewHtml(scenario.gapSentence)}</p>${previewTextInput('Missing word from the recording')}`;
      answers = `${scenario.gapAnswer} | Transcript: ${scenario.audioTranscript}`;
      break;
    default:
      content = '<p>This cached preview is unavailable.</p>';
      answers = 'No sample answer.';
  }

  return { instructions, content, answers };
}

function renderPreviewDocument(exercise, scenario) {
  const preview = renderExercisePreview(exercise, scenario);
  return `<div class="eq-generator-paper-header"><div><span class="eq-generator-sample-label">Cached sample</span><h3>${escapePreviewHtml(exercise.label)}</h3></div><span class="eq-generator-level">${escapePreviewHtml(scenario.level)}</span></div><p class="eq-generator-topic">${escapePreviewHtml(scenario.topic)}</p><p class="eq-generator-instructions">${escapePreviewHtml(preview.instructions)}</p><div class="eq-generator-task">${preview.content}</div><details class="eq-generator-answers"><summary>Sample answer key</summary><p>${escapePreviewHtml(preview.answers)}</p></details><p class="eq-generator-privacy">Answers stay in this page. They are not saved, sent or automatically checked.</p>`;
}

const GENERATOR_PREVIEW_CSS = `<style>
.eq-generator-preview{--eq-preview-ink:#172033;--eq-preview-muted:#475467;--eq-preview-accent:#5E3FD9;--eq-preview-accent-soft:#f5f3ff;--eq-preview-border:#d9d6fe;--eq-preview-line:#e4e7ec;--eq-preview-paper:#fff;--eq-preview-soft:#f8fafc;margin:28px 0 36px;padding:24px;border:1px solid var(--eq-preview-border);border-radius:24px;background:var(--eq-preview-accent-soft);color:var(--eq-preview-ink)}
.eq-generator-preview h2{margin:0 0 8px;font-size:28px}.eq-generator-preview h3{margin:4px 0 0;font-size:22px;line-height:1.25}.eq-generator-preview p{line-height:1.55}.eq-generator-intro{margin:0 0 20px;color:var(--eq-preview-muted)}
.eq-generator-controls{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:18px 0}.eq-generator-control{display:grid;gap:6px;font-size:13px;font-weight:700}.eq-generator-control select,.eq-generator-match select{width:100%;min-height:44px;padding:9px 12px;border:1px solid var(--eq-preview-line);border-radius:12px;background:var(--eq-preview-paper);color:var(--eq-preview-ink);font:inherit;font-weight:400}
.eq-generator-submit,.eq-generator-cta{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:11px 20px;border:0;border-radius:999px;background:var(--eq-preview-accent);color:var(--eq-preview-paper);font:inherit;font-weight:700;cursor:pointer;text-decoration:none}.eq-generator-submit:hover,.eq-generator-cta:hover{text-decoration:none;filter:brightness(.95)}
.eq-generator-filter{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0 12px}.eq-generator-filter button,.eq-generator-type{padding:8px 13px;border:1px solid var(--eq-preview-line);border-radius:999px;background:var(--eq-preview-paper);color:var(--eq-preview-ink);font:inherit;font-size:13px;cursor:pointer}.eq-generator-filter button[aria-pressed="true"],.eq-generator-type[aria-pressed="true"]{border-color:var(--eq-preview-accent);background:var(--eq-preview-accent);color:var(--eq-preview-paper)}
.eq-generator-workspace{display:grid;grid-template-columns:230px minmax(0,1fr);gap:18px;align-items:start}.eq-generator-browser{max-height:490px;overflow:auto;padding:4px}.eq-generator-category{margin:14px 0 7px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--eq-preview-muted)}.eq-generator-types{display:flex;flex-wrap:wrap;gap:7px}.eq-generator-type{font-size:12px;padding:7px 10px}
.eq-generator-paper{min-width:0;padding:22px;border:1px solid var(--eq-preview-line);border-radius:20px;background:var(--eq-preview-paper)}.eq-generator-paper-header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.eq-generator-sample-label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--eq-preview-accent)}.eq-generator-level{display:inline-flex;padding:4px 10px;border-radius:999px;background:var(--eq-preview-accent-soft);color:var(--eq-preview-accent);font-weight:800}.eq-generator-topic{margin:4px 0 14px;color:var(--eq-preview-muted)}.eq-generator-instructions{font-weight:700}.eq-generator-passage,.eq-generator-sentence{padding:13px 15px;border-left:3px solid var(--eq-preview-accent);background:var(--eq-preview-soft)}
.eq-generator-field{display:grid;gap:6px;margin:14px 0;font-size:14px;font-weight:700}.eq-generator-field input,.eq-generator-field textarea{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid var(--eq-preview-line);border-radius:10px;background:var(--eq-preview-paper);color:var(--eq-preview-ink);font:inherit;font-weight:400}.eq-generator-options{display:grid;gap:8px;margin:14px 0}.eq-generator-options label{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;border:1px solid var(--eq-preview-line);border-radius:10px}.eq-generator-options input{margin-top:5px}.eq-generator-match{display:grid;grid-template-columns:minmax(100px,1fr) minmax(150px,1.5fr);gap:12px;align-items:center;margin:10px 0}.eq-generator-dialogue{padding:4px 14px;border-radius:12px;background:var(--eq-preview-soft)}.eq-generator-dialogue p{margin:10px 0}.eq-generator-words{display:flex;flex-wrap:wrap;gap:7px}.eq-generator-words span{padding:6px 9px;border:1px solid var(--eq-preview-line);border-radius:8px;background:var(--eq-preview-soft)}
.eq-generator-media{margin:14px 0;padding:14px;border-radius:14px;background:var(--eq-preview-soft)}.eq-generator-play{min-height:44px;padding:10px 15px;border:1px solid var(--eq-preview-accent);border-radius:999px;background:var(--eq-preview-paper);color:var(--eq-preview-accent);font:inherit;font-weight:700;cursor:pointer}.eq-generator-media-note,.eq-generator-audio-status,.eq-generator-privacy{margin:8px 0 0;font-size:12px;color:var(--eq-preview-muted)}.eq-generator-picture{display:block;width:100%;height:auto;margin:0 0 16px}.eq-illustration-wall{fill:#f5f3ff}.eq-illustration-board{fill:#fff;stroke:#d9d6fe;stroke-width:3}.eq-illustration-line{fill:none;stroke:#5E3FD9;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}.eq-illustration-person{fill:#d9d6fe}.eq-illustration-body{fill:none;stroke:#5E3FD9;stroke-width:22;stroke-linecap:round}.eq-illustration-table{fill:#475467}.eq-illustration-laptop{fill:#fff;stroke:#475467;stroke-width:4}
.eq-generator-answers{margin-top:18px}.eq-generator-answers p{white-space:normal}.eq-generator-cta-row{display:flex;flex-wrap:wrap;align-items:center;gap:14px;margin-top:20px}.eq-generator-secondary{color:var(--eq-preview-accent);font-weight:700}.eq-generator-note{font-size:12px;color:var(--eq-preview-muted)}
.eq-generator-preview button:focus-visible,.eq-generator-preview a:focus-visible,.eq-generator-preview select:focus-visible,.eq-generator-preview input:focus-visible,.eq-generator-preview textarea:focus-visible{outline:3px solid var(--eq-preview-accent);outline-offset:2px}
@media(max-width:720px){.eq-generator-preview{padding:16px;border-radius:18px}.eq-generator-controls,.eq-generator-workspace{grid-template-columns:1fr}.eq-generator-browser{max-height:230px}.eq-generator-paper{padding:16px}.eq-generator-match{grid-template-columns:1fr}.eq-generator-preview h2{font-size:24px}}
</style>`;

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function renderWorksheetGeneratorPreview() {
  const defaultScenario = GENERATOR_PREVIEW_SCENARIOS.find((scenario) => scenario.id === 'project-status-update');
  const defaultExercise = GENERATOR_PREVIEW_EXERCISES.find((exercise) => exercise.id === 'error-correction');
  const categories = [['core', 'Core exercises'], ['picture', 'Picture exercises'], ['audio', 'Audio exercises']];
  const browser = categories.map(([category, label]) => `<div data-eq-type-group="${category}"><p class="eq-generator-category">${label}</p><div class="eq-generator-types">${GENERATOR_PREVIEW_EXERCISES.filter((exercise) => exercise.category === category).map((exercise) => `<button type="button" class="eq-generator-type" data-eq-exercise="${exercise.id}" aria-pressed="${exercise.id === defaultExercise.id}" title="${escapePreviewHtml(exercise.description)}">${escapePreviewHtml(exercise.label)}</button>`).join('')}</div></div>`).join('');

  return `${GENERATOR_PREVIEW_CSS}<section class="eq-generator-preview" id="try-generator" aria-labelledby="eq-generator-heading">
  <h2 id="eq-generator-heading">Try 28 exercise formats with a cached adult lesson</h2>
  <p class="eq-generator-intro">Choose a CEFR level, a workplace topic and an exercise type. The sample appears instantly from pre-written content: no signup, no AI call and no token use.</p>
  <form id="eq-generator-form" class="eq-generator-controls">
    <label class="eq-generator-control">CEFR level<select id="eq-generator-level-select">${GENERATOR_PREVIEW_SCENARIOS.map((scenario) => `<option value="${scenario.level}"${scenario.level === defaultScenario.level ? ' selected' : ''}>${scenario.level}</option>`).join('')}</select></label>
    <label class="eq-generator-control">Adult lesson topic<select id="eq-generator-topic-select">${GENERATOR_PREVIEW_SCENARIOS.map((scenario) => `<option value="${scenario.id}"${scenario.id === defaultScenario.id ? ' selected' : ''}>${escapePreviewHtml(scenario.topic)} (${scenario.level})</option>`).join('')}</select></label>
    <button class="eq-generator-submit" type="submit">Show cached sample</button>
  </form>
  <div class="eq-generator-filter" aria-label="Filter exercise types">${[['all', 'All 28'], ...categories].map(([category, label], index) => `<button type="button" data-eq-filter="${category}" aria-pressed="${index === 0}">${label}</button>`).join('')}</div>
  <div class="eq-generator-workspace">
    <div class="eq-generator-browser" aria-label="Exercise type browser">${browser}</div>
    <div class="eq-generator-paper" id="eq-generator-paper">${renderPreviewDocument(defaultExercise, defaultScenario)}</div>
  </div>
  <p id="eq-generator-status" class="eq-generator-note" role="status">Showing ${escapePreviewHtml(defaultExercise.label)}: ${escapePreviewHtml(defaultScenario.topic)} (${defaultScenario.level}).</p>
  <div class="eq-generator-cta-row"><a class="eq-generator-cta" href="/signup?src=pseo-ai-worksheet-generator-preview">Create an editable worksheet for your student</a><a class="eq-generator-secondary" href="/gallery">See published worksheets</a></div>
  <p class="eq-generator-note">This is a mechanics preview, not an AI-generated result. In the full workflow, you review and edit the worksheet before sharing it.</p>
  <noscript><p>The 28 available formats are listed above. Enable JavaScript to switch between the cached interactive samples.</p></noscript>
</section>
<script>
(() => {
  const scenarios = ${safeJson(GENERATOR_PREVIEW_SCENARIOS)};
  const exercises = ${safeJson(GENERATOR_PREVIEW_EXERCISES)};
  const escapePreviewHtml = ${escapePreviewHtml.toString()};
  const previewTextInput = ${previewTextInput.toString()};
  const previewRadioGroup = ${previewRadioGroup.toString()};
  const previewSelect = ${previewSelect.toString()};
  const previewAudio = ${previewAudio.toString()};
  const previewPicture = ${previewPicture.toString()};
  const renderExercisePreview = ${renderExercisePreview.toString()};
  const renderPreviewDocument = ${renderPreviewDocument.toString()};
  let scenario = scenarios.find((item) => item.id === '${defaultScenario.id}');
  let exercise = exercises.find((item) => item.id === '${defaultExercise.id}');
  const form = document.getElementById('eq-generator-form');
  const levelSelect = document.getElementById('eq-generator-level-select');
  const topicSelect = document.getElementById('eq-generator-topic-select');
  const paper = document.getElementById('eq-generator-paper');
  const status = document.getElementById('eq-generator-status');

  const render = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    paper.innerHTML = renderPreviewDocument(exercise, scenario);
    status.textContent = 'Showing ' + exercise.label + ': ' + scenario.topic + ' (' + scenario.level + '). Cached sample only.';
    document.querySelectorAll('[data-eq-exercise]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.eqExercise === exercise.id));
    });
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    scenario = scenarios.find((item) => item.id === topicSelect.value) || scenario;
    render();
  });

  levelSelect.addEventListener('change', () => {
    const match = scenarios.find((item) => item.level === levelSelect.value);
    if (match) topicSelect.value = match.id;
  });

  topicSelect.addEventListener('change', () => {
    const match = scenarios.find((item) => item.id === topicSelect.value);
    if (match) levelSelect.value = match.level;
  });

  document.querySelectorAll('[data-eq-exercise]').forEach((button) => {
    button.addEventListener('click', () => {
      exercise = exercises.find((item) => item.id === button.dataset.eqExercise) || exercise;
      render();
    });
  });

  document.querySelectorAll('[data-eq-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.eqFilter;
      document.querySelectorAll('[data-eq-filter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      document.querySelectorAll('[data-eq-type-group]').forEach((group) => {
        group.hidden = filter !== 'all' && group.dataset.eqTypeGroup !== filter;
      });
    });
  });

  paper.addEventListener('click', (event) => {
    const button = event.target.closest('[data-eq-preview-audio]');
    if (!button) return;
    const audioStatus = paper.querySelector('[data-eq-audio-status]');
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance !== 'function') {
      audioStatus.textContent = 'Browser audio is unavailable. Open the answer key to read the transcript.';
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(scenario.audioTranscript);
    utterance.lang = 'en-GB';
    utterance.rate = scenario.level === 'A1' || scenario.level === 'A2' ? 0.82 : 0.94;
    utterance.onend = () => { audioStatus.textContent = 'Playback finished.'; };
    utterance.onerror = () => { audioStatus.textContent = 'Browser audio is unavailable. Open the answer key to read the transcript.'; };
    audioStatus.textContent = 'Playing with an available browser voice.';
    window.speechSynthesis.speak(utterance);
  });
})();
</script>`;
}
