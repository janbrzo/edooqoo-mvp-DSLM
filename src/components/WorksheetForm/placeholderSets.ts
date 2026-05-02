
export interface PlaceholderSet {
  lessonTopic: string;
  lessonFocus: string;
  additionalInformation: string;
  grammarFocus: string;
}

export const PLACEHOLDER_SETS: PlaceholderSet[] = [
  {
    lessonTopic: "Preparing for a job interview at Amazon for a logistics specialist role",
    lessonFocus: "Answer difficult questions about past experience and gaps in the CV",
    additionalInformation: "Student: Daniel [34], interview on Monday in Wrocław. He's nervous about explaining a 2‑year career break after moving countries and raising his daughter.",
    grammarFocus: "Present Perfect"
  },
  {
    lessonTopic: "Travelling to Boston with a toddler for the first time",
    lessonFocus: "Communicate with airport staff and ask for help in case of delays or problems",
    additionalInformation: "Student: Emily [29], flying alone with her 2-year-old son next Friday. Worried about managing hand luggage, boarding, and asking for warm water during the flight.",
    grammarFocus: "Future Forms"
  },
  {
    lessonTopic: "Making small talk with new coworkers during coffee breaks",
    lessonFocus: "Join casual conversations, respond naturally, and avoid awkward silences",
    additionalInformation: "Student: Mike [41], started working at Deloitte Kraków last month. Wants to feel more confident when chatting informally in the kitchen.",
    grammarFocus: "Adverbs of Frequency"
  },
  {
    lessonTopic: "Talking to a teacher at a parent-teacher meeting in London",
    lessonFocus: "Ask specific questions about the child's progress and explain concerns clearly",
    additionalInformation: "Student: Laura [38], her son Oliver is struggling with reading. She needs to talk to Ms. Edwards at Kingsway Primary this Thursday.",
    grammarFocus: "Present Simple"
  },
  {
    lessonTopic: "Solving a delivery issue with a missing IKEA order by phone",
    lessonFocus: "Describe the problem clearly, stay polite, and insist on a solution",
    additionalInformation: "Student: James [45], ordered furniture online but received the wrong items. Wants to call IKEA support and get a replacement before next week.",
    grammarFocus: "Conditionals (0 and 1st)"
  }
];

export const getRandomPlaceholderSet = (): PlaceholderSet => {
  const randomIndex = Math.floor(Math.random() * PLACEHOLDER_SETS.length);
  return PLACEHOLDER_SETS[randomIndex];
};
