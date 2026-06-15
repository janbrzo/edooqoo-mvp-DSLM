export const DECISIONS = ['Repair', 'Continue', 'Advance'];
export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const GOALS = {
  'workplace-speaking': 'workplace speaking',
  'business-writing': 'business writing',
  'travel-communication': 'travel communication',
  'job-interview': 'job interview performance',
  'exam-performance': 'exam performance',
  'general-communication': 'general communication',
};

export const MASTERY = {
  insufficient: 'There is not enough evidence yet',
  'not-mastered': 'The previous objective was not mastered',
  partial: 'The learner showed partial control',
  secure: 'The learner met the objective accurately',
};

export const INDEPENDENCE = {
  'no-evidence': 'Independent use has not been observed',
  supported: 'The learner succeeds with prompts or support',
  independent: 'The learner succeeds independently',
};

export const RECURRING_ERRORS = {
  blocking: 'A recurring error blocks the communication goal',
  'non-blocking': 'A recurring error remains but does not block the goal',
  none: 'No recurring target error is established',
};

export const HOMEWORK_RESULTS = {
  'not-assigned': 'No relevant homework evidence',
  incomplete: 'Homework was incomplete',
  mixed: 'Homework showed mixed control',
  successful: 'Homework was completed successfully',
};

export const UPCOMING_SITUATIONS = {
  none: 'No immediate external event',
  'work-meeting': 'A work meeting or presentation',
  'business-writing': 'A business writing task',
  interview: 'A job interview',
  travel: 'A travel situation',
  exam: 'An exam task',
};

const OPTION_SETS = {
  level: new Set(CEFR_LEVELS),
  goal: new Set(Object.keys(GOALS)),
  mastery: new Set(Object.keys(MASTERY)),
  independence: new Set(Object.keys(INDEPENDENCE)),
  recurringError: new Set(Object.keys(RECURRING_ERRORS)),
  homework: new Set(Object.keys(HOMEWORK_RESULTS)),
  upcoming: new Set(Object.keys(UPCOMING_SITUATIONS)),
};

export const DEFAULT_DECISION_INPUT = {
  level: 'B2',
  goal: 'workplace-speaking',
  mastery: 'insufficient',
  independence: 'no-evidence',
  recurringError: 'none',
  homework: 'not-assigned',
  upcoming: 'none',
};

function validateInput(input) {
  const normalized = { ...DEFAULT_DECISION_INPUT, ...input };
  for (const [key, allowed] of Object.entries(OPTION_SETS)) {
    if (!allowed.has(normalized[key])) {
      throw new Error(`Invalid decision input: ${key}`);
    }
  }
  return normalized;
}

export function decideNextLesson(input) {
  const normalized = validateInput(input);
  const goalLabel = GOALS[normalized.goal];
  const upcomingLabel = UPCOMING_SITUATIONS[normalized.upcoming];

  let decision = 'Continue';
  if (normalized.mastery === 'not-mastered' || normalized.recurringError === 'blocking') {
    decision = 'Repair';
  } else if (
    normalized.mastery === 'secure'
    && normalized.independence === 'independent'
    && normalized.recurringError === 'none'
  ) {
    decision = 'Advance';
  }

  const rationaleByDecision = {
    Repair: `Repair the blocking gap before adding complexity. ${MASTERY[normalized.mastery]}; ${RECURRING_ERRORS[normalized.recurringError].toLowerCase()}.`,
    Continue: `Keep the current objective, but change the evidence task or reduce support. ${MASTERY[normalized.mastery]}; ${INDEPENDENCE[normalized.independence].toLowerCase()}.`,
    Advance: `Advance because the previous objective is accurate, independent, and free from an established recurring target error.`,
  };

  const objectiveByDecision = {
    Repair: `At ${normalized.level}, the learner will repair one blocking feature of ${goalLabel} and demonstrate it accurately in a short realistic task.`,
    Continue: `At ${normalized.level}, the learner will complete the current ${goalLabel} objective with less support and produce one observable independent performance.`,
    Advance: `At ${normalized.level}, the learner will transfer secure ${goalLabel} performance to a less predictable task with one added constraint.`,
  };

  const situationLine = normalized.upcoming === 'none'
    ? 'Use a realistic adult scenario connected to the learner goal.'
    : `Use ${upcomingLabel.toLowerCase()} as the final transfer task.`;

  const homeworkLine = {
    'not-assigned': 'Start with a short retrieval check because no homework evidence is available.',
    incomplete: 'Diagnose the reason for incomplete homework before treating it as a language failure.',
    mixed: 'Use the mixed homework items to select one narrow teaching target.',
    successful: 'Do not repeat successful homework mechanically; test transfer in a new context.',
  }[normalized.homework];

  const activitySequence = {
    Repair: [
      'Run a two-minute diagnostic example to isolate the blocking feature.',
      'Contrast one successful and one unsuccessful performance.',
      'Rehearse the corrected feature in a bounded adult communication task.',
      'Repeat the task with one variable changed and no corrective prompt.',
    ],
    Continue: [
      'Retrieve the previous objective without showing the original model.',
      'Provide one focused prompt only where the evidence shows partial control.',
      'Complete a realistic adult task with reduced scaffolding.',
      'Repeat the critical section independently and compare the evidence.',
    ],
    Advance: [
      'Confirm the previous objective with one brief retrieval task.',
      'Introduce one new constraint, listener need, or time pressure.',
      'Complete a realistic transfer task without a full script.',
      'Reflect on which language remained stable when conditions changed.',
    ],
  }[decision];

  return {
    decision,
    rationale: `${rationaleByDecision[decision]} ${homeworkLine}`,
    lessonObjective: objectiveByDecision[decision],
    activitySequence: [...activitySequence.slice(0, 3), situationLine, activitySequence[3]],
    worksheetBrief: `Create a one-page ${normalized.level} worksheet for an adult 1:1 learner. Target ${goalLabel}. Include one evidence-led diagnostic item, one focused practice block, one realistic transfer task, and a compact tutor observation box. Do not include school-style rewards, childish contexts, or unrelated grammar coverage.`,
    evidenceToCollect: [
      'Accuracy on the exact target under realistic conditions.',
      'Whether the learner succeeds independently or still needs a prompt.',
      'Whether the same error recurs and whether it blocks the communication goal.',
      'One concrete signal that supports Repair, Continue, or Advance next time.',
    ],
  };
}

export function serializeDecisionInput(input) {
  const normalized = validateInput(input);
  const params = new URLSearchParams();
  for (const key of Object.keys(OPTION_SETS)) params.set(key, normalized[key]);
  return params.toString();
}

export function parseDecisionInput(search) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const candidate = {};
  for (const [key, allowed] of Object.entries(OPTION_SETS)) {
    const value = params.get(key);
    if (value && allowed.has(value)) candidate[key] = value;
  }
  return validateInput(candidate);
}
