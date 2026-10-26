/**
 * Topic packs for the root pSEO enrichment block (Step 4 of 4).
 *
 * Every pack holds adult, work-or-life-based practice items with an answer key and the
 * recurring errors tutors actually correct in 1:1 lessons. Copy is English, adult-only
 * (Martha Standard) and must never contain an em dash.
 */

export const PSEO_PACKS = {
  'past-simple': {
    topic: 'Past Simple', level: 'A2',
    context: 'reporting what happened at work last week',
    items: [
      ['We ____ (sign) the contract with the Berlin client on Tuesday.', 'signed'],
      ['I ____ (not / go) to the conference because my flight was cancelled.', "didn't go"],
      ['When ____ you ____ (send) the invoice?', 'did / send'],
    ],
    mistakes: [
      ['I didn\'t went to the meeting.', "I didn't go to the meeting.", 'After did/didn\'t the main verb returns to the base form.'],
      ['Yesterday I have finished the report.', 'Yesterday I finished the report.', 'A finished time marker (yesterday, last week) takes Past Simple.'],
    ],
  },
  'present-perfect': {
    topic: 'Present Perfect', level: 'B1',
    context: 'project status updates and career experience',
    items: [
      ['I ____ (work) here since 2019.', 'have worked'],
      ['____ you ever ____ (present) to the board?', 'Have / presented'],
      ['We ____ (not / receive) the final figures yet.', "haven't received"],
    ],
    mistakes: [
      ['I live here since two years.', "I've lived here for two years.", 'Duration up to now needs Present Perfect plus for (a period) or since (a start point).'],
      ['I have seen him last Monday.', 'I saw him last Monday.', 'A finished time reference blocks Present Perfect.'],
    ],
  },
  'present-simple': {
    topic: 'Present Simple', level: 'A2',
    context: 'describing a job role and weekly routine',
    items: [
      ['My manager ____ (approve) all travel requests.', 'approves'],
      ['We ____ (not / work) on Fridays in August.', "don't work"],
      ['How often ____ the team ____ (meet)?', 'does / meet'],
    ],
    mistakes: [
      ['She work in finance.', 'She works in finance.', 'Third person singular adds -s.'],
      ['I am working here usually from home.', 'I usually work from home.', 'Routines take Present Simple; the adverb goes before the main verb.'],
    ],
  },
  'future': {
    topic: 'Future forms', level: 'B1',
    context: 'planning a client visit and making commitments',
    items: [
      ['I ____ (meet) the supplier at 10 tomorrow; it is in my calendar.', "'m meeting"],
      ['Don\'t worry, I ____ (send) you the slides tonight.', "'ll send"],
      ['The new system ____ (go) live on 1 March, according to the schedule.', 'goes'],
    ],
    mistakes: [
      ['I will call you when I will arrive.', "I'll call you when I arrive.", 'After when, as soon as and before, use a present form for future time.'],
      ['Tomorrow I meet my boss for lunch, I decided.', "I'm meeting my boss for lunch tomorrow.", 'Arranged plans usually take the Present Continuous.'],
    ],
  },
  'conditionals': {
    topic: 'Conditionals', level: 'B2',
    context: 'negotiating terms and discussing risks',
    items: [
      ['If you ____ (order) 500 units, we can offer a 5% discount.', 'order'],
      ['If we ____ (have) a bigger budget, we would hire a second developer.', 'had'],
      ['If they ____ (read) the contract, they wouldn\'t have signed it.', 'had read'],
    ],
    mistakes: [
      ['If I will have time, I will call you.', 'If I have time, I will call you.', 'The if clause takes a present form, not will.'],
      ['If I would know, I would tell you.', 'If I knew, I would tell you.', 'Unreal present conditions take a past form in the if clause.'],
    ],
  },
  'passive': {
    topic: 'Passive voice', level: 'B1',
    context: 'writing process descriptions and incident reports',
    items: [
      ['All invoices ____ (check) by the finance team before payment.', 'are checked'],
      ['The server ____ (restart) at 3 am last night.', 'was restarted'],
      ['The new policy ____ (already / approve).', 'has already been approved'],
    ],
    mistakes: [
      ['The report was wrote by Anna.', 'The report was written by Anna.', 'The passive uses the past participle.'],
      ['It was happened during the night.', 'It happened during the night.', 'Intransitive verbs like happen have no passive.'],
    ],
  },
  'modals': {
    topic: 'Modal verbs', level: 'B1',
    context: 'giving advice to a colleague and describing obligations',
    items: [
      ['You ____ submit the expense form by Friday; it is company policy.', 'must / have to'],
      ['You ____ bring a laptop; we will provide one.', "don't have to / don't need to"],
      ['She isn\'t answering. She ____ be in a meeting.', 'might / must'],
    ],
    mistakes: [
      ['You must to sign here.', 'You must sign here.', 'Modals are followed by the bare infinitive.'],
      ['You mustn\'t come early, the meeting starts at 10.', "You don't have to come early.", "mustn't means prohibition; absence of obligation is don't have to."],
    ],
  },
  'prepositions': {
    topic: 'Prepositions', level: 'B1',
    context: 'describing responsibilities and scheduling',
    items: [
      ['I am responsible ____ the onboarding of new staff.', 'for'],
      ['The call is ____ Monday ____ 9:30.', 'on / at'],
      ['It depends ____ the client\'s budget.', 'on'],
    ],
    mistakes: [
      ['I am responsible of the budget.', 'I am responsible for the budget.', 'Dependent prepositions are learned as chunks.'],
      ['We discussed about the price.', 'We discussed the price.', 'discuss takes a direct object.'],
    ],
  },
  'articles': {
    topic: 'Articles', level: 'A2',
    context: 'introducing a company and its products',
    items: [
      ['I work for ____ software company in Warsaw.', 'a'],
      ['____ CEO is visiting our office next week.', 'The'],
      ['She is ____ engineer with ____ experience in robotics.', 'an / (no article)'],
    ],
    mistakes: [
      ['I am engineer.', 'I am an engineer.', 'Singular jobs need a or an.'],
      ['The life in London is expensive.', 'Life in London is expensive.', 'General abstract nouns take no article.'],
    ],
  },
  'comparatives': {
    topic: 'Comparatives and superlatives', level: 'A2',
    context: 'comparing suppliers and offers',
    items: [
      ['Supplier B is ____ (cheap) than Supplier A.', 'cheaper'],
      ['This is ____ (reliable) option we tested.', 'the most reliable'],
      ['The new model is not as ____ (fast) as we expected.', 'fast'],
    ],
    mistakes: [
      ['This offer is more cheaper.', 'This offer is cheaper.', 'Short adjectives take -er without more.'],
      ['He is the most good candidate.', 'He is the best candidate.', 'good has an irregular superlative.'],
    ],
  },
  'gerunds': {
    topic: 'Gerunds and infinitives', level: 'B2',
    context: 'emails and career conversations',
    items: [
      ['I look forward to ____ (hear) from you.', 'hearing'],
      ['We decided ____ (postpone) the launch.', 'to postpone'],
      ['Would you mind ____ (send) the agenda again?', 'sending'],
    ],
    mistakes: [
      ['I look forward to see you.', 'I look forward to seeing you.', 'to is a preposition here, so a gerund follows.'],
      ['I suggest you to call the client.', 'I suggest calling the client.', 'suggest does not take object plus infinitive.'],
    ],
  },
  'phrasal': {
    topic: 'Phrasal verbs', level: 'B2',
    context: 'meetings and project follow-up',
    items: [
      ['Can we ____ the call ____ to next week? (move later)', 'put / off'],
      ['I will ____ ____ the details and email you. (investigate)', 'look into'],
      ['We need to ____ ____ a solution before Friday. (find)', 'come up with'],
    ],
    mistakes: [
      ['We need to put off it.', 'We need to put it off.', 'With separable phrasal verbs a pronoun goes between verb and particle.'],
      ['I will look after the problem.', 'I will look into the problem.', 'look after means take care of; look into means investigate.'],
    ],
  },
  'question-tags': {
    topic: 'Question tags', level: 'B1',
    context: 'confirming details politely on a call',
    items: [
      ['The meeting starts at ten, ____?', "doesn't it"],
      ['You haven\'t sent the file yet, ____?', 'have you'],
      ['Let\'s review the budget first, ____?', 'shall we'],
    ],
    mistakes: [
      ['You are coming tomorrow, isn\'t it?', "You're coming tomorrow, aren't you?", 'The tag repeats the auxiliary and subject of the main clause.'],
      ['He works remotely, isn\'t he?', "He works remotely, doesn't he?", 'Present Simple uses do or does in the tag.'],
    ],
  },
  'relative-clauses': {
    topic: 'Relative clauses', level: 'B1',
    context: 'describing colleagues, clients and products',
    items: [
      ['The client ____ called yesterday wants a new quote.', 'who / that'],
      ['This is the tool ____ saves us two hours a week.', 'which / that'],
      ['Our CFO, ____ office is on the fifth floor, will join us.', 'whose'],
    ],
    mistakes: [
      ['The man which I met is our new partner.', 'The man who I met is our new partner.', 'Use who or that for people.'],
      ['This is the report that I told you about it.', 'This is the report that I told you about.', 'The relative pronoun replaces the object, so do not repeat it.'],
    ],
  },
  'reported-speech': {
    topic: 'Reported speech', level: 'B2',
    context: 'summarising a meeting for a manager',
    items: [
      ['"We will deliver on Monday." The supplier said they ____ deliver on Monday.', 'would'],
      ['"Are you available?" She asked me if I ____ available.', 'was'],
      ['"Send the file." He told me ____ the file.', 'to send'],
    ],
    mistakes: [
      ['He said me that the price was too high.', 'He told me that the price was too high.', 'say takes no personal object; tell does.'],
      ['She asked me where was the office.', 'She asked me where the office was.', 'Reported questions use statement word order.'],
    ],
  },
  'vocabulary': {
    topic: 'Vocabulary in context', level: 'B1',
    context: 'workplace collocations',
    items: [
      ['We need to ____ a decision by Friday. (make / do)', 'make'],
      ['Could you ____ me a favour? (make / do)', 'do'],
      ['The project ran over ____ by 10%. (budget / costs)', 'budget'],
    ],
    mistakes: [
      ['We must do a decision.', 'We must make a decision.', 'Collocations are learned as fixed chunks, not word by word.'],
      ['I want to make a training next month.', 'I want to run a training session next month.', 'Direct translation produces the wrong verb.'],
    ],
  },
  'mixed-review': {
    topic: 'Mixed error review', level: 'B1',
    context: "a learner's own recurring errors from the last two lessons",
    items: [
      ['Correct the sentence: "I am working here since March."', "I've been working here since March."],
      ['Correct the sentence: "We discussed about the new budget."', 'We discussed the new budget.'],
      ['Correct the sentence: "If the client will agree, we start in May."', 'If the client agrees, we will start in May.'],
    ],
    mistakes: [
      ['I am working here since March.', "I've been working here since March.", 'Duration up to now needs a perfect form.'],
      ['He explained me the process.', 'He explained the process to me.', 'explain takes the person after to.'],
    ],
  },
  'business': {
    topic: 'Business English', level: 'B2',
    context: 'emails, meetings and negotiations',
    items: [
      ['Choose the more professional option: "Send me the file now." / "Could you send me the file by noon?"', 'Could you send me the file by noon?'],
      ['Complete: "I\'m afraid we can\'t ____ that price." (accept / take)', 'accept'],
      ['Complete: "Let\'s ____ up the main points before we finish." (sum / close)', 'sum'],
    ],
    mistakes: [
      ['I want that you send me the offer.', 'I would like you to send me the offer.', 'want and would like take object plus infinitive.'],
      ['Please find in attachment the invoice.', 'Please find the invoice attached.', 'Fixed email phrases follow English word order.'],
    ],
  },
  'job-interview': {
    topic: 'Job interview English', level: 'B2',
    context: 'answering competency questions',
    items: [
      ['Complete: "In my last role I was ____ for a team of six." (responsible / in charge)', 'responsible'],
      ['Complete: "I ____ (lead) three product launches so far."', 'have led'],
      ['Choose the stronger answer: "I am a hard worker." / "I cut reporting time by 30% by automating the weekly dashboard."', 'I cut reporting time by 30% by automating the weekly dashboard.'],
    ],
    mistakes: [
      ['I have 5 years of experience in this position since 2019.', "I've been in this position since 2019.", 'Do not mix duration and start point in one phrase.'],
      ['My weak side is perfectionism.', 'One area I am working on is delegating more.', 'Use natural phrasing and a concrete development point.'],
    ],
  },
  'technology': {
    topic: 'Technology English', level: 'B2',
    context: 'explaining a technical issue to a non-technical manager',
    items: [
      ['Complete: "The update was ____ back after it caused errors." (rolled / turned)', 'rolled'],
      ['Complete: "We need to ____ the bug before release." (fix / repair)', 'fix'],
      ['Rewrite in plain English: "The latency is suboptimal."', 'The system is responding too slowly.'],
    ],
    mistakes: [
      ['The program doesn\'t work since yesterday.', "The program hasn't worked since yesterday.", 'since needs a perfect form.'],
      ['I will send you the informations.', 'I will send you the information.', 'information is uncountable.'],
    ],
  },
  'environment': {
    topic: 'Environment and climate', level: 'B2',
    context: 'discussing a company sustainability report',
    items: [
      ['Complete: "We aim to ____ our carbon emissions by 40% by 2030." (reduce / lower down)', 'reduce'],
      ['Complete: "Renewable energy now ____ (account) for half of our usage."', 'accounts'],
      ['Complete: "If more companies ____ (switch) to rail, emissions would fall."', 'switched'],
    ],
    mistakes: [
      ['The climate is changing because of the people.', 'The climate is changing because of human activity.', 'General statements avoid the with plural nouns.'],
      ['We must protect the nature.', 'We must protect nature.', 'nature takes no article in general use.'],
    ],
  },
  'travel': {
    topic: 'Travel English', level: 'A2',
    context: 'business trips, hotels and airports',
    items: [
      ['Complete at check-in: "I have a ____ under the name Kowalski." (reservation / booking order)', 'reservation'],
      ['Complete: "Could I have a window ____, please?" (seat / place)', 'seat'],
      ['Complete: "My flight was ____, so I will arrive tomorrow." (cancelled / closed)', 'cancelled'],
    ],
    mistakes: [
      ['Can I pay with card?', 'Can I pay by card?', 'Payment method uses by.'],
      ['I arrived to London at 8.', 'I arrived in London at 8.', 'arrive in a city, arrive at a building.'],
    ],
  },
  'food': {
    topic: 'Food and dining English', level: 'A2',
    context: 'business lunches and ordering politely',
    items: [
      ['Complete: "Could we have the ____, please?" (bill / account)', 'bill'],
      ['Complete: "I\'d ____ the fish, please." (like / want to)', 'like'],
      ['Complete: "Is this dish ____ for vegetarians?" (suitable / proper)', 'suitable'],
    ],
    mistakes: [
      ['I want a coffee.', "I'd like a coffee, please.", 'would like sounds polite in service situations.'],
      ['Can you give me the menu card?', 'Could I see the menu, please?', 'Direct translation of menu card sounds unnatural.'],
    ],
  },
  'health': {
    topic: 'Health English', level: 'B1',
    context: 'calling in sick and visiting a doctor abroad',
    items: [
      ['Complete: "I\'ve got a sore ____ and a temperature." (throat / neck)', 'throat'],
      ['Complete: "I\'ve ____ (have) this pain for three days."', 'had'],
      ['Complete the email: "I won\'t be in today as I\'m ____ unwell." (feeling / being)', 'feeling'],
    ],
    mistakes: [
      ['I have pain in my head.', 'I have a headache.', 'English uses fixed nouns for common pains.'],
      ['I am sick since Monday.', "I've been ill since Monday.", 'since needs a perfect form.'],
    ],
  },
  'reading': {
    topic: 'Reading comprehension', level: 'B1',
    context: 'a short internal memo about hybrid work',
    items: [
      ['Memo: "From May, staff work from the office on Tuesdays and Thursdays." Question: How many office days are required?', 'Two (Tuesday and Thursday).'],
      ['True or false: "The memo says staff choose their own office days."', 'False. The days are fixed.'],
      ['Find a word in the memo that means "starting from".', 'From'],
    ],
    mistakes: [
      ['Answering from general knowledge, not the text.', 'Quote the line that supports the answer.', 'Ask for the evidence line in every answer.'],
      ['Translating every word before answering.', 'Skim first, then read for detail.', 'Practise a timed first read.'],
    ],
  },
  'writing': {
    topic: 'Writing', level: 'B2',
    context: 'professional emails and short reports',
    items: [
      ['Rewrite more politely: "I need the data today."', 'Could you send me the data by the end of today?'],
      ['Join with a linker: "The project is late. The budget is fine."', 'Although the project is late, the budget is fine.'],
      ['Choose the right closing for a client: "Cheers" / "Kind regards"', 'Kind regards'],
    ],
    mistakes: [
      ['Long sentences joined with comma splices.', 'Split into two sentences or use a linker.', 'Mark comma splices in every draft.'],
      ['I am writing to you because of I want to ask.', "I'm writing to ask about...", 'Use fixed email openings.'],
    ],
  },
  'speaking': {
    topic: 'Speaking', level: 'B1',
    context: 'small talk and meeting contributions',
    items: [
      ['Give a polite interruption phrase for a meeting.', 'Sorry to interrupt, could I add something here?'],
      ['Respond naturally: "How was your weekend?"', 'Pretty good, thanks. We went hiking. How about yours?'],
      ['Give a phrase to buy time before answering.', "That's a good question. Let me think for a second."],
    ],
    mistakes: [
      ['One-word answers in small talk.', 'Answer, add one detail, ask back.', 'Practise the answer, detail, question pattern.'],
      ['I am agree.', 'I agree.', 'agree is a verb, not an adjective.'],
    ],
  },
  'listening': {
    topic: 'Listening', level: 'B1',
    context: 'a voicemail from a client',
    items: [
      ['Voicemail: "Hi, it\'s Mark from Delta. Can we move Thursday\'s call to Friday at 2?" Question: What does Mark want?', 'To move the call from Thursday to Friday at 2.'],
      ['What day was the call originally?', 'Thursday'],
      ['Write a one-line reply.', 'Hi Mark, Friday at 2 works for me. See you then.'],
    ],
    mistakes: [
      ['Missing numbers and times in fast speech.', 'Write down numbers on a first listen.', 'Train note-taking for times, prices and dates.'],
      ['Mishearing can and can\'t.', 'Listen for stress: can\'t is stressed and longer.', 'Drill weak and strong forms.'],
    ],
  },
  'exam': {
    topic: 'Exam preparation (Cambridge, IELTS)', level: 'B2',
    context: 'adult candidates preparing for work or migration',
    items: [
      ['Key word transformation: "I haven\'t seen her for years." (LAST) "It ____ her."', 'is years since I last saw'],
      ['IELTS Task 2 opener: rewrite "In this essay I will talk about" more academically.', 'This essay will examine...'],
      ['Choose the correct word: "The number of applicants has risen ____ (by / of) 15%."', 'by'],
    ],
    mistakes: [
      ['Memorised essay templates.', 'Answer the exact question with own examples.', 'Examiners penalise off-topic templates.'],
      ['Ignoring the word limit.', 'Count words in timed practice.', 'Train within the real time limit.'],
    ],
  },
};

const LEVEL_PACKS = {
  A1: ['Introducing yourself at a new job', [
    ['Complete: "Hi, I ____ Marta. I work in sales."', "'m"],
    ['Complete: "Where ____ you from?"', 'are'],
    ['Complete: "I ____ (start) work at 8."', 'start'],
  ], [["I have 30 years.", "I'm 30.", 'Age uses be, not have.'], ['She don\'t like coffee.', "She doesn't like coffee.", 'Third person uses does.']]],
  A2: ['Booking a hotel and describing last week', [
    ['Complete: "I ____ (book) a room for two nights."', 'booked'],
    ['Complete: "Is breakfast ____ in the price?"', 'included'],
    ['Complete: "We ____ (not / have) time for lunch yesterday."', "didn't have"],
  ], [["I didn't went.", "I didn't go.", 'Base form after didn\'t.'], ['Can I pay with card?', 'Can I pay by card?', 'Payment method uses by.']]],
  B1: ['Project updates and experience', [
    ['Complete: "We ____ (finish) phase one, so we can start testing."', "'ve finished"],
    ['Complete: "If the client ____ (agree), we will start in May."', 'agrees'],
    ['Complete: "I\'m responsible ____ supplier contracts."', 'for'],
  ], [['I live here since 2020.', "I've lived here since 2020.", 'since needs a perfect form.'], ['We discussed about it.', 'We discussed it.', 'discuss takes a direct object.']]],
  B2: ['Negotiating and reporting', [
    ['Complete: "Had we known earlier, we ____ (change) the plan."', 'would have changed'],
    ['Complete: "The supplier told us they ____ (deliver) on Monday."', 'would deliver'],
    ['Complete: "I look forward to ____ (work) with you."', 'working'],
  ], [['He said me that...', 'He told me that...', 'tell takes a personal object.'], ['I suggest you to wait.', 'I suggest waiting.', 'suggest does not take object plus infinitive.']]],
  C1: ['Persuasion and nuance in leadership talk', [
    ['Rewrite with inversion: "We have never faced such a tight deadline."', 'Never have we faced such a tight deadline.'],
    ['Soften: "Your plan is wrong."', "I'm not entirely convinced the plan will work as it stands."],
    ['Complete: "The results were, ____ to say, disappointing." (needless / useless)', 'needless'],
  ], [['Overusing very and really.', 'Use precise adjectives: crucial, marginal, considerable.', 'C1 range shows in word choice.'], ['Direct criticism in feedback.', 'Hedge: I wonder whether, it might be worth.', 'Diplomacy markers matter at this level.']]],
  C2: ['Precision in high-stakes communication', [
    ['Replace the vague phrase: "The figures went up a lot."', 'The figures rose sharply / surged.'],
    ['Choose the idiom: "We need to ____ the bullet and cut costs." (bite / take)', 'bite'],
    ['Rewrite more concisely: "Due to the fact that sales fell, we made the decision to pause hiring."', 'Because sales fell, we paused hiring.'],
  ], [['Near-synonym misuse (affect / effect, imply / infer).', 'Check the exact collocation.', 'Precision errors remain at C2.'], ['Wordy nominal style.', 'Prefer verbs to noun phrases.', 'Concision signals mastery.']]],
};

for (const [level, [context, items, mistakes]] of Object.entries(LEVEL_PACKS)) {
  PSEO_PACKS[`level-${level.toLowerCase()}`] = { topic: `${level} level practice`, level, context, items, mistakes };
}

/** Root pSEO page -> topic pack. Every indexable root .html page in the sitemap must be listed. */
export const PSEO_PAGE_PACKS = {
  'a1-beginner-english-worksheets.html': 'level-a1',
  'a2-elementary-english-worksheets.html': 'level-a2',
  'b1-intermediate-english-worksheets.html': 'level-b1',
  'b2-upper-intermediate-english-worksheets.html': 'level-b2',
  'c1-advanced-english-worksheets.html': 'level-c1',
  'c2-proficiency-english-worksheets.html': 'level-c2',
  'adult-business-english-lesson-prep.html': 'business',
  'ai-grading-tool-for-english-homework.html': 'mixed-review',
  'ai-lesson-planning-for-english-teachers.html': 'mixed-review',
  'ai-tools-for-private-english-tutors.html': 'mixed-review',
  'ai-worksheet-generator-for-english-teachers.html': 'present-perfect',
  'articles-a-an-the-worksheets.html': 'articles',
  'best-ai-tools-for-esl-teachers.html': 'mixed-review',
  'business-english-worksheet-generator.html': 'business',
  'cefr-progress-tracker-english-students.html': 'level-b1',
  'cefr-worksheet-generator.html': 'level-b2',
  'chatgpt-alternative-for-english-tutors.html': 'mixed-review',
  'comparatives-superlatives-worksheets.html': 'comparatives',
  'conditionals-worksheets-english.html': 'conditionals',
  'editable-esl-worksheet-generator.html': 'prepositions',
  'edooqoo-vs-busyteacher.html': 'mixed-review',
  'edooqoo-vs-chatgpt.html': 'mixed-review',
  'edooqoo-vs-twee.html': 'mixed-review',
  'english-placement-test-for-private-tutors.html': 'level-b1',
  'english-tutor-calendar-booking-software.html': 'mixed-review',
  'english-worksheets-for-adults.html': 'business',
  'english-worksheets-for-corporate-training.html': 'business',
  'english-worksheets-for-exam-prep.html': 'exam',
  'environment-climate-english-worksheets.html': 'environment',
  'esl-homework-grading-tool.html': 'mixed-review',
  'esl-student-progress-tracking-tool.html': 'mixed-review',
  'exam-preparation-worksheets-cambridge-ielts.html': 'exam',
  'fill-in-the-blanks-worksheet-generator.html': 'gerunds',
  'food-and-cooking-english-worksheets.html': 'food',
  'future-tenses-worksheets-english.html': 'future',
  'gerunds-infinitives-worksheets.html': 'gerunds',
  'grammar-worksheet-generator.html': 'passive',
  'health-and-body-english-worksheets.html': 'health',
  'how-to-create-english-worksheets-with-ai.html': 'modals',
  'how-to-save-time-as-english-teacher.html': 'mixed-review',
  'job-interview-english-worksheets.html': 'job-interview',
  'listening-activities-esl-worksheets.html': 'listening',
  'listening-comprehension-exercises-esl.html': 'listening',
  'modal-verbs-worksheets-esl.html': 'modals',
  'multiple-choice-quiz-generator-english.html': 'comparatives',
  'one-minute-prep-for-english-tutors.html': 'mixed-review',
  'one-to-one-english-lesson-planner.html': 'mixed-review',
  'online-english-teaching-tools.html': 'speaking',
  'online-esl-homework-tool.html': 'mixed-review',
  'passive-voice-worksheets-esl.html': 'passive',
  'past-simple-worksheets.html': 'past-simple',
  'phrasal-verbs-worksheets-esl.html': 'phrasal',
  'prepositions-worksheets-english.html': 'prepositions',
  'present-perfect-worksheets.html': 'present-perfect',
  'present-simple-worksheets.html': 'present-simple',
  'private-english-tutor-crm.html': 'mixed-review',
  'public-esl-worksheet-examples.html': 'reported-speech',
  'question-tags-worksheets.html': 'question-tags',
  'reading-activities-english-worksheets.html': 'reading',
  'reading-comprehension-worksheet-maker.html': 'reading',
  'relative-clauses-worksheets.html': 'relative-clauses',
  'reported-speech-worksheets.html': 'reported-speech',
  'spaced-repetition-flashcards-esl.html': 'vocabulary',
  'speaking-activities-esl-worksheets.html': 'speaking',
  'student-hub-for-english-tutors.html': 'mixed-review',
  'technology-english-worksheets.html': 'technology',
  'travel-english-worksheets.html': 'travel',
  'vocabulary-exercise-generator.html': 'vocabulary',
  'writing-worksheets-esl.html': 'writing',
};
