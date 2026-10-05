// Shared writing-style rule appended to system prompts of AI features that produce English prose.
// Not used by the Worksheet Generation Engine (generateWorksheet, format-worksheet-prompt).
export const NO_EM_DASH_RULE =
  "\n\nSTYLE RULE: Never use em dashes (the long dash character) in any text you write. " +
  "Use a comma, colon, parentheses, a period or a new sentence instead.";
