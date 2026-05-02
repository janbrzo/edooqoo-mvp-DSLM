/**
 * Shared FAQ items used across Pricing page and PricingSection component
 * Single source of truth for all FAQ content
 */

export interface FaqItem {
  question: string;
  answer: string;
}

export const faqItems: FaqItem[] = [
  {
    question: "Do I need to be logged in to generate worksheets?",
    answer: "No, you can try the worksheet generator without logging in (demo mode). However, to save worksheets and access all features, you need to create an account. When you sign up, you get 2 free tokens to start creating worksheets immediately."
  },
  {
    question: "What happens when I run out of tokens?",
    answer: "When you have no tokens or monthly worksheets left, you can either upgrade to a subscription plan for monthly worksheets or purchase additional tokens. The system first uses your monthly allowance, then uses available tokens."
  },
  {
    question: "How does the upgrade/downgrade system work?",
    answer: "You can upgrade anytime and pay only the prorated difference. For downgrades, the change takes effect at your next billing cycle. All unused monthly worksheets automatically roll over as tokens so you never lose them."
  },
  {
    question: "What are rollover tokens and how do they work?",
    answer: "Unused monthly worksheets automatically convert to rollover tokens at the end of your billing cycle. These tokens are used after your purchased tokens but before new monthly worksheets. This ensures you never lose unused worksheets!"
  },
  {
    question: "What is Share Interactive Worksheet?",
    answer: "You can share any worksheet with students via a secure permanent link (auto-generated at creation). Students can open it in their browser, fill in answers interactively, and you can see their responses in real-time or review them later. Students can also access all their shared worksheets through the Student Hub portal. Perfect for remote teaching!"
  },
  {
    question: "What is Live Session mode?",
    answer: "Live Session mode allows you to conduct real-time lessons. You can see all students' answers as they type, add exercises on-the-fly (up to 12 per session), and view nano-skill mastery ratings per exercise. AI evaluation assists with scoring open-ended exercises like paraphrasing and discussion questions, making it perfect for online group classes or tutoring sessions."
  },
  {
    question: "How do Flashcards work?",
    answer: "Add vocabulary to flashcards by clicking the + button on individual words in the Vocabulary Sheet, using 'Add All to Flashcards' button, or by selecting words directly on the worksheet. You can also add words manually in the student's Flashcard panel. Students study using the spaced repetition system (SM-2 algorithm) for effective learning. Students can also browse and study their flashcards independently through the Student Hub portal."
  },
  {
    question: "What is Student Knowledge tracking?",
    answer: "Student Knowledge lets you record important notes about each student - their strengths, weaknesses, interests, and preferences. This information is automatically fed to the AI when generating worksheets, creating more personalized and relevant content for each student."
  },
  {
    question: "How does Homework Assignments work?",
    answer: "You can assign any worksheet or specific exercises as homework. Set deadlines, send email notifications to students, track completion status, and add teacher comments. Students can complete homework interactively online — either through the direct link or via the Student Hub portal. AI automatically evaluates open-ended answers and pre-fills mastery scores for teacher review."
  },
  {
    question: "Can I draw on worksheets?",
    answer: "Yes! The Draw on Worksheet feature lets you annotate worksheets during lessons - highlight text, circle answers, draw diagrams. Your drawings are saved and can be exported with the worksheet."
  },
  {
    question: "What file formats can I download?",
    answer: "You can download worksheets as HTML files (recommended for best quality) or PDF files. HTML files work offline and preserve all formatting perfectly. All registered users have automatic download access."
  },
  {
    question: "How does student management work?",
    answer: "You can add unlimited students to your account. Each worksheet gets assigned to a specific student, and you can view all worksheets created for each student. You can send each student a Welcome Test to assess their level, and the AI creates a detailed Learning Profile with strengths, weaknesses, and a recommended Learning Path. Student selection is required when generating worksheets."
  },
  {
    question: "What exercise types are available?",
    answer: "We offer 29 exercise types organized in 3 categories:\n\n📝 **Basic Exercises (20 types):** Reading Comprehension, Fill in the Blanks, Multiple Choice, True/False Questions, Matching Exercise, Dialogue Practice, Answer Questions, Discussion Questions, Error Correction, Odd One Out, Matching Halves, Word Order, Gap Text (Cloze), Negative Prefixes, Categorization, Complete Word, Paraphrasing, Sentence Transformation, Synonyms Matching, and Antonyms Matching.\n\n🎧 **Audio Exercises (5 types):** Listening Comprehension, Fill in the Blanks (Audio), Multiple Choice (Audio), True/False (Audio), and Answer Questions (Audio).\n\n🖼️ **Picture Exercises (4 types):** Describe Picture, Multiple Choice (Picture), True/False (Picture), and Answer Questions (Picture).\n\nAll exercise types are available on all plans including the Free Demo."
  },
  {
    question: "How long does worksheet generation take?",
    answer: "Worksheet generation typically takes 30-60 seconds. The AI creates custom content based on your specifications like English level, lesson topic, learning goals, and student context."
  },
  {
    question: "Can I cancel my subscription anytime?",
    answer: "Yes, you can cancel anytime through the 'Manage Subscription' button in your profile, which opens the Stripe Customer Portal. Your subscription remains active until the end of your current billing period."
  },
  {
    question: "What happens if worksheet generation fails?",
    answer: "If generation fails, you'll see an error message and return to the form with all your input preserved. No tokens are consumed for failed generations, so you can try again without penalty."
  },
  {
    question: "Do you offer refunds or free trials?",
    answer: "We offer 2 free tokens when you sign up to test the service. For subscription refunds, please contact support. You can also start with our Free Demo plan to evaluate the service."
  },
  {
    question: "Is there a limit on students I can manage?",
    answer: "No, there's no limit on the number of students you can add to your account. Student management is available for all registered users at no additional cost."
  },
  {
    question: "What's the difference between tokens and monthly worksheets?",
    answer: "Monthly worksheets are included with subscription plans and reset each billing cycle. Tokens are purchased separately and never expire. The system uses monthly worksheets first, then tokens."
  },
  {
    question: "Can I use the service for commercial purposes?",
    answer: "Yes, all plans support commercial use including private tutoring, language schools, and corporate training. The worksheets you create are yours to use commercially."
  },
  {
    question: "Can I duplicate worksheets?",
    answer: "Yes! You can duplicate any worksheet to create a copy. This is useful when you want to reuse similar content for different students or create variations of the same lesson."
  },
  {
    question: "What is the Student Hub?",
    answer: "The Student Hub is a dedicated portal for your students. Students visit the portal, enter their email, and select their teacher to access a personalized dashboard. From there they can view quick stats, browse shared worksheets, study flashcards with spaced repetition, complete homework assignments, book and manage lessons, and sync with Google Calendar — all without needing a teacher account."
  },
  {
    question: "What is the Welcome Test & Learning Path?",
    answer: "The Welcome Test is an AI-powered 49-question assessment covering grammar, vocabulary, reading, listening, and speaking. After the student completes it, AI analyzes the results to create a detailed Learning Profile with skill scores, strengths, and weaknesses. It also determines one of 4 Learning Paths (Comfort, Guided, Accelerated, or Target) based on 15 behavioral and performance signals. Teachers can preview all questions, review results, and use the profile to generate more personalized worksheets."
  },
  {
    question: "How does Lesson Booking work?",
    answer: "Teachers get a public booking page link to share with students. Students enter their email, browse available time slots, and book lessons — including weekly recurring bookings. Reschedule and cancellation options are configurable by the teacher. The system integrates with Google Calendar for automatic sync and supports Google Meet link auto-generation. Teachers set availability rules, buffer times, booking modes, and slot limits in Calendar Settings."
  },
  {
    question: "How does Student Progress tracking work?",
    answer: "Student skills are tracked at the nano-skill level with CEFR tags across categories: grammar, vocabulary, speaking, listening, reading, and writing. Mastery metrics update automatically from worksheet completions, homework submissions, flashcard reviews, and teacher evaluations. Teachers can view mastery trends (improving, stable, or declining), filter by time period and CEFR level, and get AI-generated suggestions for future worksheets based on skill gaps."
  },
  {
    question: "How does AI Evaluation work?",
    answer: "AI automatically evaluates open-ended student answers — such as sentence transformation, paraphrasing, discussion questions, and descriptions — and pre-fills mastery scores (0-100) for each item. Teachers can review, adjust, and confirm the AI scores. This works across worksheet review, homework submissions, and live sessions, saving significant time on manual evaluation."
  },
  {
    question: "What is Google Calendar integration?",
    answer: "Teachers can connect their Google Calendar to automatically sync lesson bookings, cancellations, and reschedules. Students can also connect their own Google Calendar via the Student Hub. The integration supports Google Meet link auto-generation for online lessons, customizable calendar event colors by status (available, booked, completed, no-show), and configurable sync preferences — all managed in Calendar Settings."
  }
];
