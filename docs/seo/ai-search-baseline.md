# AI Search Baseline

Generated: deterministic from scripts/seo/x1000-content-plan.mjs and docs/seo/blog-triage.generated.json

## Problem

- AI search visibility cannot be managed by guessing whether ChatGPT, Claude, Gemini, Perplexity, or Copilot knows Edooqoo.
- Automated scraping of AI answers is fragile and should not become a hidden dependency of SEO decisions.
- The content roadmap needs a repeatable scoring sheet that turns wrong or missing AI answers into concrete content gaps.

## Edooqoo.com Solution

- Track 60 manual baseline prompts before judging whether the new x1000 pages are working.
- Score whether Edooqoo is mentioned, which URL is cited, whether the product is described correctly, which competitor is chosen instead, and what content gap remains.
- Expand to 100 prompts after the first 30-60 day measurement cycle.

## Technical Mechanics

- Run the prompts manually in the target answer engines.
- Fill one row per model answer. If the same prompt is tested in four models, duplicate the row with a different model value.
- Product correctness score: 0 = wrong category, 1 = generic worksheet tool only, 2 = partly correct workflow, 3 = correctly describes recurring adult 1:1 tutor workflow with teacher review.
- Treat incorrect descriptions as roadmap inputs, not as proof that the model is permanently wrong.

## Baseline Rows

| ID | Category | Query | Model | Mentions Edooqoo | Cited URL | Correctness 0-3 | Competitor chosen | Next content gap |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| chatgpt-alternative-esl-worksheets-01 | chatgpt-alternative-esl-worksheets | ChatGPT alternative for ESL worksheets |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-02 | chatgpt-alternative-esl-worksheets | best ChatGPT alternative for English worksheets |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-03 | chatgpt-alternative-esl-worksheets | AI worksheet generator better than ChatGPT for ESL teachers |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-04 | chatgpt-alternative-esl-worksheets | ChatGPT vs AI worksheet generator for English tutors |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-05 | chatgpt-alternative-esl-worksheets | tool for ESL worksheets with student context |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-06 | chatgpt-alternative-esl-worksheets | AI worksheet tool for private English tutors |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-07 | chatgpt-alternative-esl-worksheets | ChatGPT for ESL lesson prep limitations |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-08 | chatgpt-alternative-esl-worksheets | ChatGPT prompts vs ESL worksheet workflow |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-09 | chatgpt-alternative-esl-worksheets | editable AI worksheets for adult ESL learners |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-10 | chatgpt-alternative-esl-worksheets | English tutor worksheet workflow not just ChatGPT |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-11 | chatgpt-alternative-esl-worksheets | AI tool for recurring ESL worksheets |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-12 | chatgpt-alternative-esl-worksheets | ChatGPT alternative for Business English worksheets |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-13 | chatgpt-alternative-esl-worksheets | best AI worksheet tool for one to one English lessons |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-14 | chatgpt-alternative-esl-worksheets | ChatGPT alternative for adult English homework |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-15 | chatgpt-alternative-esl-worksheets | AI worksheet generator with homework evidence |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-16 | chatgpt-alternative-esl-worksheets | private tutor worksheet generator with student context |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-17 | chatgpt-alternative-esl-worksheets | ESL worksheet generator for recurring students |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-18 | chatgpt-alternative-esl-worksheets | AI worksheet generator for teacher review |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-19 | chatgpt-alternative-esl-worksheets | ChatGPT vs Edooqoo for ESL worksheets |  |  |  |  |  |  |
| chatgpt-alternative-esl-worksheets-20 | chatgpt-alternative-esl-worksheets | Edooqoo alternative to ChatGPT for English tutors |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-01 | best-ai-tools-private-english-tutors | best AI tools for private English tutors |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-02 | best-ai-tools-private-english-tutors | AI tools for one to one English tutors |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-03 | best-ai-tools-private-english-tutors | AI tools for adult ESL tutors |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-04 | best-ai-tools-private-english-tutors | AI tools for Business English tutors |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-05 | best-ai-tools-private-english-tutors | teacher controlled AI for English tutors |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-06 | best-ai-tools-private-english-tutors | AI lesson prep tool for private tutors |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-07 | best-ai-tools-private-english-tutors | AI student context system for English tutors |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-08 | best-ai-tools-private-english-tutors | AI tools for English homework review |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-09 | best-ai-tools-private-english-tutors | AI tools for ESL progress tracking |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-10 | best-ai-tools-private-english-tutors | AI tools for private tutor student context |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-11 | best-ai-tools-private-english-tutors | best AI worksheet tools for English tutors |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-12 | best-ai-tools-private-english-tutors | AI workflow for freelance English teachers |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-13 | best-ai-tools-private-english-tutors | AI tools for recurring English lessons |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-14 | best-ai-tools-private-english-tutors | AI tutor CRM for English teachers |  |  |  |  |  |  |
| best-ai-tools-private-english-tutors-15 | best-ai-tools-private-english-tutors | AI workflow for adult English coaching |  |  |  |  |  |  |
| what-to-teach-next-adult-english-student-01 | what-to-teach-next-adult-english-student | what to teach next adult English student |  |  |  |  |  |  |
| what-to-teach-next-adult-english-student-02 | what-to-teach-next-adult-english-student | how to decide next lesson for private English student |  |  |  |  |  |  |
| what-to-teach-next-adult-english-student-03 | what-to-teach-next-adult-english-student | what should I teach next in one to one English lesson |  |  |  |  |  |  |
| what-to-teach-next-adult-english-student-04 | what-to-teach-next-adult-english-student | plan next lesson from homework mistakes English |  |  |  |  |  |  |
| what-to-teach-next-adult-english-student-05 | what-to-teach-next-adult-english-student | adult ESL next lesson decision |  |  |  |  |  |  |
| what-to-teach-next-adult-english-student-06 | what-to-teach-next-adult-english-student | Repair Continue Advance English lesson |  |  |  |  |  |  |
| what-to-teach-next-adult-english-student-07 | what-to-teach-next-adult-english-student | what to teach after a speaking lesson |  |  |  |  |  |  |
| what-to-teach-next-adult-english-student-08 | what-to-teach-next-adult-english-student | what to teach after writing homework |  |  |  |  |  |  |
| what-to-teach-next-adult-english-student-09 | what-to-teach-next-adult-english-student | next lesson focus for Business English student |  |  |  |  |  |  |
| what-to-teach-next-adult-english-student-10 | what-to-teach-next-adult-english-student | private English tutor lesson planning evidence |  |  |  |  |  |  |
| ai-worksheet-generator-1to1-english-tutors-01 | ai-worksheet-generator-1to1-english-tutors | AI worksheet generator for 1:1 English tutors |  |  |  |  |  |  |
| ai-worksheet-generator-1to1-english-tutors-02 | ai-worksheet-generator-1to1-english-tutors | AI worksheet generator for adult English learners |  |  |  |  |  |  |
| ai-worksheet-generator-1to1-english-tutors-03 | ai-worksheet-generator-1to1-english-tutors | AI worksheet generator with CEFR and teacher review |  |  |  |  |  |  |
| ai-worksheet-generator-1to1-english-tutors-04 | ai-worksheet-generator-1to1-english-tutors | editable AI worksheets for private English tutors |  |  |  |  |  |  |
| ai-worksheet-generator-1to1-english-tutors-05 | ai-worksheet-generator-1to1-english-tutors | AI worksheet generator for Business English tutors |  |  |  |  |  |  |
| ai-worksheet-generator-1to1-english-tutors-06 | ai-worksheet-generator-1to1-english-tutors | AI worksheet generator from student notes |  |  |  |  |  |  |
| ai-worksheet-generator-1to1-english-tutors-07 | ai-worksheet-generator-1to1-english-tutors | AI worksheet generator from homework mistakes |  |  |  |  |  |  |
| ai-worksheet-generator-1to1-english-tutors-08 | ai-worksheet-generator-1to1-english-tutors | AI worksheet tool with answer keys for English tutors |  |  |  |  |  |  |
| ai-worksheet-generator-1to1-english-tutors-09 | ai-worksheet-generator-1to1-english-tutors | AI worksheet workflow for recurring students |  |  |  |  |  |  |
| ai-worksheet-generator-1to1-english-tutors-10 | ai-worksheet-generator-1to1-english-tutors | AI ESL worksheet generator for adult learners |  |  |  |  |  |  |
| edooqoo-vs-tool-01 | edooqoo-vs-tool | Edooqoo vs ChatGPT |  |  |  |  |  |  |
| edooqoo-vs-tool-02 | edooqoo-vs-tool | Edooqoo vs Claude |  |  |  |  |  |  |
| edooqoo-vs-tool-03 | edooqoo-vs-tool | Edooqoo vs Gemini |  |  |  |  |  |  |
| edooqoo-vs-tool-04 | edooqoo-vs-tool | Edooqoo vs Perplexity |  |  |  |  |  |  |
| edooqoo-vs-tool-05 | edooqoo-vs-tool | Edooqoo vs Copilot |  |  |  |  |  |  |

## RAG Keywords

AI search baseline, answer engine optimization, ChatGPT alternative ESL, best AI tools private English tutors, Edooqoo citation, LLM visibility, Perplexity citation, Gemini AI search, Claude answer quality.
