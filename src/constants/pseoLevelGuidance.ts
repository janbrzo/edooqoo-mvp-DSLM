/**
 * Per-CEFR-level teaching guidance for programmatic SEO topic-level pages.
 * Purpose: give every /esl-worksheets/{topic}/{level} page genuinely level-specific
 * substance (adult 1:1 focus), so pages for two levels of the same topic are not
 * near-duplicates of each other. Content follows the Martha Standard: adult,
 * andragogical, zero school-textbook framing.
 */

export interface PseoLevelGuidance {
  cefr: string;
  focus: string;
  taskDesign: string;
  pitfall: string;
}

export const PSEO_LEVEL_GUIDANCE: Record<string, PseoLevelGuidance> = {
  A1: {
    cefr: 'A1',
    focus:
      'Survival communication: introducing oneself, exchanging basic personal information, and handling simple routine exchanges at work and in daily life.',
    taskDesign:
      'One structure at a time, short closed tasks, heavy scaffolding, and high-frequency chunks the learner can reuse verbatim in the next lesson.',
    pitfall:
      'Overloading the worksheet with grammar terminology. An A1 adult needs usable phrases and clear models, not metalanguage about the language.',
  },
  A2: {
    cefr: 'A2',
    focus:
      'Connected survival narration: describing past events, plans, and routines in simple linked sentences, for example reporting a weekend trip or a completed work task.',
    taskDesign:
      'Guided personalization after each controlled task: the learner reuses the target structure to talk about their own job, family, or week.',
    pitfall:
      'Correcting every error at once. At A2 the tutor picks the one structure that blocks communication and lets the rest go until later.',
  },
  B1: {
    cefr: 'B1',
    focus:
      'Opinions and reasons: handling familiar work and social situations, giving short explanations, and managing the main points of a conversation without preparation.',
    taskDesign:
      'Controlled practice that moves quickly into freer production, with error correction focused on the target structure rather than every slip.',
    pitfall:
      'Treating B1 as school intermediate. Generic topics and gap-fills about fictional teenagers waste an adult professional’s time; anchor every task in their real context.',
  },
  B2: {
    cefr: 'B2',
    focus:
      'Argumentation and register: presenting a viewpoint, hedging claims, and shifting tone between a client email, a team meeting, and small talk.',
    taskDesign:
      'Authentic-material tasks with precision work: the learner drafts, the tutor marks register and accuracy issues, and the learner self-corrects a second version.',
    pitfall:
      'Adding more input instead of refining output. B2 progress comes from tightening what the learner already produces, not from another reading text.',
  },
  C1: {
    cefr: 'C1',
    focus:
      'Nuance and implicit meaning: reading between the lines in negotiations, adjusting style for different audiences, and using idiomatic language precisely.',
    taskDesign:
      'Discourse-level tasks: reformulation, summarizing a complex position, and rewriting the same message for two different audiences.',
    pitfall:
      'Neglecting register and pronunciation because grammar is mostly accurate. At C1 the remaining gains are stylistic, not structural.',
  },
  C2: {
    cefr: 'C2',
    focus:
      'Mastery of register and rhetoric: humor, understatement, persuasive framing, and domain-specific argumentation at near-native level.',
    taskDesign:
      'Native-level authentic tasks with critique: the learner produces a real deliverable (a talk, an op-ed, a board summary) and the tutor reviews it line by line.',
    pitfall:
      'Assuming no syllabus is needed. C2 learners still stall without a plan; the plan just operates on style, precision, and domain vocabulary.',
  },
};

export const getLevelGuidance = (cefr: string): PseoLevelGuidance | undefined =>
  PSEO_LEVEL_GUIDANCE[cefr];
