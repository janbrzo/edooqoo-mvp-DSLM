/**
 * Individual exercise functions - each returns its specific exercise JSON fragment
 * EXACT content from original prompt - no changes to text content!
 * NANO_SKILLS updated to Layer B v5 format: ns.[CEFR].[full_topic].[skill_name]
 */

export const getReadingExercise = () => `    {
      "type": "reading",
      "title": "Exercise 1: Reading Comprehension",
      "icon": "fa-book-open",
      "time": 9,
      "instructions": "Read the following text and answer the questions below.",
      "content": "New York City is famous for its restaurants. People from all over the world live there, so the city offers many different types of food. You can find Italian, Chinese, Mexican, Japanese, Greek, Thai, Indian, and many more international cuisines. American-style diners and fast food restaurants are also very popular.\\nMost restaurants in New York have menus that include appetizers, main dishes, and desserts. Appetizers are small dishes that people eat before the main meal, such as soups, salads, or garlic bread. Main dishes are usually bigger and include meat, fish, or vegetarian options, often served with rice, potatoes, or pasta. Desserts like cheesecake, brownies, or ice cream are very common.\\nSome of the most popular types of food in New York include pizza, burgers, sushi, and pasta. People also enjoy trying food from food trucks, especially for lunch. One of the most famous dishes in the United States, and especially in New York, is the New York-style pizza. It's a thin, wide slice of pizza, usually eaten with your hands.\\nOf course, not every restaurant visit is perfect. Some common complaints that people make in New York restaurants include:\\n\\"The food is cold.\\"\\n\\"This is not what I ordered.\\"\\n\\"The portion is too small.\\"\\n\\"I waited too long for my food.\\"\\n\\"The bill is incorrect.\\"\\nLearning how to order food and make polite complaints in English is very useful if you ever visit New York or work in customer service.",
      "questions": [
        {"text": "Why is there such a wide variety of food in New York City restaurants?", "answer": "Because people from all over the world live in New York, so the city offers many different types of international cuisine.", "nano_skill": [{"name": "ns.A2.reading.main_idea_extraction", "confidence": 0.95, "reason": "Requires identifying the main cause-effect relationship from the text"}, {"name": "ns.A2.writing.cause_effect_response", "confidence": 0.90, "reason": "Student must construct a written explanation of causality"}, {"name": "ns.A2.speaking.cause_effect_explanation", "confidence": 0.40, "reason": "Indirect speaking assessment: student explains causality"}]},
        {"text": "What are some typical examples of appetizers, main dishes, and desserts mentioned in the text?", "answer": "Appetizers: soups, salads, garlic bread; Main dishes: meat, fish, or vegetarian options with rice, potatoes, or pasta; Desserts: cheesecake, brownies, ice cream.", "nano_skill": [{"name": "ns.A2.reading.detail_extraction", "confidence": 0.92, "reason": "Requires extracting and grouping specific details from the text"}, {"name": "ns.A2.writing.listing_from_text", "confidence": 0.88, "reason": "Student must organize extracted details into a written list"}, {"name": "ns.A2.speaking.listing_from_text", "confidence": 0.40, "reason": "Indirect speaking assessment: student lists items from text"}]},
        {"text": "What is special about New York-style pizza?", "answer": "It is a thin, wide slice of pizza, usually eaten with your hands.", "nano_skill": [{"name": "ns.A2.reading.detail_extraction", "confidence": 0.92, "reason": "Tests locating specific descriptive details in text"}, {"name": "ns.A2.writing.descriptive_response", "confidence": 0.88, "reason": "Student must write a descriptive answer about a specific item"}, {"name": "ns.A2.speaking.descriptive_response", "confidence": 0.40, "reason": "Indirect speaking assessment: student describes an item"}]},
        {"text": "What are some of the most popular international cuisines in New York?", "answer": "Italian, Chinese, Mexican, Japanese, Greek, Thai, and Indian cuisines.", "nano_skill": [{"name": "ns.A2.reading.detail_extraction", "confidence": 0.92, "reason": "Tests extracting a list of items from text"}, {"name": "ns.A2.writing.listing_from_text", "confidence": 0.88, "reason": "Student must list items extracted from the reading"}, {"name": "ns.A2.speaking.listing_from_text", "confidence": 0.40, "reason": "Indirect speaking assessment: student lists cuisines"}]},
        {"text": "What are some common complaints that customers make in New York restaurants?", "answer": "The food is cold, This is not what I ordered, The portion is too small, I waited too long for my food, and The bill is incorrect.", "nano_skill": [{"name": "ns.A2.reading.detail_extraction", "confidence": 0.92, "reason": "Tests finding and listing complaints from text"}, {"name": "ns.A2.writing.listing_from_text", "confidence": 0.88, "reason": "Student must compile a written list from the reading"}, {"name": "ns.A2.speaking.listing_from_text", "confidence": 0.40, "reason": "Indirect speaking assessment: student lists complaints"}]}
      ],
      "teacher_tip": "Use the comprehension questions as a starting point to ask more personal questions related to your student's life and experiences. Encourage them to share their opinions on the topics and situations mentioned in the text."
    }`;

export const getTrueFalseExercise = () => `    {
      "type": "true-false",
      "title": "Exercise 2: True or False",
      "icon": "fa-balance-scale",
      "time": 5,
      "instructions": "Read each statement about the text and decide if it is true or false.",
      "statements": [
        {"text": "New York City offers many international cuisines because people from all over the world live there.", "isTrue": true, "nano_skill": [{"name": "ns.A2.reading.paraphrase_recognition", "confidence": 0.88, "reason": "Statement paraphrases original text"}]},
        {"text": "American-style diners are not popular in New York.", "isTrue": false, "nano_skill": [{"name": "ns.A2.reading.negation_detection", "confidence": 0.92, "reason": "Requires detecting false negation of stated fact"}]},
        {"text": "Appetizers are usually bigger than main dishes.", "isTrue": false, "nano_skill": [{"name": "ns.A2.reading.detail_verification", "confidence": 0.90, "reason": "Tests verifying size comparison from text"}]},
        {"text": "New York-style pizza is thick and eaten with a fork and knife.", "isTrue": false, "nano_skill": [{"name": "ns.A2.reading.detail_verification", "confidence": 0.90, "reason": "Tests verifying pizza description details"}]},
        {"text": "Food trucks are especially popular for lunch in New York.", "isTrue": true, "nano_skill": [{"name": "ns.A2.reading.detail_verification", "confidence": 0.90, "reason": "Tests confirming stated fact about food trucks"}]},
        {"text": "All restaurant visits in New York are perfect according to the text.", "isTrue": false, "nano_skill": [{"name": "ns.A2.reading.inference_validation", "confidence": 0.88, "reason": "Requires inferring from complaints section that visits are not all perfect"}]},
        {"text": "One common complaint is that the food arrives cold.", "isTrue": true, "nano_skill": [{"name": "ns.A2.reading.detail_verification", "confidence": 0.90, "reason": "Tests confirming specific complaint from list"}]},
        {"text": "Desserts like cheesecake and brownies are common in New York restaurants.", "isTrue": true, "nano_skill": [{"name": "ns.A2.reading.detail_verification", "confidence": 0.90, "reason": "Tests confirming dessert examples from text"}]},
        {"text": "The text mentions that learning to complain politely is useful for customer service work.", "isTrue": true, "nano_skill": [{"name": "ns.A2.reading.paraphrase_recognition", "confidence": 0.88, "reason": "Statement paraphrases conclusion of text"}]},
        {"text": "Main dishes in New York restaurants never include vegetarian options.", "isTrue": false, "nano_skill": [{"name": "ns.A2.reading.negation_detection", "confidence": 0.92, "reason": "Requires detecting false 'never' negation"}]}
      ],
      "teacher_tip": "Use this exercise to check reading comprehension and ensure students understood the key details from the text."
    }`;

export const getMatchingExercise = () => `    {
      "type": "matching",
      "title": "Exercise 3: Vocabulary Matching",
      "icon": "fa-link",
      "time": 7,
      "instructions": "Match each term with its correct definition.",
      "items": [
        {"term": "Appetizer", "definition": "A small dish served before the main course to stimulate the appetite.", "nano_skill": [{"name": "ns.A2.vocabulary.definition_appetizer", "confidence": 0.72, "reason": "Tests matching 'appetizer' to its definition (recognition, not production)"}]},
        {"term": "Cuisine", "definition": "A style or method of cooking, especially as characteristic of a particular country or region.", "nano_skill": [{"name": "ns.B1.vocabulary.definition_cuisine", "confidence": 0.72, "reason": "Tests matching 'cuisine' to its definition"}]},
        {"term": "Portion", "definition": "The amount of food served to one person at a meal.", "nano_skill": [{"name": "ns.A2.vocabulary.definition_portion", "confidence": 0.72, "reason": "Tests matching 'portion' to its definition"}]},
        {"term": "Incorrect", "definition": "Not accurate or wrong; used especially in the context of errors with orders or bills.", "nano_skill": [{"name": "ns.A2.vocabulary.definition_incorrect", "confidence": 0.72, "reason": "Tests matching 'incorrect' to its definition"}]},
        {"term": "Complaint", "definition": "A statement that something is wrong or not satisfactory, especially in service or quality.", "nano_skill": [{"name": "ns.A2.vocabulary.definition_complaint", "confidence": 0.72, "reason": "Tests matching 'complaint' to its definition"}]},
        {"term": "Fine dining", "definition": "A high-end, expensive restaurant experience offering exceptional food, service, and atmosphere.", "nano_skill": [{"name": "ns.B1.vocabulary.definition_fine_dining", "confidence": 0.72, "reason": "Tests matching 'fine dining' to its definition"}]},
        {"term": "Reservation", "definition": "An arrangement made in advance to secure a table at a restaurant.", "nano_skill": [{"name": "ns.A2.vocabulary.definition_reservation", "confidence": 0.72, "reason": "Tests matching 'reservation' to its definition"}]},
        {"term": "Signature dish", "definition": "A unique or famous meal that represents a restaurant or chef's style.", "nano_skill": [{"name": "ns.B1.vocabulary.definition_signature_dish", "confidence": 0.72, "reason": "Tests matching 'signature dish' to its definition"}]},
        {"term": "Undercooked", "definition": "Food that has not been cooked long enough and may be unsafe or unpleasant to eat.", "nano_skill": [{"name": "ns.A2.vocabulary.definition_undercooked", "confidence": 0.72, "reason": "Tests matching 'undercooked' to its definition"}]},
        {"term": "Customer service", "definition": "The assistance and advice provided by a restaurant or business to people who use its services.", "nano_skill": [{"name": "ns.A2.vocabulary.definition_customer_service", "confidence": 0.72, "reason": "Tests matching 'customer service' to its definition"}]}
      ],
      "teacher_tip": "Before the matching activity, introduce and pronounce each term to ensure students feel confident recognizing and understanding them. If needed, translate the most difficult or abstract vocabulary terms into the student's native language. After the exercise, assign students a follow-up task to write 10 original sentences using the new vocabulary."
    }`;

export const getFillInBlanksExercise = () => `    {
      "type": "fill-in-blanks",
      "title": "Exercise 4: Fill in the Blanks",
      "icon": "fa-pencil-alt",
      "time": 8,
      "instructions": "Complete each sentence with the correct word from the box.",
      "word_bank": ["famous", "international", "incorrect", "small", "popular", "cold", "different", "thin", "expensive", "common"],
      "sentences": [
        {"text": "New York is _____ for its wide variety of restaurants and street food.", "answer": "famous", "nano_skill": [{"name": "ns.A2.collocations.adjective_preposition", "confidence": 0.94, "reason": "Tests 'famous for' collocation"}]},
        {"text": "The city offers many _____ cuisines, like Thai, Italian, and Indian.", "answer": "international", "nano_skill": [{"name": "ns.A2.vocabulary.contextual_word_choice", "confidence": 0.93, "reason": "Tests selecting correct adjective from word bank by context"}]},
        {"text": "Customers often complain when their bill is _____.", "answer": "incorrect", "nano_skill": [{"name": "ns.A2.vocabulary.contextual_word_choice", "confidence": 0.93, "reason": "Tests selecting appropriate adjective for billing errors"}]},
        {"text": "Appetizers are usually _____ dishes served before the main course.", "answer": "small", "nano_skill": [{"name": "ns.A2.vocabulary.contextual_word_choice", "confidence": 0.93, "reason": "Tests selecting size adjective from context"}]},
        {"text": "Pizza is one of the most _____ foods in New York.", "answer": "popular", "nano_skill": [{"name": "ns.A2.vocabulary.contextual_word_choice", "confidence": 0.93, "reason": "Tests selecting correct adjective for popularity"}]},
        {"text": "One common complaint is that the food arrives _____.", "answer": "cold", "nano_skill": [{"name": "ns.A2.vocabulary.contextual_word_choice", "confidence": 0.93, "reason": "Tests selecting temperature adjective"}]},
        {"text": "You can try food from many _____ cultures in New York.", "answer": "different", "nano_skill": [{"name": "ns.A2.vocabulary.contextual_word_choice", "confidence": 0.93, "reason": "Tests selecting variety adjective"}]},
        {"text": "New York-style pizza is known for its wide and _____ crust.", "answer": "thin", "nano_skill": [{"name": "ns.A2.vocabulary.contextual_word_choice", "confidence": 0.93, "reason": "Tests selecting texture/shape adjective"}]},
        {"text": "Some restaurants are very _____, but they offer high-quality service.", "answer": "expensive", "nano_skill": [{"name": "ns.A2.vocabulary.contextual_word_choice", "confidence": 0.93, "reason": "Tests selecting price adjective from contrast context"}]},
        {"text": "It is _____ to leave a tip in American restaurants.", "answer": "common", "nano_skill": [{"name": "ns.A2.collocations.adjective_infinitive", "confidence": 0.94, "reason": "Tests 'common to + verb' collocation pattern"}]}
      ],
      "teacher_tip": "You can use this exercise in the next class as a sentence translation activity—provide the sentences in the student's native language and ask them to translate them into English to practice the new vocabulary."
    }`;

export const getMultipleChoiceExercise = () => `    {
      "type": "multiple-choice",
      "title": "Exercise 5: Multiple Choice",
      "icon": "fa-check-square",
      "time": 8,
      "instructions": "Choose the best option to complete each sentence.",
      "questions": [
        {
          "text": "This restaurant is ______ than the one we went to last week.",
          "options": [
            {"label": "A", "text": "good", "correct": false},
            {"label": "B", "text": "better", "correct": true},
            {"label": "C", "text": "best", "correct": false},
            {"label": "D", "text": "the better", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A1.comparatives.irregular_better", "confidence": 0.95, "reason": "Tests irregular comparative form of 'good'"}]
        },
        {
          "text": "That was the ______ meal I've ever had!",
          "options": [
            {"label": "A", "text": "most delicious", "correct": true},
            {"label": "B", "text": "more delicious", "correct": false},
            {"label": "C", "text": "deliciouser", "correct": false},
            {"label": "D", "text": "deliciousest", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.superlatives.regular", "confidence": 0.94, "reason": "Tests 'most + adjective' superlative form"}]
        },
        {
          "text": "Chinese food is usually ______ than British food.",
          "options": [
            {"label": "A", "text": "spicy", "correct": false},
            {"label": "B", "text": "the spiciest", "correct": false},
            {"label": "C", "text": "spicier", "correct": true},
            {"label": "D", "text": "most spicy", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.comparatives.irregular_spicier", "confidence": 0.94, "reason": "Tests -ier comparative form"}]
        },
        {
          "text": "That's the ______ restaurant in our neighborhood.",
          "options": [
            {"label": "A", "text": "expensiver", "correct": false},
            {"label": "B", "text": "most expensive", "correct": true},
            {"label": "C", "text": "more expensive", "correct": false},
            {"label": "D", "text": "expensivest", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.superlatives.regular", "confidence": 0.94, "reason": "Tests 'most + long adjective' superlative"}]
        },
        {
          "text": "John eats ______ than his brother.",
          "options": [
            {"label": "A", "text": "most slowly", "correct": false},
            {"label": "B", "text": "the slowest", "correct": false},
            {"label": "C", "text": "slow", "correct": false},
            {"label": "D", "text": "more slowly", "correct": true}
          ],
          "nano_skill": [{"name": "ns.B1.comparatives.regular", "confidence": 0.93, "reason": "Tests 'more + adverb' comparative form"}]
        },
        {
          "text": "This soup is ______ than the one I made yesterday.",
          "options": [
            {"label": "A", "text": "tastier", "correct": true},
            {"label": "B", "text": "the tastiest", "correct": false},
            {"label": "C", "text": "tasty", "correct": false},
            {"label": "D", "text": "more tastiest", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.comparatives.irregular_tastier", "confidence": 0.94, "reason": "Tests -ier form with y->i change"}]
        },
        {
          "text": "Of all the dishes on the menu, the lasagna is the ______.",
          "options": [
            {"label": "A", "text": "good", "correct": false},
            {"label": "B", "text": "better", "correct": false},
            {"label": "C", "text": "best", "correct": true},
            {"label": "D", "text": "more better", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A1.superlatives.irregular_best", "confidence": 0.95, "reason": "Tests irregular superlative of 'good'"}]
        },
        {
          "text": "Pizza is ______ than soup for a quick lunch.",
          "options": [
            {"label": "A", "text": "the convenient", "correct": false},
            {"label": "B", "text": "more convenient", "correct": true},
            {"label": "C", "text": "convenientest", "correct": false},
            {"label": "D", "text": "most convenient", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.comparatives.regular", "confidence": 0.94, "reason": "Tests 'more + long adjective' comparative"}]
        },
        {
          "text": "This is the ______ café in town. Everyone loves it!",
          "options": [
            {"label": "A", "text": "more popular", "correct": false},
            {"label": "B", "text": "popular", "correct": false},
            {"label": "C", "text": "popularest", "correct": false},
            {"label": "D", "text": "most popular", "correct": true}
          ],
          "nano_skill": [{"name": "ns.A2.superlatives.regular", "confidence": 0.94, "reason": "Tests 'most + long adjective' superlative"}]
        },
        {
          "text": "The weather today is much ______ than it was yesterday.",
          "options": [
            {"label": "A", "text": "warmer", "correct": true},
            {"label": "B", "text": "the warmest", "correct": false},
            {"label": "C", "text": "warm", "correct": false},
            {"label": "D", "text": "most warm", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.comparatives.irregular_warmer", "confidence": 0.94, "reason": "Tests -er comparative form"}]
        }
      ],
      "teacher_tip": "After choosing an answer, ask students to explain why they picked it. This encourages deeper thinking and grammar awareness. Show tricky or commonly confused forms (more better, the most nicest) and explain why they are incorrect."
    }`;

export const getDialogueExercise = () => `    {
      "type": "dialogue",
      "title": "Exercise 6: Dialogue Practice",
      "icon": "fa-comments",
      "time": 8,
      "instructions": "Read the dialogue and practice with a partner.",
      "dialogue": [
        {"speaker": "Waiter", "text": "Good evening! Can I take your order?"},
        {"speaker": "Customer", "text": "Yes, I'd like the grilled salmon with vegetables, please."},
        {"speaker": "Waiter", "text": "Of course. Would you like anything to drink?"},
        {"speaker": "Customer", "text": "A glass of sparkling water, please."},
        {"speaker": "Waiter", "text": "Great. Your order will be ready shortly."},
        {"speaker": "Waiter", "text": "Here is your grilled salmon. Enjoy your meal!"},
        {"speaker": "Customer", "text": "Thank you."},
        {"speaker": "Customer", "text": "Excuse me, I'm sorry but this isn't what I ordered. I asked for grilled salmon, but this is fried."},
        {"speaker": "Waiter", "text": "Oh, I'm really sorry about that. Let me fix it right away."},
        {"speaker": "Customer", "text": "Thank you, I'd appreciate that."},
        {"speaker": "Waiter", "text": "Please accept our apologies. I'll bring the correct dish in just a few minutes."},
        {"speaker": "Customer", "text": "No problem. Thank you for your help."}
      ],
      "expressions": [
        {"text": "I'd like to order the ……, please.", "nano_skill": [{"name": "ns.A2.speaking.polite_request", "confidence": 0.40, "reason": "Tests polite ordering structure with 'I'd like'"}, {"name": "ns.A2.writing.polite_request_structure", "confidence": 0.90, "reason": "Tests written construction of polite request"}]},
        {"text": "Can I see the menu, please?", "nano_skill": [{"name": "ns.A2.speaking.asking_for_information", "confidence": 0.40, "reason": "Tests 'Can I' for polite requests"}, {"name": "ns.A2.writing.question_formation", "confidence": 0.90, "reason": "Tests written question structure"}]},
        {"text": "Could you recommend something vegetarian?", "nano_skill": [{"name": "ns.A2.speaking.asking_for_recommendation", "confidence": 0.40, "reason": "Tests 'Could you' polite question"}, {"name": "ns.A2.writing.polite_question_structure", "confidence": 0.90, "reason": "Tests written polite question construction"}]},
        {"text": "I think there's a mistake with my order.", "nano_skill": [{"name": "ns.A2.speaking.making_complaint", "confidence": 0.40, "reason": "Tests indirect complaint structure"}, {"name": "ns.A2.writing.complaint_structure", "confidence": 0.90, "reason": "Tests written complaint construction"}]},
        {"text": "Excuse me, but this isn't what I asked for.", "nano_skill": [{"name": "ns.A2.speaking.making_complaint", "confidence": 0.40, "reason": "Tests direct complaint with polite opener"}, {"name": "ns.A2.writing.complaint_structure", "confidence": 0.90, "reason": "Tests written complaint with contrast"}]},
        {"text": "Could I get the bill, please?", "nano_skill": [{"name": "ns.A2.speaking.polite_request", "confidence": 0.40, "reason": "Tests 'Could I' polite request"}, {"name": "ns.A2.writing.polite_request_structure", "confidence": 0.90, "reason": "Tests written polite request"}]},
        {"text": "Can I have this to go?", "nano_skill": [{"name": "ns.A2.speaking.polite_request", "confidence": 0.40, "reason": "Tests takeaway request structure"}, {"name": "ns.A2.writing.polite_request_structure", "confidence": 0.90, "reason": "Tests written request structure"}]},
        {"text": "The food was delicious, thank you!", "nano_skill": [{"name": "ns.A2.speaking.expressing_gratitude", "confidence": 0.40, "reason": "Tests gratitude expression"}, {"name": "ns.A2.writing.gratitude_expression", "confidence": 0.90, "reason": "Tests written gratitude"}]},
        {"text": "I'm afraid my dish is cold.", "nano_skill": [{"name": "ns.B1.speaking.making_complaint", "confidence": 0.40, "reason": "Tests indirect complaint with 'I'm afraid'"}, {"name": "ns.B1.writing.indirect_complaint_structure", "confidence": 0.90, "reason": "Tests written indirect complaint"}]},
        {"text": "Can you bring us some more water, please?", "nano_skill": [{"name": "ns.A2.speaking.polite_request", "confidence": 0.40, "reason": "Tests polite request for additional items"}, {"name": "ns.A2.writing.polite_request_structure", "confidence": 0.90, "reason": "Tests written polite request"}]}
      ],
      "expression_instruction": "Practice using these expressions in your own dialogues and real-life situations.",
      "teacher_tip": "Include unexpected issues (e.g., the order is cold, the waiter forgets the drink) to keep the role-play dynamic and spontaneous. Assign students to write a restaurant review or a list of useful expressions they used or learned."
    }`;

export const getDiscussionExercise = () => `    {
      "type": "discussion",
      "title": "Exercise 7: Discussion Questions",
      "icon": "fa-users",
      "time": 8,
      "instructions": "Discuss these questions with your teacher or partner.",
      "questions": [
        {"text": "What is your favorite type of restaurant and why?", "nano_skill": [{"name": "ns.A2.speaking.opinion_expression", "confidence": 0.40, "reason": "Tests ability to express and justify personal preferences"}, {"name": "ns.A2.writing.opinion_justification", "confidence": 0.90, "reason": "Tests written opinion with justification"}]},
        {"text": "Have you ever had a bad experience in a restaurant? What happened?", "nano_skill": [{"name": "ns.A2.speaking.narrating_past_experience", "confidence": 0.40, "reason": "Tests past tense narrative and sequencing"}, {"name": "ns.A2.writing.past_tense_narrative", "confidence": 0.90, "reason": "Tests written past tense narrative"}]},
        {"text": "Do you prefer eating at home or dining out? Give reasons using comparatives.", "nano_skill": [{"name": "ns.A2.speaking.comparison_and_contrast", "confidence": 0.40, "reason": "Tests comparative structures in speech"}, {"name": "ns.A2.writing.comparative_response", "confidence": 0.90, "reason": "Tests written comparative reasoning"}]},
        {"text": "What dish would you recommend to someone visiting your country for the first time?", "nano_skill": [{"name": "ns.A2.speaking.giving_recommendation", "confidence": 0.40, "reason": "Tests recommendation language"}, {"name": "ns.A2.writing.recommendation_structure", "confidence": 0.90, "reason": "Tests written recommendation"}]},
        {"text": "Which restaurant in your city is the most popular? Why do you think it's the best?", "nano_skill": [{"name": "ns.A2.speaking.justifying_preference", "confidence": 0.40, "reason": "Tests superlative usage and justification"}, {"name": "ns.A2.writing.superlative_justification", "confidence": 0.90, "reason": "Tests written superlative justification"}]},
        {"text": "How do you usually react if your order is wrong or the food isn't good?", "nano_skill": [{"name": "ns.B1.speaking.describing_reaction", "confidence": 0.35, "reason": "Tests conditional/habitual reaction description"}, {"name": "ns.B1.writing.conditional_response", "confidence": 0.90, "reason": "Tests written conditional response"}]},
        {"text": "What is more important to you: good food or good service? Why?", "nano_skill": [{"name": "ns.B1.speaking.comparison_and_contrast", "confidence": 0.35, "reason": "Tests argumentative comparison"}, {"name": "ns.B1.writing.comparative_argument", "confidence": 0.90, "reason": "Tests written comparative argument"}]},
        {"text": "Can you describe the most expensive meal you've ever had? Was it worth it?", "nano_skill": [{"name": "ns.B1.speaking.narrating_past_experience", "confidence": 0.35, "reason": "Tests detailed past narrative with evaluation"}, {"name": "ns.B1.writing.descriptive_narrative", "confidence": 0.90, "reason": "Tests written descriptive narrative"}]},
        {"text": "What makes a restaurant better than others in your opinion?", "nano_skill": [{"name": "ns.B1.speaking.justifying_preference", "confidence": 0.35, "reason": "Tests analytical comparison and justification"}, {"name": "ns.B1.writing.comparative_argument", "confidence": 0.90, "reason": "Tests written comparative argument"}]},
        {"text": "Have you ever tried a dish that was better than you expected? What was it?", "nano_skill": [{"name": "ns.A2.speaking.narrating_past_experience", "confidence": 0.40, "reason": "Tests past tense narrative with surprise element"}, {"name": "ns.A2.writing.past_tense_narrative", "confidence": 0.90, "reason": "Tests written past tense narrative"}]}
      ],
      "teacher_tip": "Encourage deeper thinking by asking students to explain, justify, or give examples for their answers.Focus on major errors or repeated mistakes after the discussion, not during."
    }`;

export const getErrorCorrectionExercise = () => `    {
      "type": "error-correction",
      "title": "Exercise 8: Error Correction",
      "icon": "fa-exclamation-triangle",
      "time": 7,
      "instructions": "Find and correct the errors in these sentences.",
      "sentences": [
        {"text": "This pizza is more better than the one I had yesterday.", "correction": "This pizza is better than the one I had yesterday.", "nano_skill": [{"name": "ns.A1.comparatives.irregular_better", "confidence": 0.96, "reason": "Tests recognition of redundant 'more' with irregular comparative 'better'"}]},
        {"text": "She is the most tallest girl in the class.", "correction": "She is the tallest girl in the class.", "nano_skill": [{"name": "ns.A2.superlatives.irregular_tallest", "confidence": 0.95, "reason": "Tests recognition of redundant 'most' with -est ending"}]},
        {"text": "My house is more big than yours.", "correction": "My house is bigger than yours.", "nano_skill": [{"name": "ns.A2.comparatives.irregular_bigger", "confidence": 0.95, "reason": "Tests correct -er form instead of 'more' for short adjective"}]},
        {"text": "Today is the most hottest day of the year.", "correction": "Today is the hottest day of the year.", "nano_skill": [{"name": "ns.A2.superlatives.irregular_hottest", "confidence": 0.95, "reason": "Tests recognition of redundant 'most' with -est"}]},
        {"text": "This restaurant is more expensiveer than the other one.", "correction": "This restaurant is more expensive than the other one.", "nano_skill": [{"name": "ns.A2.comparatives.regular", "confidence": 0.95, "reason": "Tests correct 'more + long adjective' without double suffix"}]},
        {"text": "He is smarter than his brother.", "correction": "He is smarter than his brother.", "nano_skill": [{"name": "ns.A2.comparatives.irregular_smarter", "confidence": 0.90, "reason": "Tests recognition that sentence is already correct"}]},
        {"text": "That movie was the most funniest I have ever seen.", "correction": "That movie was the funniest I have ever seen.", "nano_skill": [{"name": "ns.A2.superlatives.irregular_funniest", "confidence": 0.95, "reason": "Tests recognition of redundant 'most' with -est"}]},
        {"text": "My car is more faster now after the repair.", "correction": "My car is faster now after the repair.", "nano_skill": [{"name": "ns.A2.comparatives.irregular_faster", "confidence": 0.95, "reason": "Tests recognition of redundant 'more' with -er comparative"}]},
        {"text": "Winter is colder than summer.", "correction": "Winter is colder than summer.", "nano_skill": [{"name": "ns.A2.comparatives.irregular_colder", "confidence": 0.90, "reason": "Tests recognition that sentence is already correct"}]},
        {"text": "She is the more talented singer in our group.", "correction": "She is the most talented singer in our group.", "nano_skill": [{"name": "ns.A2.superlatives.regular", "confidence": 0.95, "reason": "Tests correct 'most + long adjective' superlative"}]}
      ],
      "teacher_tip": "Highlight frequent errors with comparatives and superlatives, like double comparatives (e.g., more better) or incorrect superlative forms.Ask students to explain why a sentence is incorrect to deepen comprehension."
    }`;

// =============== 12 NEW EXERCISES - PHASE 1 (6 exercises) ===============

export const getOddOneOutExercise = () => `    {
      "type": "odd-one-out",
      "title": "Exercise 9: Odd One Out",
      "icon": "fa-search",
      "time": 6,
      "instructions": "In each group, find the word that is grammatically different from the others (different part of speech).",
      "questions": [
        {"options": ["running", "swimming", "cycling", "sport", "dancing"], "correct_answer": "sport", "nano_skill": [{"name": "ns.A2.vocabulary.noun_recognition", "confidence": 0.94, "reason": "Tests identifying a noun among gerunds"}]},
        {"options": ["quickly", "slowly", "carefully", "fast", "quietly"], "correct_answer": "fast", "nano_skill": [{"name": "ns.A2.vocabulary.adjective_recognition", "confidence": 0.91, "reason": "Tests identifying adjective among -ly adverbs"}]},
        {"options": ["delicious", "tasty", "eat", "spicy", "sweet"], "correct_answer": "eat", "nano_skill": [{"name": "ns.A2.vocabulary.verb_recognition", "confidence": 0.90, "reason": "Tests identifying verb among adjectives"}]},
        {"options": ["waiter", "chef", "serve", "cook", "bartender"], "correct_answer": "serve", "nano_skill": [{"name": "ns.A2.vocabulary.verb_recognition", "confidence": 0.91, "reason": "Tests identifying verb among nouns"}]},
        {"options": ["reservation", "booking", "order", "complain", "menu"], "correct_answer": "complain", "nano_skill": [{"name": "ns.A2.vocabulary.verb_recognition", "confidence": 0.94, "reason": "Tests identifying verb among nouns"}]},
        {"options": ["hot", "cold", "warmth", "fresh", "spicy"], "correct_answer": "warmth", "nano_skill": [{"name": "ns.A2.vocabulary.noun_recognition", "confidence": 0.92, "reason": "Tests identifying noun among adjectives"}]},
        {"options": ["eating", "drinking", "table", "cooking", "serving"], "correct_answer": "table", "nano_skill": [{"name": "ns.A2.vocabulary.noun_recognition", "confidence": 0.91, "reason": "Tests identifying concrete noun among gerunds"}]},
        {"options": ["expensive", "cheap", "beautifully", "fresh", "delicious"], "correct_answer": "beautifully", "nano_skill": [{"name": "ns.A2.vocabulary.adverb_recognition", "confidence": 0.94, "reason": "Tests identifying adverb among adjectives"}]},
        {"options": ["starter", "dessert", "appetizer", "main", "eat"], "correct_answer": "eat", "nano_skill": [{"name": "ns.A2.vocabulary.verb_recognition", "confidence": 0.92, "reason": "Tests identifying verb among nouns"}]},
        {"options": ["restaurant", "cafe", "cooking", "bistro", "diner"], "correct_answer": "cooking", "nano_skill": [{"name": "ns.A2.vocabulary.gerund_recognition", "confidence": 0.93, "reason": "Tests identifying gerund among place nouns"}]}
      ],
      "teacher_tip": "After students identify the odd word, ask them to explain their reasoning. This develops critical thinking and vocabulary categorization skills."
    }`;

// NEW: Separate Synonyms Exercise
export const getSynonymsExercise = () => `    {
      "type": "synonyms",
      "title": "Exercise 10: Synonyms Matching",
      "icon": "fa-equals",
      "time": 5,
      "instructions": "Match each word on the left with its synonym (word with similar meaning) on the right.",
      "items": [
        { "term": "delicious", "definition": "tasty", "letter": "A", "nano_skill": [{"name": "ns.A2.synonyms.adjective_synonym.taste", "confidence": 0.95, "reason": "Tests knowledge of synonyms for taste description"}]},
        { "term": "expensive", "definition": "costly", "letter": "B", "nano_skill": [{"name": "ns.A2.synonyms.adjective_synonym.price", "confidence": 0.94, "reason": "Tests knowledge of synonyms for high cost"}]},
        { "term": "recommend", "definition": "suggest", "letter": "C", "nano_skill": [{"name": "ns.A2.synonyms.verb_synonym.recommendation", "confidence": 0.94, "reason": "Tests verb synonym for suggesting"}]},
        { "term": "popular", "definition": "well-liked", "letter": "D", "nano_skill": [{"name": "ns.A2.synonyms.adjective_synonym.popularity", "confidence": 0.92, "reason": "Tests synonym for popularity descriptor"}]},
        { "term": "affordable", "definition": "reasonably priced", "letter": "E", "nano_skill": [{"name": "ns.A2.synonyms.adjective_synonym.price", "confidence": 0.93, "reason": "Tests synonym for affordability"}]},
        { "term": "authentic", "definition": "genuine", "letter": "F", "nano_skill": [{"name": "ns.B1.synonyms.adjective_synonym.authenticity", "confidence": 0.93, "reason": "Tests synonym for genuineness"}]},
        { "term": "amazing", "definition": "wonderful", "letter": "G", "nano_skill": [{"name": "ns.A2.synonyms.adjective_synonym.quality", "confidence": 0.93, "reason": "Tests synonym for quality descriptor"}]},
        { "term": "cozy", "definition": "comfortable", "letter": "H", "nano_skill": [{"name": "ns.A2.synonyms.adjective_synonym.comfort", "confidence": 0.91, "reason": "Tests synonym for comfort descriptor"}]},
        { "term": "busy", "definition": "crowded", "letter": "I", "nano_skill": [{"name": "ns.A2.synonyms.adjective_synonym.density", "confidence": 0.90, "reason": "Tests synonym for crowdedness"}]},
        { "term": "excellent", "definition": "outstanding", "letter": "J", "nano_skill": [{"name": "ns.B1.synonyms.adjective_synonym.quality", "confidence": 0.91, "reason": "Tests synonym for high quality"}]}
      ],
      "teacher_tip": "After completing the exercise, have students create sentences using both words from 2-3 pairs to demonstrate they understand the synonyms have similar meanings in context."
    }`;

// NEW: Separate Antonyms Exercise
export const getAntonymsExercise = () => `    {
      "type": "antonyms",
      "title": "Exercise 11: Antonyms Matching",
      "icon": "fa-not-equal",
      "time": 5,
      "instructions": "Match each word on the left with its antonym (word with opposite meaning) on the right.",
      "items": [
        { "term": "expensive", "definition": "cheap", "letter": "A", "nano_skill": [{"name": "ns.A2.antonyms.adjective_antonym.price", "confidence": 0.95, "reason": "Tests knowledge of opposite price descriptors"}]},
        { "term": "delicious", "definition": "tasteless", "letter": "B", "nano_skill": [{"name": "ns.A2.antonyms.adjective_antonym.taste", "confidence": 0.94, "reason": "Tests knowledge of opposite taste descriptions"}]},
        { "term": "spicy", "definition": "mild", "letter": "C", "nano_skill": [{"name": "ns.A2.antonyms.adjective_antonym.spiciness", "confidence": 0.93, "reason": "Tests opposite of spiciness"}]},
        { "term": "fresh", "definition": "stale", "letter": "D", "nano_skill": [{"name": "ns.A2.antonyms.adjective_antonym.freshness", "confidence": 0.93, "reason": "Tests opposite of freshness"}]},
        { "term": "hot", "definition": "cold", "letter": "E", "nano_skill": [{"name": "ns.A1.antonyms.adjective_antonym.temperature", "confidence": 0.95, "reason": "Tests basic temperature opposites"}]},
        { "term": "crowded", "definition": "empty", "letter": "F", "nano_skill": [{"name": "ns.A2.antonyms.adjective_antonym.density", "confidence": 0.93, "reason": "Tests opposite of crowdedness"}]},
        { "term": "fast", "definition": "slow", "letter": "G", "nano_skill": [{"name": "ns.A1.antonyms.adjective_antonym.speed", "confidence": 0.95, "reason": "Tests basic speed opposites"}]},
        { "term": "polite", "definition": "rude", "letter": "H", "nano_skill": [{"name": "ns.A2.antonyms.adjective_antonym.manners", "confidence": 0.93, "reason": "Tests opposite of politeness"}]},
        { "term": "clean", "definition": "dirty", "letter": "I", "nano_skill": [{"name": "ns.A1.antonyms.adjective_antonym.cleanliness", "confidence": 0.95, "reason": "Tests basic cleanliness opposites"}]},
        { "term": "quiet", "definition": "noisy", "letter": "J", "nano_skill": [{"name": "ns.A2.antonyms.adjective_antonym.volume", "confidence": 0.93, "reason": "Tests opposite of quietness"}]}
      ],
      "teacher_tip": "After completing the exercise, have students create pairs of contrasting sentences (e.g., 'The restaurant was expensive' vs 'The restaurant was cheap') to reinforce understanding of opposites."
    }`;

// LEGACY: Keep old combined exercise for backward compatibility
export const getSynonymsAntonymsExercise = () => `    {
      "type": "synonyms-antonyms",
      "title": "Exercise 10: Synonyms & Antonyms Matching",
      "icon": "fa-exchange-alt",
      "time": 7,
      "instructions": "Match each word with its synonym or antonym from the options provided.",
      "items": [
        { "term": "delicious", "definition": "tasty", "letter": "A", "nano_skill": [{"name": "ns.A2.synonyms.adjective_synonym.taste", "confidence": 0.95, "reason": "Tests taste description synonyms"}] },
        { "term": "expensive", "definition": "cheap", "letter": "B", "nano_skill": [{"name": "ns.A2.antonyms.adjective_antonym.price", "confidence": 0.94, "reason": "Tests opposite price descriptors"}] },
        { "term": "popular", "definition": "famous", "letter": "C", "nano_skill": [{"name": "ns.A2.synonyms.adjective_synonym.popularity", "confidence": 0.93, "reason": "Tests popularity synonyms"}]},
        { "term": "fresh", "definition": "new", "letter": "D", "nano_skill": [{"name": "ns.A2.synonyms.adjective_synonym.freshness", "confidence": 0.93, "reason": "Tests freshness synonyms"}]},
        { "term": "hot", "definition": "cold", "letter": "E", "nano_skill": [{"name": "ns.A1.antonyms.adjective_antonym.temperature", "confidence": 0.95, "reason": "Tests temperature opposites"}]},
        { "term": "busy", "definition": "quiet", "letter": "F", "nano_skill": [{"name": "ns.A2.antonyms.adjective_antonym.volume", "confidence": 0.93, "reason": "Tests volume/activity antonyms"}]},
        { "term": "polite", "definition": "rude", "letter": "G", "nano_skill": [{"name": "ns.A2.antonyms.adjective_antonym.manners", "confidence": 0.93, "reason": "Tests manners antonyms"}]},
        { "term": "satisfied", "definition": "disappointed", "letter": "H", "nano_skill": [{"name": "ns.B1.antonyms.adjective_antonym.satisfaction", "confidence": 0.92, "reason": "Tests satisfaction antonyms"}]},
        { "term": "complaint", "definition": "criticism", "letter": "I", "nano_skill": [{"name": "ns.B1.synonyms.noun_synonym.complaint", "confidence": 0.92, "reason": "Tests complaint noun synonyms"}]},
        { "term": "quick", "definition": "fast", "letter": "J", "nano_skill": [{"name": "ns.A1.synonyms.adjective_synonym.speed", "confidence": 0.95, "reason": "Tests speed synonyms"}]}
      ],
      "teacher_tip": "Use these word pairs to create role-play scenarios where students practice using both positive and negative restaurant vocabulary in context."
    }`;

export const getSentenceTransformationExercise = () => `    {
      "type": "sentence-transformation",
      "title": "Exercise 11: Sentence Transformation",
      "icon": "fa-sync-alt",
      "time": 8,
      "instructions": "Transform these sentences as instructed, keeping the same meaning.",
      "sentences": [
        {"original": "The chef prepares the meals every morning.", "instruction": "Change to passive voice", "transformed": "The meals are prepared by the chef every morning.", "nano_skill": [{"name": "ns.B1.passive_voice.active_to_passive.present_simple", "confidence": 0.95, "reason": "Tests transformation to present simple passive"}]},
        {"original": "The restaurant is more expensive than the café.", "instruction": "Use 'not as... as'", "transformed": "The café is not as expensive as the restaurant.", "nano_skill": [{"name": "ns.A2.comparatives.not_as_as_structure", "confidence": 0.94, "reason": "Tests 'not as... as' structure formation"}]},
        {"original": "I have never eaten such delicious pizza.", "instruction": "Use superlative", "transformed": "This is the most delicious pizza I have ever eaten.", "nano_skill": [{"name": "ns.A2.superlatives.sentence_structure", "confidence": 0.93, "reason": "Tests transformation to superlative structure"}]},
        {"original": "The waiter said, 'Your table is ready.'", "instruction": "Change to reported speech", "transformed": "The waiter said that our table was ready.", "nano_skill": [{"name": "ns.B1.reported_speech.direct_to_indirect", "confidence": 0.94, "reason": "Tests direct to indirect speech transformation"}]},
        {"original": "We ordered dessert after we finished the main course.", "instruction": "Use 'having + past participle'", "transformed": "Having finished the main course, we ordered dessert.", "nano_skill": [{"name": "ns.B2.present_perfect.participial_clause", "confidence": 0.93, "reason": "Tests participial clause formation"}]},
        {"original": "The food was so spicy that I couldn't eat it.", "instruction": "Use 'too... to'", "transformed": "The food was too spicy for me to eat.", "nano_skill": [{"name": "ns.B1.writing.structural_too_to", "confidence": 0.94, "reason": "Tests 'too...to' transformation"}]},
        {"original": "If you don't make a reservation, you won't get a table.", "instruction": "Use 'unless'", "transformed": "Unless you make a reservation, you won't get a table.", "nano_skill": [{"name": "ns.B1.first_conditional.unless", "confidence": 0.94, "reason": "Tests 'unless' conditional transformation"}]},
        {"original": "This restaurant serves better food than that one.", "instruction": "Use superlative", "transformed": "This restaurant serves the best food in the area.", "nano_skill": [{"name": "ns.A2.superlatives.irregular_best", "confidence": 0.93, "reason": "Tests transformation to irregular superlative 'best'"}]},
        {"original": "I suggest you try the fish today.", "instruction": "Use modal verb", "transformed": "You should try the fish today.", "nano_skill": [{"name": "ns.A2.modal_verbs.you_should", "confidence": 0.94, "reason": "Tests modal verb 'should' for suggestions"}]},
        {"original": "The service was so slow that we left early.", "instruction": "Use 'too... to'", "transformed": "The service was too slow for us to stay.", "nano_skill": [{"name": "ns.B1.writing.structural_too_to", "confidence": 0.94, "reason": "Tests 'too...to' transformation"}]}
      ],
      "teacher_tip": "Focus on one transformation type at a time if students struggle. Practice with additional examples before moving to the next transformation pattern."
    }`;

export const getWordOrderExercise = () => `    {
      "type": "word-order",
      "title": "Exercise 12: Word Order",
      "icon": "fa-sort",
      "time": 6,
      "instructions": "Put the words in the correct order to make meaningful sentences about restaurants.",
      "sentences": [
        {"scrambled_words": "this / restaurant / the / in / food / neighborhood / best / serves", "correct_order": "This restaurant serves the best food in the neighborhood.", "nano_skill": [{"name": "ns.A2.word_order.subject_verb_object", "confidence": 0.94, "reason": "Tests Subject-Verb-Object word order"}]},
        {"scrambled_words": "always / we / tip / good / service / for / leave / a", "correct_order": "We always leave a tip for good service.", "nano_skill": [{"name": "ns.A2.word_order.adverb_frequency_position", "confidence": 0.93, "reason": "Tests placing 'always' between subject and verb"}]},
        {"scrambled_words": "menu / has / the / variety / wide / of / dishes / a", "correct_order": "The menu has a wide variety of dishes.", "nano_skill": [{"name": "ns.A2.word_order.subject_verb_object", "confidence": 0.93, "reason": "Tests SVO with noun phrase"}]},
        {"scrambled_words": "complained / customer / the / about / cold / the / food", "correct_order": "The customer complained about the cold food.", "nano_skill": [{"name": "ns.A2.word_order.subject_verb_object", "confidence": 0.93, "reason": "Tests SVO with prepositional phrase"}]},
        {"scrambled_words": "book / should / you / advance / table / in / a", "correct_order": "You should book a table in advance.", "nano_skill": [{"name": "ns.A2.word_order.modal_verb_position", "confidence": 0.93, "reason": "Tests modal verb placement in sentence"}]},
        {"scrambled_words": "pizza / New York / famous / is / style / for / its", "correct_order": "New York is famous for its pizza style.", "nano_skill": [{"name": "ns.A2.word_order.subject_verb_object", "confidence": 0.93, "reason": "Tests SVO with 'famous for' collocation"}]},
        {"scrambled_words": "eating / prefer / out / to / cooking / I / home / at", "correct_order": "I prefer eating out to cooking at home.", "nano_skill": [{"name": "ns.B1.word_order.gerund_comparison_structure", "confidence": 0.92, "reason": "Tests 'prefer X to Y' gerund structure"}]},
        {"scrambled_words": "been / have / to / you / restaurant / this / before", "correct_order": "Have you been to this restaurant before?", "nano_skill": [{"name": "ns.A2.word_order.question_inversion", "confidence": 0.93, "reason": "Tests subject-auxiliary inversion in questions"}]},
        {"scrambled_words": "waiter / recommended / the / special / chef's / today's", "correct_order": "The waiter recommended today's chef's special.", "nano_skill": [{"name": "ns.A2.word_order.subject_verb_object", "confidence": 0.93, "reason": "Tests SVO with possessive noun phrase"}]},
        {"scrambled_words": "delicious / was / most / the / I've / meal / ever / had", "correct_order": "It was the most delicious meal I've ever had.", "nano_skill": [{"name": "ns.A2.word_order.superlative_sentence_structure", "confidence": 0.92, "reason": "Tests superlative sentence structure with relative clause"}]}
      ],
      "teacher_tip": "Start with shorter sentences and gradually increase complexity. Encourage students to read their sentences aloud to check if they sound natural."
    }`;

export const getGapTextExercise = () => `    {
      "type": "gap-text",
      "title": "Exercise 13: Gap Text",
      "icon": "fa-puzzle-piece",
      "time": 8,
      "instructions": "Fill in the gaps with the correct form of the verbs in brackets. The word in parentheses after each gap is the incorrect-word that needs transformation:",
      "sentences": [
        {"text": "Yesterday I _____ (go) to the restaurant to meet my friend.", "answer": "went", "verb": "go", "nano_skill": [{"name": "ns.A2.past_simple.irregular_verb_go", "confidence": 0.95, "reason": "Tests irregular past form 'go' → 'went'"}]},
        {"text": "The waiter _____ (be) very polite and helpful throughout the meal.", "answer": "was", "verb": "be", "nano_skill": [{"name": "ns.A2.past_simple.irregular_verb_be", "confidence": 0.94, "reason": "Tests 'was' for singular subject in past"}]},
        {"text": "She has _____ (work) as a chef in this restaurant for five years now.", "answer": "been working", "verb": "work", "nano_skill": [{"name": "ns.B1.present_perfect_continuous.continuous_form", "confidence": 0.93, "reason": "Tests present perfect continuous formation"}]},
        {"text": "If I _____ (be) you, I would try the seafood special today.", "answer": "were", "verb": "be", "nano_skill": [{"name": "ns.B1.second_conditional.subjunctive_were", "confidence": 0.93, "reason": "Tests subjunctive 'were' in second conditional"}]},
        {"text": "The food was so _____ (spice) that I had to drink three glasses of water.", "answer": "spicy", "verb": "spice", "nano_skill": [{"name": "ns.A2.word_formation.adjective_from_noun", "confidence": 0.94, "reason": "Tests noun-to-adjective word formation"}]},
        {"text": "Can you _____ (recommend) a good wine to go with this dish?", "answer": "recommend", "verb": "recommend", "nano_skill": [{"name": "ns.A2.modal_verbs.base_form_after_modal", "confidence": 0.94, "reason": "Tests base verb form after modal 'can'"}]},
        {"text": "I'm looking _____ (forward) to trying their famous dessert menu.", "answer": "forward", "verb": "forward", "nano_skill": [{"name": "ns.A2.phrasal_verbs.phrasal_verb_look_forward", "confidence": 0.93, "reason": "Tests phrasal verb 'look forward to'"}]},
        {"text": "The restaurant _____ (open) at 6 PM according to their website.", "answer": "opens", "verb": "open", "nano_skill": [{"name": "ns.A2.present_simple.third_person_s", "confidence": 0.94, "reason": "Tests third person -s in present simple"}]},
        {"text": "By next month, they _____ (serve) customers for ten years.", "answer": "will have been serving", "verb": "serve", "nano_skill": [{"name": "ns.C1.future_continuous.future_perfect_continuous", "confidence": 0.92, "reason": "Tests future perfect continuous formation"}]},
        {"text": "We _____ (wait) for our table for nearly an hour yesterday.", "answer": "waited", "verb": "wait", "nano_skill": [{"name": "ns.A2.past_simple.regular_verb_form", "confidence": 0.94, "reason": "Tests regular past simple -ed form"}]}
      ],
      "teacher_tip": "Before students fill the gaps, discuss the topic to help them understand the context and make better choices."
    }`;

export const getNegativePrefixesExercise = () => `    {
      "type": "negative-prefixes",
      "title": "Exercise 14: Negative Prefixes",
      "icon": "fa-minus-circle",
      "time": 6,
      "instructions": "Add the correct negative prefix (un-, in-, im-, dis-) to create the opposite meaning.",
      "words": [
        {"word": "satisfied", "answer": "dissatisfied", "nano_skill": [{"name": "ns.A2.negative_prefixes.prefix_dis", "confidence": 0.95, "reason": "Tests 'dis-' prefix for negation"}]},
        {"word": "cooked", "answer": "uncooked", "nano_skill": [{"name": "ns.A2.negative_prefixes.prefix_un", "confidence": 0.94, "reason": "Tests 'un-' prefix for negation"}]},
        {"word": "polite", "answer": "impolite", "nano_skill": [{"name": "ns.A2.negative_prefixes.prefix_im", "confidence": 0.94, "reason": "Tests 'im-' prefix before 'p'"}]},
        {"word": "correct", "answer": "incorrect", "nano_skill": [{"name": "ns.A2.negative_prefixes.prefix_in", "confidence": 0.94, "reason": "Tests 'in-' prefix for negation"}]},
        {"word": "fresh", "answer": "unfresh", "nano_skill": [{"name": "ns.A2.negative_prefixes.prefix_un", "confidence": 0.94, "reason": "Tests 'un-' prefix for negation"}]},
        {"word": "expensive", "answer": "inexpensive", "nano_skill": [{"name": "ns.A2.negative_prefixes.prefix_in", "confidence": 0.94, "reason": "Tests 'in-' prefix for negation"}]},
        {"word": "comfortable", "answer": "uncomfortable", "nano_skill": [{"name": "ns.A2.negative_prefixes.prefix_un", "confidence": 0.94, "reason": "Tests 'un-' prefix for negation"}]},
        {"word": "honest", "answer": "dishonest", "nano_skill": [{"name": "ns.A2.negative_prefixes.prefix_dis", "confidence": 0.94, "reason": "Tests 'dis-' prefix for negation"}]},
        {"word": "possible", "answer": "impossible", "nano_skill": [{"name": "ns.A2.negative_prefixes.prefix_im", "confidence": 0.94, "reason": "Tests 'im-' prefix before 'p'"}]},
        {"word": "popular", "answer": "unpopular", "nano_skill": [{"name": "ns.A2.negative_prefixes.prefix_un", "confidence": 0.94, "reason": "Tests 'un-' prefix for negation"}]}
      ],
      "teacher_tip": "After completing the exercise, have students create sentences using both the positive and negative forms to reinforce understanding of meaning changes."
    }`;

// =============== 12 NEW EXERCISES - PHASE 2 (4 exercises) ===============

export const getCategorizeExercise = () => `    {
      "type": "categorize",
      "title": "Exercise 15: Categorize",
      "icon": "fa-layer-group",
      "time": 7,
      "instructions": "Sort these food and restaurant-related items into the correct categories.",
      "items": [
        {"word": "pizza", "nano_skill": [{"name": "ns.A1.vocabulary.word_family_food_grouping", "confidence": 0.95, "reason": "Tests categorization of 'pizza' as food item"}]},
        {"word": "waiter", "nano_skill": [{"name": "ns.A1.vocabulary.word_family_people_grouping", "confidence": 0.95, "reason": "Tests categorization of 'waiter' as staff"}]},
        {"word": "spoon", "nano_skill": [{"name": "ns.A1.vocabulary.word_family_utensils_grouping", "confidence": 0.95, "reason": "Tests categorization of 'spoon' as utensil"}]},
        {"word": "breakfast", "nano_skill": [{"name": "ns.A1.vocabulary.word_family_time_grouping", "confidence": 0.95, "reason": "Tests categorization of 'breakfast' as meal time"}]},
        {"word": "sushi", "nano_skill": [{"name": "ns.A2.vocabulary.word_family_food_grouping", "confidence": 0.94, "reason": "Tests categorization of 'sushi' as food item"}]},
        {"word": "chef", "nano_skill": [{"name": "ns.A2.vocabulary.word_family_people_grouping", "confidence": 0.94, "reason": "Tests categorization of 'chef' as staff"}]},
        {"word": "fork", "nano_skill": [{"name": "ns.A1.vocabulary.word_family_utensils_grouping", "confidence": 0.95, "reason": "Tests categorization of 'fork' as utensil"}]},
        {"word": "lunch", "nano_skill": [{"name": "ns.A1.vocabulary.word_family_time_grouping", "confidence": 0.95, "reason": "Tests categorization of 'lunch' as meal time"}]},
        {"word": "pasta", "nano_skill": [{"name": "ns.A1.vocabulary.word_family_food_grouping", "confidence": 0.95, "reason": "Tests categorization of 'pasta' as food item"}]},
        {"word": "customer", "nano_skill": [{"name": "ns.A2.vocabulary.word_family_people_grouping", "confidence": 0.94, "reason": "Tests categorization of 'customer' as person"}]},
        {"word": "knife", "nano_skill": [{"name": "ns.A1.vocabulary.word_family_utensils_grouping", "confidence": 0.95, "reason": "Tests categorization of 'knife' as utensil"}]},
        {"word": "dinner", "nano_skill": [{"name": "ns.A1.vocabulary.word_family_time_grouping", "confidence": 0.95, "reason": "Tests categorization of 'dinner' as meal time"}]},
        {"word": "burger", "nano_skill": [{"name": "ns.A1.vocabulary.word_family_food_grouping", "confidence": 0.95, "reason": "Tests categorization of 'burger' as food item"}]},
        {"word": "manager", "nano_skill": [{"name": "ns.A2.vocabulary.word_family_people_grouping", "confidence": 0.94, "reason": "Tests categorization of 'manager' as staff"}]},
        {"word": "plate", "nano_skill": [{"name": "ns.A1.vocabulary.word_family_utensils_grouping", "confidence": 0.95, "reason": "Tests categorization of 'plate' as utensil"}]},
        {"word": "snack", "nano_skill": [{"name": "ns.A1.vocabulary.word_family_time_grouping", "confidence": 0.95, "reason": "Tests categorization of 'snack' as meal time"}]}
      ],
      "categories": [
        {"name": "Food Items", "correct_items": ["pizza", "sushi", "pasta", "burger"], "nano_skill": [{"name": "ns.A1.vocabulary.word_family_food_grouping", "confidence": 0.95, "reason": "Tests ability to group food vocabulary"}]},
        {"name": "Restaurant Staff", "correct_items": ["waiter", "chef", "manager", "customer"], "nano_skill": [{"name": "ns.A2.vocabulary.word_family_people_grouping", "confidence": 0.94, "reason": "Tests ability to group restaurant personnel vocabulary"}]},
        {"name": "Eating Utensils", "correct_items": ["spoon", "fork", "knife", "plate"], "nano_skill": [{"name": "ns.A1.vocabulary.word_family_utensils_grouping", "confidence": 0.95, "reason": "Tests ability to group eating utensil vocabulary"}]},
        {"name": "Meal Times", "correct_items": ["breakfast", "lunch", "dinner", "snack"], "nano_skill": [{"name": "ns.A1.vocabulary.word_family_time_grouping", "confidence": 0.95, "reason": "Tests ability to group meal time vocabulary"}]}
      ],
      "teacher_tip": "After categorizing, ask students to add two more items to each category to expand their vocabulary and test their understanding of the categories."
    }`;

export const getParaphrasingExercise = () => `    {
      "type": "paraphrasing",
      "title": "Exercise 16: Paraphrasing",
      "icon": "fa-quote-left",
      "time": 8,
      "instructions": "Rewrite these sentences about restaurant experiences using different words but keeping the same meaning.",
      "sentences": [
        {"original": "The food was absolutely delicious.", "word_to_use": "tasty", "answer": "The meal was extremely tasty.", "nano_skill": [{"name": "ns.B1.writing.structural_paraphrase", "confidence": 0.95, "reason": "Tests ability to restructure sentence using provided synonym"}]},
        {"original": "We had to wait a long time for our order.", "word_to_use": "ages", "answer": "Our food took ages to arrive.", "nano_skill": [{"name": "ns.B1.writing.structural_paraphrase", "confidence": 0.94, "reason": "Tests expressing duration with different structure"}]},
        {"original": "The restaurant is always crowded on weekends.", "word_to_use": "busy", "answer": "The place gets really busy on Saturdays and Sundays.", "nano_skill": [{"name": "ns.B1.writing.structural_paraphrase", "confidence": 0.94, "reason": "Tests restructuring with synonym substitution"}]},
        {"original": "I complained about the cold soup.", "word_to_use": "temperature", "answer": "I told the waiter that my soup wasn't the right temperature.", "nano_skill": [{"name": "ns.B1.writing.structural_paraphrase", "confidence": 0.94, "reason": "Tests complete sentence restructuring"}]},
        {"original": "This café serves the best coffee in town.", "word_to_use": "finest", "answer": "This place has the finest coffee around.", "nano_skill": [{"name": "ns.B1.writing.structural_paraphrase", "confidence": 0.94, "reason": "Tests paraphrasing with formal synonym"}]},
        {"original": "The bill was much higher than expected.", "word_to_use": "expensive", "answer": "We were surprised by how expensive the meal was.", "nano_skill": [{"name": "ns.B1.writing.structural_paraphrase", "confidence": 0.94, "reason": "Tests restructuring with perspective change"}]}
      ],
      "teacher_tip": "Encourage students to use synonyms and different sentence structures. Discuss how paraphrasing is useful for avoiding repetition in writing and speaking."
    }`;

export const getCompleteWordExercise = () => `    {
      "type": "complete-word",
      "title": "Exercise 17: Complete the Word",
      "icon": "fa-spell-check",
      "time": 6,
      "instructions": "Complete these restaurant and food-related words by filling in the missing letters.",
      "words": [
        {"partial": "rest_urant", "complete": "restaurant", "clue": "A place where people go to eat meals", "nano_skill": [{"name": "ns.A2.vocabulary.spelling_vowel_pattern", "confidence": 0.95, "reason": "Tests correct placement of vowel 'a' in 'restaurant'"}]},
        {"partial": "del_cious", "complete": "delicious", "clue": "Having a very pleasant taste", "nano_skill": [{"name": "ns.A2.vocabulary.spelling_vowel_pattern", "confidence": 0.94, "reason": "Tests correct placement of vowel 'i' in 'delicious'"}]},
        {"partial": "_ppetizer", "complete": "appetizer", "clue": "A small dish served before the main course", "nano_skill": [{"name": "ns.A2.vocabulary.spelling_vowel_pattern", "confidence": 0.94, "reason": "Tests correct vowel 'a' at start of 'appetizer'"}]},
        {"partial": "reserv_tion", "complete": "reservation", "clue": "Booking a table in advance", "nano_skill": [{"name": "ns.A2.vocabulary.spelling_vowel_pattern", "confidence": 0.94, "reason": "Tests correct vowel 'a' in 'reservation'"}]},
        {"partial": "cust_mer", "complete": "customer", "clue": "A person who buys food or service", "nano_skill": [{"name": "ns.A2.vocabulary.spelling_vowel_pattern", "confidence": 0.94, "reason": "Tests correct vowel 'o' in 'customer'"}]},
        {"partial": "veget_rian", "complete": "vegetarian", "clue": "Someone who doesn't eat meat", "nano_skill": [{"name": "ns.A2.vocabulary.spelling_vowel_pattern", "confidence": 0.94, "reason": "Tests correct vowel 'a' in 'vegetarian'"}]},
        {"partial": "w_iter", "complete": "waiter", "clue": "A person who serves food in a restaurant", "nano_skill": [{"name": "ns.A2.vocabulary.spelling_vowel_pattern", "confidence": 0.94, "reason": "Tests correct vowel 'a' in 'waiter'"}]},
        {"partial": "men_", "complete": "menu", "clue": "A list of food and drinks available", "nano_skill": [{"name": "ns.A2.vocabulary.spelling_vowel_pattern", "confidence": 0.94, "reason": "Tests correct vowel 'u' in 'menu'"}]},
        {"partial": "_xpensive", "complete": "expensive", "clue": "Costing a lot of money", "nano_skill": [{"name": "ns.A2.vocabulary.spelling_vowel_pattern", "confidence": 0.94, "reason": "Tests correct vowel 'e' in 'expensive'"}]},
        {"partial": "compl_int", "complete": "complaint", "clue": "An expression of dissatisfaction", "nano_skill": [{"name": "ns.A2.vocabulary.spelling_vowel_pattern", "confidence": 0.94, "reason": "Tests correct vowel 'a' in 'complaint'"}]}
      ],
      "teacher_tip": "After completing the words, ask students to use each word in a sentence about their own restaurant experiences to reinforce meaning and usage."
    }`;

export const getMatchingHalvesExercise = () => `    {
      "type": "matching-halves",
      "title": "Exercise 18: Matching Halves",
      "icon": "fa-puzzle-piece",
      "time": 7,
      "instructions": "Match the first half of each sentence with the correct second half.",
      "sentence_halves": [
        {"first_half": "I'd like to make a reservation", "second_half": "for four people at 7:30 PM this Friday.", "id": 1, "nano_skill": [{"name": "ns.A2.reading.clause_connection.purpose", "confidence": 0.95, "reason": "Tests understanding of purpose clause connection"}]},
        {"first_half": "The waiter recommended the grilled salmon", "second_half": "because it's the chef's specialty this week.", "id": 2, "nano_skill": [{"name": "ns.A2.reading.clause_connection.cause", "confidence": 0.94, "reason": "Tests understanding of because-clause connection"}]},
        {"first_half": "Could you bring us two glasses of sparkling water", "second_half": "and the dessert menu, please?", "id": 3, "nano_skill": [{"name": "ns.A2.reading.clause_connection.addition", "confidence": 0.94, "reason": "Tests understanding of additive clause with 'and'"}]},
        {"first_half": "I ordered the vegetarian pasta", "second_half": "but they brought me a seafood dish instead.", "id": 4, "nano_skill": [{"name": "ns.A2.reading.clause_connection.contrast", "confidence": 0.94, "reason": "Tests understanding of contrast clause with 'but'"}]},
        {"first_half": "This Italian restaurant is famous", "second_half": "for serving the most authentic pizza in town.", "id": 5, "nano_skill": [{"name": "ns.A2.reading.clause_connection.purpose", "confidence": 0.94, "reason": "Tests understanding of 'famous for' purpose connection"}]},
        {"first_half": "We always leave a generous tip", "second_half": "when the service exceeds our expectations.", "id": 6, "nano_skill": [{"name": "ns.B1.reading.clause_connection.condition", "confidence": 0.93, "reason": "Tests understanding of conditional 'when' clause"}]},
        {"first_half": "The curry was so incredibly spicy", "second_half": "that I had to order a glass of milk.", "id": 7, "nano_skill": [{"name": "ns.B1.reading.clause_connection.result", "confidence": 0.93, "reason": "Tests understanding of 'so...that' result clause"}]},
        {"first_half": "Would you like to try the chocolate lava cake", "second_half": "which our pastry chef made fresh today?", "id": 8, "nano_skill": [{"name": "ns.B1.reading.clause_connection.relative", "confidence": 0.93, "reason": "Tests understanding of relative clause with 'which'"}]},
        {"first_half": "The restaurant refused to serve us", "second_half": "because we arrived after their closing time.", "id": 9, "nano_skill": [{"name": "ns.A2.reading.clause_connection.cause", "confidence": 0.94, "reason": "Tests understanding of causal 'because' connection"}]},
        {"first_half": "My grandmother taught me how to cook", "second_half": "traditional French dishes when I was young.", "id": 10, "nano_skill": [{"name": "ns.A2.reading.clause_connection.time", "confidence": 0.94, "reason": "Tests understanding of temporal 'when' clause"}]}
      ],
      "teacher_tip": "After matching, have students read the complete sentences aloud to practice pronunciation and natural sentence rhythm."
    }`;

// =============== 12 NEW EXERCISES - PHASE 3 (2 exercises) ===============

export const getDescribePictureExercise = () => `    {
      "type": "describe-picture",
      "title": "Exercise 19: Describe the Picture",
      "icon": "fa-image",
      "time": 10,
      "instructions": "Look at the image and describe what you see using the vocabulary from this lesson.",
      "image_description": "Based on the provided image, create a detailed description of what is visible in the scene.",
      "prompts": [
        {"text": "Describe the overall scene and atmosphere you observe in the image.", "nano_skill": [{"name": "ns.A2.speaking.scene_description", "confidence": 0.40, "reason": "Tests ability to describe visual scenes"}, {"name": "ns.A2.writing.descriptive_response", "confidence": 0.91, "reason": "Tests written descriptive ability"}]},
        {"text": "What specific objects, people, or elements can you identify?", "nano_skill": [{"name": "ns.A2.speaking.object_identification", "confidence": 0.40, "reason": "Tests ability to identify and name visual elements"}, {"name": "ns.A2.writing.listing_from_observation", "confidence": 0.92, "reason": "Tests written listing from visual observation"}]},
        {"text": "What colors, textures, or visual details stand out to you?", "nano_skill": [{"name": "ns.A2.speaking.visual_detail_description", "confidence": 0.40, "reason": "Tests descriptive vocabulary for visual details"}, {"name": "ns.A2.writing.adjective_usage", "confidence": 0.93, "reason": "Tests written adjective usage"}]},
        {"text": "What activity or situation is taking place in this image?", "nano_skill": [{"name": "ns.A2.speaking.activity_description", "confidence": 0.40, "reason": "Tests describing actions and situations"}, {"name": "ns.A2.writing.present_continuous_description", "confidence": 0.90, "reason": "Tests written present continuous for describing activities"}]},
        {"text": "How would you describe the mood or feeling this image conveys?", "nano_skill": [{"name": "ns.B1.speaking.emotion_expression", "confidence": 0.35, "reason": "Tests expressing mood and atmosphere"}, {"name": "ns.B1.writing.mood_description", "confidence": 0.93, "reason": "Tests written mood description"}]},
        {"text": "What details in the image are most interesting or unusual?", "nano_skill": [{"name": "ns.B1.speaking.observation_analysis", "confidence": 0.35, "reason": "Tests analytical observation skills"}, {"name": "ns.B1.writing.analytical_response", "confidence": 0.90, "reason": "Tests written analytical response"}]},
        {"text": "If you were in this scene, what would you notice first?", "nano_skill": [{"name": "ns.B1.speaking.hypothetical_reasoning", "confidence": 0.35, "reason": "Tests hypothetical scenario description"}, {"name": "ns.B1.writing.conditional_response", "confidence": 0.91, "reason": "Tests written conditional response"}]},
        {"text": "What story could you tell based on what you see in the image?", "nano_skill": [{"name": "ns.B1.speaking.narrative_construction", "confidence": 0.35, "reason": "Tests narrative construction from visual"}, {"name": "ns.B1.writing.narrative_construction", "confidence": 0.90, "reason": "Tests written narrative construction"}]},
        {"text": "What questions would you ask about what's happening in the picture?", "nano_skill": [{"name": "ns.A2.speaking.question_formation", "confidence": 0.40, "reason": "Tests question formation skills"}, {"name": "ns.A2.writing.question_formation", "confidence": 0.91, "reason": "Tests written question formation"}]},
        {"text": "Compare this scene to a similar one from your own experience.", "nano_skill": [{"name": "ns.B1.speaking.comparison_and_contrast", "confidence": 0.35, "reason": "Tests comparative description skills"}, {"name": "ns.B1.writing.comparative_response", "confidence": 0.92, "reason": "Tests written comparative response"}]}
      ],
      "useful_vocabulary": ["visible", "prominent", "background", "foreground", "detailed", "noticeable", "apparent", "striking", "distinctive", "characteristic"],
      "teacher_tip": "Encourage students to use descriptive adjectives and specific details from the image. Ask follow-up questions to extend their descriptions and practice new vocabulary. NOTE: If an image URL is provided in the exercise data, reference that specific image in your instructions and prompts."
    }`;

export const getAnswerQuestionsExercise = () => `    {
      "type": "answer-questions",
      "title": "Exercise 20: Answer Questions",
      "icon": "fa-question-circle",
      "time": 8,
      "instructions": "Answer these questions about your personal food preferences and restaurant experiences.",
      "questions": [
        {"question": "What's your favorite restaurant in your city, and why do you think it's better than others?", "focus": "Comparatives and personal preferences", "nano_skill": [{"name": "ns.A2.comparatives.irregular_better", "confidence": 0.90, "reason": "Tests comparative 'better than' structure"}, {"name": "ns.A2.writing.comparative_response", "confidence": 0.90, "reason": "Tests written comparative response"}, {"name": "ns.A2.speaking.comparative_response", "confidence": 0.40, "reason": "Indirect speaking: student explains comparative preference"}]},
        {"question": "Describe the worst restaurant experience you've ever had. What went wrong?", "focus": "Past tense and complaint language", "nano_skill": [{"name": "ns.A2.superlatives.irregular_worst", "confidence": 0.90, "reason": "Tests superlative 'worst'"}, {"name": "ns.A2.writing.past_tense_narrative", "confidence": 0.90, "reason": "Tests written past tense narrative"}, {"name": "ns.A2.speaking.past_tense_narrative", "confidence": 0.40, "reason": "Indirect speaking: student narrates past experience"}]},
        {"question": "If you could open your own restaurant, what type of cuisine would you serve and why?", "focus": "Conditional and future plans", "nano_skill": [{"name": "ns.B1.second_conditional.hypothetical_situation", "confidence": 0.90, "reason": "Tests second conditional structure"}, {"name": "ns.B1.writing.conditional_response", "confidence": 0.90, "reason": "Tests written conditional response"}, {"name": "ns.B1.speaking.conditional_response", "confidence": 0.40, "reason": "Indirect speaking: student describes hypothetical scenario"}]},
        {"question": "How do you usually react when you receive poor service in a restaurant?", "focus": "Present habits and complaint strategies", "nano_skill": [{"name": "ns.A2.speaking.describing_reaction", "confidence": 0.40, "reason": "Tests describing habitual reactions"}, {"name": "ns.A2.writing.habitual_action_description", "confidence": 0.90, "reason": "Tests written habitual action description"}]},
        {"question": "What's the most expensive meal you've ever eaten? Was it worth the price?", "focus": "Superlatives and past experiences", "nano_skill": [{"name": "ns.A2.superlatives.long_adjective_most_expensive", "confidence": 0.90, "reason": "Tests superlative with long adjective"}, {"name": "ns.A2.writing.superlative_narrative", "confidence": 0.90, "reason": "Tests written superlative narrative"}, {"name": "ns.A2.speaking.superlative_narrative", "confidence": 0.40, "reason": "Indirect speaking: student narrates superlative experience"}]},
        {"question": "Do you prefer eating at home or dining out? Give three reasons for your preference.", "focus": "Comparisons and justification", "nano_skill": [{"name": "ns.A2.speaking.comparison_and_contrast", "confidence": 0.40, "reason": "Tests comparative reasoning"}, {"name": "ns.A2.writing.comparative_response", "confidence": 0.90, "reason": "Tests written comparative response"}]},
        {"question": "What advice would you give to someone visiting a restaurant in your country for the first time?", "focus": "Modal verbs and cultural advice", "nano_skill": [{"name": "ns.B1.modal_verbs.giving_advice", "confidence": 0.90, "reason": "Tests modal verb usage for advice"}, {"name": "ns.B1.writing.advice_structure", "confidence": 0.90, "reason": "Tests written advice structure"}, {"name": "ns.B1.speaking.giving_advice", "confidence": 0.40, "reason": "Indirect speaking: student gives advice"}]},
        {"question": "How has your taste in food changed as you've gotten older?", "focus": "Present perfect and personal development", "nano_skill": [{"name": "ns.B1.present_perfect.change_over_time", "confidence": 0.90, "reason": "Tests present perfect for describing change"}, {"name": "ns.B1.writing.present_perfect_narrative", "confidence": 0.90, "reason": "Tests written present perfect narrative"}, {"name": "ns.B1.speaking.present_perfect_narrative", "confidence": 0.40, "reason": "Indirect speaking: student narrates change over time"}]}
      ],
      "teacher_tip": "Focus on encouraging full answers rather than just yes/no responses. Ask follow-up questions to help students elaborate and use more complex sentence structures."
    }`;

// =============== PICTURE-BASED EXERCISE VERSIONS ===============

export const getMultipleChoicePictureExercise = () => `    {
      "type": "multiple-choice-picture",
      "title": "Exercise X: Multiple Choice - Picture Analysis",
      "icon": "fa-check-square",
      "time": 8,
      "instructions": "Look at the image carefully and choose the best answer to each question.",
      "questions": [
        {
          "text": "What is the main focus of this picture?",
          "options": [
            {"label": "A", "text": "A person eating alone", "correct": false},
            {"label": "B", "text": "A busy restaurant scene", "correct": true},
            {"label": "C", "text": "A kitchen interior", "correct": false},
            {"label": "D", "text": "A food delivery", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.visual_comprehension.main_focus_identification", "confidence": 0.95, "reason": "Tests identifying main focus of visual scene"}]
        },
        {
          "text": "How would you describe the atmosphere in this image?",
          "options": [
            {"label": "A", "text": "Quiet and empty", "correct": false},
            {"label": "B", "text": "Crowded and lively", "correct": true},
            {"label": "C", "text": "Formal and elegant", "correct": false},
            {"label": "D", "text": "Dark and gloomy", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.vocabulary.definition_atmosphere", "confidence": 0.94, "reason": "Tests atmosphere description adjectives"}]
        },
        {
          "text": "What type of food can you see in the picture?",
          "options": [
            {"label": "A", "text": "Only desserts", "correct": false},
            {"label": "B", "text": "Various international dishes", "correct": true},
            {"label": "C", "text": "Only breakfast items", "correct": false},
            {"label": "D", "text": "Only beverages", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.vocabulary.food_identification", "confidence": 0.94, "reason": "Tests food type identification from visual"}]
        },
        {
          "text": "How many people are visible in this restaurant scene?",
          "options": [
            {"label": "A", "text": "None", "correct": false},
            {"label": "B", "text": "One or two", "correct": false},
            {"label": "C", "text": "Several people", "correct": true},
            {"label": "D", "text": "Only staff members", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.visual_comprehension.detail_observation", "confidence": 0.94, "reason": "Tests counting and observing people in image"}]
        },
        {
          "text": "What can you infer about the service style from the image?",
          "options": [
            {"label": "A", "text": "Self-service only", "correct": false},
            {"label": "B", "text": "Table service by waiters", "correct": true},
            {"label": "C", "text": "Takeaway only", "correct": false},
            {"label": "D", "text": "Food truck style", "correct": false}
          ],
          "nano_skill": [{"name": "ns.B1.visual_comprehension.inference_from_visual", "confidence": 0.93, "reason": "Tests inferring service style from visual cues"}]
        },
        {
          "text": "Which best describes the restaurant's style?",
          "options": [
            {"label": "A", "text": "Fast food chain", "correct": false},
            {"label": "B", "text": "Casual dining establishment", "correct": true},
            {"label": "C", "text": "Fine dining restaurant", "correct": false},
            {"label": "D", "text": "Street food vendor", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.vocabulary.contextual_meaning", "confidence": 0.94, "reason": "Tests restaurant style vocabulary"}]
        },
        {
          "text": "What time of day does this picture suggest?",
          "options": [
            {"label": "A", "text": "Early morning", "correct": false},
            {"label": "B", "text": "Lunch or dinner time", "correct": true},
            {"label": "C", "text": "Late night", "correct": false},
            {"label": "D", "text": "Breakfast time", "correct": false}
          ],
          "nano_skill": [{"name": "ns.B1.visual_comprehension.inference_from_visual", "confidence": 0.93, "reason": "Tests time inference from visual cues"}]
        },
        {
          "text": "What emotion do the customers seem to be showing?",
          "options": [
            {"label": "A", "text": "Anger and frustration", "correct": false},
            {"label": "B", "text": "Enjoyment and satisfaction", "correct": true},
            {"label": "C", "text": "Boredom and disinterest", "correct": false},
            {"label": "D", "text": "Confusion and worry", "correct": false}
          ],
          "nano_skill": [{"name": "ns.B1.visual_comprehension.emotion_inference", "confidence": 0.93, "reason": "Tests inferring emotions from visual expressions"}]
        },
        {
          "text": "Based on the image, which statement is most accurate?",
          "options": [
            {"label": "A", "text": "The restaurant appears to be closing", "correct": false},
            {"label": "B", "text": "The restaurant is popular and busy", "correct": true},
            {"label": "C", "text": "The restaurant has poor service", "correct": false},
            {"label": "D", "text": "The restaurant serves only one type of cuisine", "correct": false}
          ],
          "nano_skill": [{"name": "ns.B1.visual_comprehension.inference_validation", "confidence": 0.93, "reason": "Tests validating statements against visual evidence"}]
        },
        {
          "text": "What can you see on the tables in this picture?",
          "options": [
            {"label": "A", "text": "Only empty plates", "correct": false},
            {"label": "B", "text": "Food dishes and beverages", "correct": true},
            {"label": "C", "text": "Only menus", "correct": false},
            {"label": "D", "text": "Nothing at all", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.visual_comprehension.detail_observation", "confidence": 0.94, "reason": "Tests observing specific details on tables"}]
        }
      ],
      "teacher_tip": "After choosing answers, ask students to explain WHY they selected each answer by referencing specific details they can see in the image. This develops critical thinking and descriptive language skills."
    }`;

export const getTrueFalsePictureExercise = () => `    {
      "type": "true-false-picture",
      "title": "Exercise X: True or False - Picture Analysis",
      "icon": "fa-balance-scale",
      "time": 5,
      "instructions": "Look at the image carefully and decide if each statement is true or false based on what you can see.",
      "statements": [
        {"text": "The restaurant in the picture appears to be busy with customers.", "isTrue": true, "nano_skill": [{"name": "ns.A2.visual_comprehension.visual_evidence_evaluation", "confidence": 0.95, "reason": "Tests evaluating 'busy' claim against visual"}]},
        {"text": "There is no food visible on any of the tables.", "isTrue": false, "nano_skill": [{"name": "ns.A2.visual_comprehension.negative_statement_verification", "confidence": 0.94, "reason": "Tests verifying negative statement 'no food'"}]},
        {"text": "You can see staff members working in this restaurant.", "isTrue": true, "nano_skill": [{"name": "ns.A2.visual_comprehension.visual_evidence_evaluation", "confidence": 0.94, "reason": "Tests identifying staff in image"}]},
        {"text": "The restaurant looks completely empty with no people.", "isTrue": false, "nano_skill": [{"name": "ns.A2.visual_comprehension.negative_statement_verification", "confidence": 0.94, "reason": "Tests verifying false 'empty' claim"}]},
        {"text": "There are multiple tables with customers in the image.", "isTrue": true, "nano_skill": [{"name": "ns.A2.visual_comprehension.visual_evidence_evaluation", "confidence": 0.94, "reason": "Tests counting tables with customers"}]},
        {"text": "The picture shows only the kitchen area of a restaurant.", "isTrue": false, "nano_skill": [{"name": "ns.A2.visual_comprehension.detail_verification", "confidence": 0.94, "reason": "Tests verifying spatial claim about image"}]},
        {"text": "People in the image appear to be enjoying their meals.", "isTrue": true, "nano_skill": [{"name": "ns.A2.visual_comprehension.inference_validation", "confidence": 0.93, "reason": "Tests inferring enjoyment from visual cues"}]},
        {"text": "The restaurant appears to be closed and dark.", "isTrue": false, "nano_skill": [{"name": "ns.A2.visual_comprehension.negative_statement_verification", "confidence": 0.94, "reason": "Tests verifying false 'closed' claim"}]},
        {"text": "You can see different types of dishes on the tables.", "isTrue": true, "nano_skill": [{"name": "ns.A2.visual_comprehension.visual_evidence_evaluation", "confidence": 0.94, "reason": "Tests observing variety of dishes"}]},
        {"text": "The image shows a very formal, expensive fine dining restaurant.", "isTrue": false, "nano_skill": [{"name": "ns.B1.visual_comprehension.inference_validation", "confidence": 0.93, "reason": "Tests inferring restaurant type from visual style"}]}
      ],
      "teacher_tip": "After completing the exercise, ask students to provide evidence from the image to support their true/false answers. This helps them practice giving detailed descriptions and justifications."
    }`;

export const getAnswerQuestionsPictureExercise = () => `    {
      "type": "answer-questions-picture",
      "title": "Exercise X: Answer Questions About the Picture",
      "icon": "fa-question-circle",
      "time": 8,
      "instructions": "Look at the image and answer these questions based on what you can see and your personal opinions.",
      "questions": [
        {"question": "Describe the atmosphere of the restaurant you see in the picture. Use at least 3 adjectives.", "focus": "Descriptive vocabulary and observation", "nano_skill": [{"name": "ns.A2.speaking.scene_description", "confidence": 0.40, "reason": "Tests describing atmosphere from image"}, {"name": "ns.A2.writing.adjective_usage", "confidence": 0.90, "reason": "Tests written adjective usage for description"}]},
        {"question": "What types of food can you identify in the image? Compare them to food you enjoy eating.", "focus": "Food vocabulary and comparisons", "nano_skill": [{"name": "ns.A2.vocabulary.food_identification", "confidence": 0.90, "reason": "Tests identifying food types from visual"}, {"name": "ns.A2.writing.listing_from_observation", "confidence": 0.90, "reason": "Tests written listing from visual observation"}, {"name": "ns.A2.speaking.food_identification", "confidence": 0.40, "reason": "Indirect speaking: student identifies food types"}]},
        {"question": "How many people can you see in the restaurant? What do you think they are doing?", "focus": "Present continuous and speculation", "nano_skill": [{"name": "ns.A2.speaking.scene_description", "confidence": 0.40, "reason": "Tests scene description with present continuous"}, {"name": "ns.A2.writing.present_continuous_description", "confidence": 0.90, "reason": "Tests written present continuous description"}]},
        {"question": "Would you like to eat at this restaurant? Why or why not? Give specific reasons.", "focus": "Expressing preferences and justification", "nano_skill": [{"name": "ns.A2.speaking.opinion_expression", "confidence": 0.40, "reason": "Tests opinion expression with justification"}, {"name": "ns.A2.writing.opinion_justification", "confidence": 0.90, "reason": "Tests written opinion justification"}]},
        {"question": "Compare this restaurant to your favorite restaurant. What's similar and what's different?", "focus": "Comparatives and contrasts", "nano_skill": [{"name": "ns.A2.speaking.comparison", "confidence": 0.40, "reason": "Tests comparative description"}, {"name": "ns.A2.writing.comparative_response", "confidence": 0.90, "reason": "Tests written comparative response"}]},
        {"question": "What can you say about the service style based on what you see in the picture?", "focus": "Inference and deduction", "nano_skill": [{"name": "ns.B1.speaking.observation_analysis", "confidence": 0.35, "reason": "Tests analytical observation"}, {"name": "ns.B1.writing.analytical_response", "confidence": 0.90, "reason": "Tests written analytical response"}]},
        {"question": "Imagine you are eating at this restaurant. What would you order and why?", "focus": "Hypothetical situations and food vocabulary", "nano_skill": [{"name": "ns.A2.speaking.expressing_preference", "confidence": 0.40, "reason": "Tests expressing food preferences"}, {"name": "ns.A2.writing.preference_justification", "confidence": 0.90, "reason": "Tests written preference justification"}]},
        {"question": "What time of day do you think this picture was taken? What details make you think that?", "focus": "Evidence-based reasoning", "nano_skill": [{"name": "ns.B1.speaking.evidence_based_reasoning", "confidence": 0.35, "reason": "Tests evidence-based reasoning"}, {"name": "ns.B1.writing.evidence_based_response", "confidence": 0.90, "reason": "Tests written evidence-based response"}]},
        {"question": "How does the restaurant in the picture compare to typical restaurants in your country?", "focus": "Cultural comparison and description", "nano_skill": [{"name": "ns.B1.speaking.comparison", "confidence": 0.35, "reason": "Tests cultural comparison"}, {"name": "ns.B1.writing.comparison", "confidence": 0.90, "reason": "Tests written cultural comparison"}]},
        {"question": "If you were the manager of this restaurant, what would you improve and what would you keep the same?", "focus": "Conditional and critical thinking", "nano_skill": [{"name": "ns.B2.second_conditional.hypothetical_situation", "confidence": 0.90, "reason": "Tests second conditional structure"}, {"name": "ns.B2.writing.conditional_response", "confidence": 0.90, "reason": "Tests written conditional response"}, {"name": "ns.B2.speaking.conditional_response", "confidence": 0.40, "reason": "Indirect speaking: student discusses hypothetical changes"}]}
      ],
      "teacher_tip": "Encourage students to refer directly to specific visual details in the picture when answering. This develops their ability to provide evidence and detailed descriptions in English."
    }`;

export const getVocabularySheet = () => `  "vocabulary_sheet": [
    {"term": "Appetizer", "meaning": "A small dish served before the main meal to stimulate the appetite."},
    {"term": "Main course", "meaning": "The primary or largest dish in a meal."},
    {"term": "Dessert", "meaning": "A sweet course served at the end of a meal."},
    {"term": "Beverage", "meaning": "A drink, especially one other than water."},
    {"term": "Reservation", "meaning": "An arrangement to have a table kept for you at a restaurant."},
    {"term": "Waiter / Waitress", "meaning": "A person who serves customers in a restaurant."},
    {"term": "Menu", "meaning": "A list of dishes available at a restaurant."},
    {"term": "Order", "meaning": "A request for food or drink in a restaurant."},
    {"term": "Complaint", "meaning": "An expression of dissatisfaction about food or service."},
    {"term": "Wrong order", "meaning": "When the dish served is not what the customer requested."},
    {"term": "Overcooked", "meaning": "Food that has been cooked for too long and is ruined."},
    {"term": "Undercooked", "meaning": "Food that has not been cooked enough."},
    {"term": "Allergy", "meaning": "A harmful reaction to certain foods or ingredients."},
    {"term": "Bill / Check", "meaning": "A statement of the money owed for the meal."},
    {"term": "Tip", "meaning": "An extra amount of money given to the waiter as a thank you for good service."}
  ]`;

// =============== AUDIO-BASED EXERCISE VERSIONS ===============

export const getListeningComprehensionExercise = () => `    {
      "type": "listening-comprehension",
      "title": "Exercise X: Listening Comprehension",
      "icon": "fa-headphones",
      "time": 12,
      "instructions": "Listen to the audio carefully and answer the following questions based on what you hear.",
      "audio_url": null,
      "questions": [
        {"text": "What is the main topic or situation in the audio?", "answer": "The audio discusses [specific topic], where [main situation/event].", "nano_skill": [{"name": "ns.B1.listening.main_idea_identification", "confidence": 0.95, "reason": "Tests identifying main topic from audio"}, {"name": "ns.B1.writing.summary_response", "confidence": 0.90, "reason": "Tests written summary of audio content"}, {"name": "ns.B1.speaking.summary_response", "confidence": 0.40, "reason": "Indirect speaking: student summarizes audio"}]},
        {"text": "Who are the speakers in the audio? What are their roles or relationships?", "answer": "The speakers are [description of speakers and their relationship].", "nano_skill": [{"name": "ns.B1.listening.speaker_identification", "confidence": 0.95, "reason": "Tests identifying who is speaking"}, {"name": "ns.B1.writing.descriptive_response", "confidence": 0.88, "reason": "Tests written description of speakers"}, {"name": "ns.B1.speaking.descriptive_response", "confidence": 0.40, "reason": "Indirect speaking: student describes speakers"}]},
        {"text": "What specific details or facts are mentioned in the audio?", "answer": "[Specific details from audio: numbers, names, places, times].", "nano_skill": [{"name": "ns.B1.listening.detail_extraction", "confidence": 0.95, "reason": "Tests extracting specific facts from audio"}, {"name": "ns.B1.writing.listing_from_audio", "confidence": 0.88, "reason": "Tests written listing of audio details"}, {"name": "ns.B1.speaking.detail_response", "confidence": 0.40, "reason": "Indirect speaking: student lists audio details"}]},
        {"text": "What problem or challenge is discussed, and how is it addressed?", "answer": "The problem is [description], and it is addressed by [solution/approach].", "nano_skill": [{"name": "ns.B1.listening.cause_effect_identification", "confidence": 0.95, "reason": "Tests identifying problems and solutions from audio"}, {"name": "ns.B1.writing.cause_effect_response", "confidence": 0.90, "reason": "Tests written cause-effect explanation"}, {"name": "ns.B1.speaking.cause_effect_explanation", "confidence": 0.40, "reason": "Indirect speaking: student explains problem-solution"}]},
        {"text": "What is the tone or mood of the audio? (formal/informal, serious/casual, etc.)", "answer": "The tone is [description of tone/mood].", "nano_skill": [{"name": "ns.B1.listening.tone_analysis", "confidence": 0.95, "reason": "Tests analyzing tone from audio"}, {"name": "ns.B1.writing.mood_description", "confidence": 0.88, "reason": "Tests written mood description"}, {"name": "ns.B1.speaking.mood_description", "confidence": 0.40, "reason": "Indirect speaking: student describes mood"}]},
        {"text": "What happens at the beginning, middle, and end of the audio?", "answer": "Beginning: [description]. Middle: [description]. End: [description].", "nano_skill": [{"name": "ns.B1.listening.sequence_of_events", "confidence": 0.95, "reason": "Tests tracking sequence from audio"}, {"name": "ns.B1.writing.narrative_sequence", "confidence": 0.90, "reason": "Tests written narrative sequence"}, {"name": "ns.B1.speaking.narrative_sequence", "confidence": 0.40, "reason": "Indirect speaking: student narrates sequence"}]},
        {"text": "What opinions or suggestions are given by the speakers?", "answer": "[Opinions/suggestions mentioned in audio].", "nano_skill": [{"name": "ns.B1.listening.opinion_identification", "confidence": 0.95, "reason": "Tests identifying opinions from audio"}, {"name": "ns.B1.writing.opinion_summary", "confidence": 0.88, "reason": "Tests written opinion summary"}, {"name": "ns.B1.speaking.opinion_summary", "confidence": 0.40, "reason": "Indirect speaking: student summarizes opinions"}]},
        {"text": "What cultural or contextual information can you infer from the audio?", "answer": "[Cultural/contextual details that can be inferred].", "nano_skill": [{"name": "ns.B2.listening.cultural_inference", "confidence": 0.95, "reason": "Tests cultural inference from audio"}, {"name": "ns.B2.writing.cultural_analysis", "confidence": 0.88, "reason": "Tests written cultural analysis"}, {"name": "ns.B2.speaking.cultural_analysis", "confidence": 0.40, "reason": "Indirect speaking: student discusses cultural aspects"}]},
        {"text": "What emotions do the speakers express during the conversation?", "answer": "[Emotions and feelings expressed by speakers].", "nano_skill": [{"name": "ns.B1.listening.emotion_inference", "confidence": 0.95, "reason": "Tests inferring emotions from voice"}, {"name": "ns.B1.writing.emotion_description", "confidence": 0.88, "reason": "Tests written emotion description"}, {"name": "ns.B1.speaking.emotion_description", "confidence": 0.40, "reason": "Indirect speaking: student describes emotions"}]},
        {"text": "What is the outcome or conclusion of the audio scenario?", "answer": "[Final outcome or resolution mentioned in audio].", "nano_skill": [{"name": "ns.B1.listening.main_idea_identification", "confidence": 0.95, "reason": "Tests identifying conclusion from audio"}, {"name": "ns.B1.writing.conclusion_summary", "confidence": 0.88, "reason": "Tests written conclusion summary"}, {"name": "ns.B1.speaking.conclusion_summary", "confidence": 0.40, "reason": "Indirect speaking: student summarizes conclusion"}]}
      ],
      "teacher_tip": "Play the audio 2-3 times. First time: general understanding. Second time: focus on details. Third time: verification of answers. Encourage students to take notes while listening."
    }`;

export const getMultipleChoiceAudioExercise = () => `    {
      "type": "multiple-choice-audio",
      "title": "Exercise X: Multiple Choice - Audio Analysis",
      "icon": "fa-check-square",
      "time": 10,
      "instructions": "Listen to the audio and choose the best answer to each question.",
      "audio_url": null,
      "questions": [
        {
          "text": "What is the main purpose of this audio?",
          "options": [
            {"label": "A", "text": "To give information", "correct": true},
            {"label": "B", "text": "To entertain", "correct": false},
            {"label": "C", "text": "To complain", "correct": false},
            {"label": "D", "text": "To persuade", "correct": false}
          ],
          "nano_skill": [{"name": "ns.B1.listening.main_idea_identification", "confidence": 0.96, "reason": "Tests identifying speaker's main purpose"}]
        },
        {
          "text": "Where does this conversation most likely take place?",
          "options": [
            {"label": "A", "text": "At home", "correct": false},
            {"label": "B", "text": "At a restaurant", "correct": true},
            {"label": "C", "text": "At a school", "correct": false},
            {"label": "D", "text": "At an office", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.listening.detail_extraction", "confidence": 0.95, "reason": "Tests inferring location from audio cues"}]
        },
        {
          "text": "What time is mentioned in the audio?",
          "options": [
            {"label": "A", "text": "Morning", "correct": false},
            {"label": "B", "text": "Afternoon", "correct": true},
            {"label": "C", "text": "Evening", "correct": false},
            {"label": "D", "text": "Night", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.listening.detail_extraction", "confidence": 0.95, "reason": "Tests extracting time reference from audio"}]
        },
        {
          "text": "How does the speaker feel about the situation?",
          "options": [
            {"label": "A", "text": "Angry", "correct": false},
            {"label": "B", "text": "Happy", "correct": false},
            {"label": "C", "text": "Concerned", "correct": true},
            {"label": "D", "text": "Indifferent", "correct": false}
          ],
          "nano_skill": [{"name": "ns.B1.listening.emotion_inference", "confidence": 0.94, "reason": "Tests inferring speaker emotion from voice"}]
        },
        {
          "text": "What specific detail is mentioned about the topic?",
          "options": [
            {"label": "A", "text": "Detail A", "correct": true},
            {"label": "B", "text": "Detail B", "correct": false},
            {"label": "C", "text": "Detail C", "correct": false},
            {"label": "D", "text": "Detail D", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.listening.detail_extraction", "confidence": 0.95, "reason": "Tests extracting specific detail from audio"}]
        },
        {
          "text": "What does the speaker plan to do next?",
          "options": [
            {"label": "A", "text": "Option A", "correct": false},
            {"label": "B", "text": "Option B", "correct": false},
            {"label": "C", "text": "Option C", "correct": true},
            {"label": "D", "text": "Option D", "correct": false}
          ],
          "nano_skill": [{"name": "ns.B1.listening.inference_from_context", "confidence": 0.94, "reason": "Tests inferring future plans from audio"}]
        },
        {
          "text": "What tone does the speaker use?",
          "options": [
            {"label": "A", "text": "Aggressive", "correct": false},
            {"label": "B", "text": "Polite but firm", "correct": true},
            {"label": "C", "text": "Sarcastic", "correct": false},
            {"label": "D", "text": "Apologetic", "correct": false}
          ],
          "nano_skill": [{"name": "ns.B1.listening.tone_analysis", "confidence": 0.94, "reason": "Tests analyzing speaker's tone"}]
        },
        {
          "text": "What specific information is mentioned?",
          "options": [
            {"label": "A", "text": "Information A", "correct": false},
            {"label": "B", "text": "Information B", "correct": true},
            {"label": "C", "text": "Information C", "correct": false},
            {"label": "D", "text": "Information D", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.listening.detail_extraction", "confidence": 0.95, "reason": "Tests extracting factual information"}]
        },
        {
          "text": "Who initiates the conversation in the audio?",
          "options": [
            {"label": "A", "text": "Person A", "correct": true},
            {"label": "B", "text": "Person B", "correct": false},
            {"label": "C", "text": "Person C", "correct": false},
            {"label": "D", "text": "Person D", "correct": false}
          ],
          "nano_skill": [{"name": "ns.A2.listening.speaker_identification", "confidence": 0.94, "reason": "Tests identifying conversation initiator"}]
        },
        {
          "text": "What is the relationship between the speakers?",
          "options": [
            {"label": "A", "text": "Friends", "correct": false},
            {"label": "B", "text": "Colleagues", "correct": false},
            {"label": "C", "text": "Service provider and customer", "correct": true},
            {"label": "D", "text": "Family members", "correct": false}
          ],
          "nano_skill": [{"name": "ns.B1.listening.speaker_identification", "confidence": 0.94, "reason": "Tests inferring speaker relationship"}]
        }
      ],
      "teacher_tip": "After choosing answers, ask students to explain WHY they selected each answer by referencing specific words or phrases they heard in the audio."
    }`;

export const getTrueFalseAudioExercise = () => `    {
      "type": "true-false-audio",
      "title": "Exercise X: True or False - Audio Analysis",
      "icon": "fa-balance-scale",
      "time": 6,
      "instructions": "Listen to the audio carefully and decide if each statement is true or false based on what you hear.",
      "audio_url": null,
      "statements": [
        {"text": "The speakers mention a specific time in the audio.", "isTrue": true, "nano_skill": [{"name": "ns.A2.listening.detail_extraction", "confidence": 0.95, "reason": "Tests detecting time references in audio"}]},
        {"text": "The conversation takes place in the morning.", "isTrue": false, "nano_skill": [{"name": "ns.B1.listening.inference_validation", "confidence": 0.94, "reason": "Tests inferring time of day from context"}]},
        {"text": "One of the speakers expresses dissatisfaction.", "isTrue": true, "nano_skill": [{"name": "ns.B1.listening.emotion_inference", "confidence": 0.94, "reason": "Tests detecting dissatisfaction in speech"}]},
        {"text": "The audio mentions a price or cost.", "isTrue": true, "nano_skill": [{"name": "ns.A2.listening.detail_extraction", "confidence": 0.95, "reason": "Tests detecting price mentions in audio"}]},
        {"text": "The speakers are planning to leave immediately.", "isTrue": false, "nano_skill": [{"name": "ns.B1.listening.inference_validation", "confidence": 0.94, "reason": "Tests validating false inference about plans"}]},
        {"text": "The audio includes a discussion about quality.", "isTrue": true, "nano_skill": [{"name": "ns.A2.listening.detail_extraction", "confidence": 0.95, "reason": "Tests detecting quality discussion in audio"}]},
        {"text": "The speakers sound angry and aggressive.", "isTrue": false, "nano_skill": [{"name": "ns.B1.listening.tone_analysis", "confidence": 0.94, "reason": "Tests analyzing emotional tone accurately"}]},
        {"text": "A specific location or place is mentioned.", "isTrue": true, "nano_skill": [{"name": "ns.A2.listening.detail_extraction", "confidence": 0.95, "reason": "Tests detecting location references"}]},
        {"text": "The speakers agree on everything discussed.", "isTrue": false, "nano_skill": [{"name": "ns.B1.listening.inference_validation", "confidence": 0.94, "reason": "Tests detecting disagreement in audio"}]},
        {"text": "The audio ends with a clear resolution.", "isTrue": true, "nano_skill": [{"name": "ns.B1.listening.sequence_of_events", "confidence": 0.94, "reason": "Tests tracking resolution at end of audio"}]}
      ],
      "teacher_tip": "After completing the exercise, ask students to provide evidence from the audio to support their true/false answers. This helps them practice active listening and justification."
    }`;

export const getFillInBlanksAudioExercise = () => `    {
      "type": "fill-in-blanks-audio",
      "title": "Exercise X: Fill in the Blanks - Audio Dictation",
      "icon": "fa-pencil-alt",
      "time": 10,
      "instructions": "Listen to the audio and complete the sentences below with the missing words you hear.",
      "sentences": [
        {"text": "Welcome to _______ Restaurant.", "answer": "Mario's", "nano_skill": [{"name": "ns.A2.listening.proper_noun_recognition", "confidence": 0.95, "reason": "Tests recognizing proper noun from audio"}]},
        {"text": "I'm _______ and I'll be your _______ today.", "answer": "Jennifer, waitress", "nano_skill": [{"name": "ns.A2.listening.detail_extraction", "confidence": 0.94, "reason": "Tests recognizing names and roles from audio"}]},
        {"text": "Can I start you off with something to _______?", "answer": "drink", "nano_skill": [{"name": "ns.A2.listening.keyword_extraction", "confidence": 0.94, "reason": "Tests extracting key verb from audio"}]},
        {"text": "We have some _______ specials today.", "answer": "excellent", "nano_skill": [{"name": "ns.A2.listening.adjective_recognition", "confidence": 0.94, "reason": "Tests recognizing quality adjective from audio"}]},
        {"text": "The chef _______ the grilled salmon.", "answer": "recommends", "nano_skill": [{"name": "ns.A2.listening.verb_recognition", "confidence": 0.94, "reason": "Tests recognizing recommendation verb"}]},
        {"text": "It comes with _______ vegetables.", "answer": "seasonal", "nano_skill": [{"name": "ns.B1.listening.adjective_recognition", "confidence": 0.93, "reason": "Tests recognizing B1-level adjective from audio"}]},
        {"text": "This dish is _______ popular with our guests.", "answer": "very", "nano_skill": [{"name": "ns.A2.listening.adverb_recognition", "confidence": 0.94, "reason": "Tests recognizing intensifier adverb"}]},
        {"text": "Would you like to _______ our dessert menu?", "answer": "see", "nano_skill": [{"name": "ns.A2.listening.keyword_extraction", "confidence": 0.94, "reason": "Tests extracting key verb from question"}]},
        {"text": "Or would you _______ to order now?", "answer": "like", "nano_skill": [{"name": "ns.A2.listening.keyword_extraction", "confidence": 0.94, "reason": "Tests extracting 'would you like' pattern"}]},
        {"text": "I can also bring you some _______ water.", "answer": "cold", "nano_skill": [{"name": "ns.A2.listening.adjective_recognition", "confidence": 0.94, "reason": "Tests recognizing temperature adjective from audio"}]}
      ],
      "word_bank": ["Mario's", "Jennifer", "server", "drink", "excellent", "recommends", "seasonal", "very", "see", "like", "cold"],
      "teacher_tip": "CRITICAL: Use EXACT structure matching basic fill-in-blanks exercise - 'sentences' array with 'text' and 'answer' fields, plus 'word_bank' array. Each sentence has ONE blank (represented by _______). Extract key vocabulary from audio transcript. DO NOT use 'full_transcript' or 'transcript_with_blanks' fields."
    }`;

export const getAnswerQuestionsAudioExercise = () => `    {
      "type": "answer-questions-audio",
      "title": "Exercise X: Answer Questions About the Audio",
      "icon": "fa-question-circle",
      "time": 10,
      "instructions": "Listen to the audio and answer these questions based on what you hear and your personal opinions.",
      "audio_url": null,
      "questions": [
        {"question": "Describe the main situation or event you hear in the audio. What is happening?", "focus": "Comprehension and summary", "nano_skill": [{"name": "ns.B1.listening.main_idea_identification", "confidence": 0.95, "reason": "Tests summarizing main audio content"}, {"name": "ns.B1.writing.summary_response", "confidence": 0.90, "reason": "Tests written summary of audio"}, {"name": "ns.B1.speaking.summary_response", "confidence": 0.40, "reason": "Indirect speaking assessment: student summarizes audio"}]},
        {"question": "What emotions or attitudes do you hear in the speakers' voices? How can you tell?", "focus": "Tone analysis and inference", "nano_skill": [{"name": "ns.B1.listening.emotion_inference", "confidence": 0.95, "reason": "Tests analyzing emotions in speech"}, {"name": "ns.B1.writing.emotion_description", "confidence": 0.88, "reason": "Tests written emotion description"}, {"name": "ns.B1.speaking.emotion_description", "confidence": 0.40, "reason": "Indirect speaking assessment: student describes emotions"}]},
        {"question": "What specific words or phrases stood out to you? Why?", "focus": "Vocabulary and attention to detail", "nano_skill": [{"name": "ns.B1.listening.detail_extraction", "confidence": 0.95, "reason": "Tests noting specific vocabulary from audio"}, {"name": "ns.B1.writing.detail_response", "confidence": 0.88, "reason": "Tests written detail response"}, {"name": "ns.B1.speaking.detail_response", "confidence": 0.40, "reason": "Indirect speaking assessment: student explains details"}]},
        {"question": "If you were in this situation, how would you respond? What would you say?", "focus": "Personal application and speaking practice", "nano_skill": [{"name": "ns.B1.listening.detail_extraction", "confidence": 0.85, "reason": "Tests understanding situation from audio"}, {"name": "ns.B1.writing.conditional_response", "confidence": 0.90, "reason": "Tests written conditional response"}, {"name": "ns.B1.speaking.hypothetical_reasoning", "confidence": 0.40, "reason": "Indirect speaking assessment: hypothetical scenario response"}]},
        {"question": "Compare this situation to a similar experience you've had. What's similar or different?", "focus": "Personal connection and comparison", "nano_skill": [{"name": "ns.B1.listening.detail_extraction", "confidence": 0.85, "reason": "Tests understanding situation for comparison"}, {"name": "ns.B1.writing.comparative_response", "confidence": 0.90, "reason": "Tests written comparative response"}, {"name": "ns.B1.speaking.comparison_and_contrast", "confidence": 0.40, "reason": "Indirect speaking assessment: comparative description"}]},
        {"question": "What cultural insights can you gain from this audio? How might this situation differ in your country?", "focus": "Cultural awareness", "nano_skill": [{"name": "ns.B2.listening.cultural_inference", "confidence": 0.90, "reason": "Tests cultural understanding from audio"}, {"name": "ns.B2.writing.cultural_analysis", "confidence": 0.88, "reason": "Tests written cultural analysis"}, {"name": "ns.B2.speaking.cultural_comparison", "confidence": 0.40, "reason": "Indirect speaking assessment: cultural comparison"}]},
        {"question": "What do you think happens after the audio ends? Predict the next part of the conversation.", "focus": "Prediction and creative thinking", "nano_skill": [{"name": "ns.B1.listening.inference_prediction", "confidence": 0.90, "reason": "Tests prediction based on audio"}, {"name": "ns.B1.writing.prediction_response", "confidence": 0.90, "reason": "Tests written prediction"}, {"name": "ns.B1.speaking.narrative_construction", "confidence": 0.40, "reason": "Indirect speaking assessment: predictive narrative"}]},
        {"question": "What advice would you give to the speakers in this situation?", "focus": "Critical thinking and modal verbs", "nano_skill": [{"name": "ns.B1.modal_verbs.giving_advice", "confidence": 0.90, "reason": "Tests modal verb usage for advice"}, {"name": "ns.B1.writing.advice_structure", "confidence": 0.90, "reason": "Tests written advice structure"}, {"name": "ns.B1.speaking.advice_giving", "confidence": 0.40, "reason": "Indirect speaking assessment: giving advice"}]},
        {"question": "What is the most important piece of information you learned from the audio?", "focus": "Main idea identification", "nano_skill": [{"name": "ns.B1.listening.main_idea_identification", "confidence": 0.95, "reason": "Tests identifying key information"}, {"name": "ns.B1.writing.priority_identification", "confidence": 0.88, "reason": "Tests written priority identification"}, {"name": "ns.B1.speaking.priority_identification", "confidence": 0.40, "reason": "Indirect speaking assessment: identifying priorities"}]},
        {"question": "How would you describe the relationship between the speakers based on their language and tone?", "focus": "Relationship analysis and pragmatics", "nano_skill": [{"name": "ns.B1.listening.speaker_identification", "confidence": 0.95, "reason": "Tests analyzing speaker relationship"}, {"name": "ns.B1.writing.relationship_description", "confidence": 0.88, "reason": "Tests written relationship description"}, {"name": "ns.B1.speaking.relationship_analysis", "confidence": 0.40, "reason": "Indirect speaking assessment: analyzing relationships"}]}
      ],
      "teacher_tip": "Encourage students to refer directly to specific words and phrases they heard in the audio when answering. This develops their ability to provide evidence and detailed responses."
    }`;

// Exercise type to function mapping for easy selection - UPDATED WITH AUDIO EXERCISES
export const exerciseFunctions = {
  reading: getReadingExercise,
  "true-false": getTrueFalseExercise,
  matching: getMatchingExercise,
  "fill-in-blanks": getFillInBlanksExercise,
  "multiple-choice": getMultipleChoiceExercise,
  dialogue: getDialogueExercise,
  discussion: getDiscussionExercise,
  "error-correction": getErrorCorrectionExercise,
  "odd-one-out": getOddOneOutExercise,
  synonyms: getSynonymsExercise,
  antonyms: getAntonymsExercise,
  "synonyms-antonyms": getSynonymsAntonymsExercise,
  "sentence-transformation": getSentenceTransformationExercise,
  "word-order": getWordOrderExercise,
  "gap-text": getGapTextExercise,
  "negative-prefixes": getNegativePrefixesExercise,
  categorize: getCategorizeExercise,
  paraphrasing: getParaphrasingExercise,
  "complete-word": getCompleteWordExercise,
  "matching-halves": getMatchingHalvesExercise,
  "describe-picture": getDescribePictureExercise,
  "answer-questions": getAnswerQuestionsExercise,
  "multiple-choice-picture": getMultipleChoicePictureExercise,
  "true-false-picture": getTrueFalsePictureExercise,
  "answer-questions-picture": getAnswerQuestionsPictureExercise,
  // NEW: Audio exercises
  "listening-comprehension": getListeningComprehensionExercise,
  "multiple-choice-audio": getMultipleChoiceAudioExercise,
  "true-false-audio": getTrueFalseAudioExercise,
  "fill-in-blanks-audio": getFillInBlanksAudioExercise,
  "answer-questions-audio": getAnswerQuestionsAudioExercise,
};

export const exerciseOrder = [
  "reading",
  "true-false",
  "matching",
  "fill-in-blanks",
  "multiple-choice",
  "dialogue",
  "discussion",
  "error-correction",
  "odd-one-out",
  "synonyms",
  "antonyms",
  "synonyms-antonyms",
  "sentence-transformation",
  "word-order",
  "gap-text",
  "negative-prefixes",
  "categorize",
  "paraphrasing",
  "complete-word",
  "matching-halves",
  "describe-picture",
  "answer-questions",
  "multiple-choice-picture",
  "true-false-picture",
  "answer-questions-picture",
  // Audio exercises
  "listening-comprehension",
  "multiple-choice-audio",
  "true-false-audio",
  "fill-in-blanks-audio",
  "answer-questions-audio",
];
