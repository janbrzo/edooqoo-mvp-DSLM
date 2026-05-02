
import React from "react";
import { MessageCircle } from "lucide-react";
import DemoWatermark from "./DemoWatermark";
import ExerciseHeader from "./ExerciseHeader";

interface WarmupSectionProps {
  inputParams: any;
  isEditing: boolean;
  editableWorksheet: any;
  setEditableWorksheet: (worksheet: any) => void;
  isDownloadUnlocked: boolean;
  worksheetId?: string | null;
  userId?: string;
}

const generateWarmupQuestions = (inputParams: any): string[] => {
  const { lessonTopic, englishLevel, lessonGoal } = inputParams || {};
  
  // Base questions that work for any topic
  const baseQuestions = [
    "What do you already know about this topic?",
    "Have you ever experienced something similar to what we'll discuss today?",
    "What would you like to learn about this topic?",
    "How do you think this topic might be useful in your daily life?"
  ];

  // Topic-specific questions
  const topicQuestions: Record<string, string[]> = {
    "travel": [
      "What's your favorite travel destination and why?",
      "What's the most interesting place you've ever visited?",
      "If you could travel anywhere in the world, where would you go?",
      "What do you think makes a trip memorable?"
    ],
    "food": [
      "What's your favorite dish from your country?",
      "Have you ever tried cooking something completely new?",
      "What food would you recommend to a foreign visitor?",
      "How important is food in bringing people together?"
    ],
    "technology": [
      "How has technology changed your daily routine?",
      "What's the most useful app on your phone?",
      "Do you think technology makes life easier or more complicated?",
      "What technology would you find difficult to live without?"
    ],
    "work": [
      "What do you enjoy most about your work or studies?",
      "How do you usually start your workday?",
      "What skills do you think are most important in today's workplace?",
      "How do you balance work and personal time?"
    ],
    "family": [
      "What family traditions are important to you?",
      "How has your family influenced who you are today?",
      "What's your favorite family memory?",
      "How do families in your culture typically spend time together?"
    ],
    "hobbies": [
      "What hobby would you like to try if you had more time?",
      "How did you discover your current interests?",
      "What hobby do you think teaches the most valuable skills?",
      "How do your hobbies help you relax or stay motivated?"
    ],
    "health": [
      "What does a healthy lifestyle mean to you?",
      "How do you usually stay active or take care of your health?",
      "What healthy habit would you like to develop?",
      "How important is mental health compared to physical health?"
    ],
    "environment": [
      "What environmental changes have you noticed in your area?",
      "How do you try to help protect the environment?",
      "What environmental issue concerns you the most?",
      "How can individuals make a real difference for the environment?"
    ]
  };

  // Level-specific adjustments
  const levelAdjustments: Record<string, (question: string) => string> = {
    "A1": (q) => q.replace(/\b(experienced|complicated|influenced|valuable)\b/g, (match) => {
      const simpler: Record<string, string> = {
        "experienced": "had",
        "complicated": "hard",
        "influenced": "changed",
        "valuable": "good"
      };
      return simpler[match] || match;
    }),
    "A2": (q) => q,
    "B1": (q) => q,
    "B2": (q) => q,
    "C1": (q) => q,
    "C2": (q) => q
  };

  // Get topic-specific questions or fall back to base questions
  const topicKey = lessonTopic?.toLowerCase().replace(/\s+/g, '') || '';
  let questions = topicQuestions[topicKey] || baseQuestions;
  
  // Apply level adjustments if available
  if (englishLevel && levelAdjustments[englishLevel]) {
    questions = questions.map(levelAdjustments[englishLevel]);
  }

  return questions.slice(0, 4);
};

const WarmupSection: React.FC<WarmupSectionProps> = ({
  inputParams,
  isEditing,
  editableWorksheet,
  setEditableWorksheet,
  isDownloadUnlocked,
  worksheetId,
  userId
}) => {
  // Initialize warmup questions if not present
  if (!editableWorksheet.warmup_questions) {
    const generatedQuestions = generateWarmupQuestions(inputParams);
    setEditableWorksheet({
      ...editableWorksheet,
      warmup_questions: generatedQuestions
    });
  }

  const handleQuestionChange = (index: number, value: string) => {
    const updatedQuestions = [...(editableWorksheet.warmup_questions || [])];
    updatedQuestions[index] = value;
    setEditableWorksheet({
      ...editableWorksheet,
      warmup_questions: updatedQuestions
    });
  };

  const questions = editableWorksheet.warmup_questions || generateWarmupQuestions(inputParams);

  return (
    <div className="bg-white border rounded-lg shadow-sm mb-6 relative">
      {!isDownloadUnlocked && <DemoWatermark />}
      
      <ExerciseHeader
        icon="warmup"
        title="Warmup Questions"
        isEditing={false}
        time={5}
        onTitleChange={() => {}}
      />

      <div className="p-6">
        <p className="font-medium mb-4 leading-snug">
          Start the lesson with these conversation questions to engage the student and introduce the topic.
        </p>
        
        <div className="space-y-3">
          {questions.map((question, index) => (
            <div key={index} className="flex items-start">
              <span className="text-worksheet-purple font-semibold mr-3 mt-1">
                {index + 1}.
              </span>
              {isEditing ? (
                <input
                  type="text"
                  value={question}
                  onChange={(e) => handleQuestionChange(index, e.target.value)}
                  className="flex-1 border border-gray-300 rounded px-3 py-2 editable-content"
                />
              ) : (
                <p className="flex-1 leading-relaxed">{question}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WarmupSection;
