import React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import ExerciseHeader from "./ExerciseHeader";

interface GrammarRule {
  title: string;
  explanation: string;
  examples: string[];
}

interface GrammarRulesData {
  title: string;
  introduction: string;
  rules: GrammarRule[];
}

interface GrammarRulesProps {
  grammarRules: GrammarRulesData;
  isEditing: boolean;
  editableWorksheet: any;
  setEditableWorksheet: (worksheet: any) => void;
  inputParams?: any;
  worksheetId?: string | null;
  userId?: string;
}

export default function GrammarRules({
  grammarRules,
  isEditing,
  editableWorksheet,
  setEditableWorksheet,
  inputParams,
  worksheetId,
  userId
}: GrammarRulesProps) {
  const isMobile = useIsMobile();

  // Calculate grammar time based on lesson duration
  const getGrammarTime = () => {
    if (!inputParams?.lessonTime) return 10;
    return inputParams.lessonTime === '45min' ? 10 : 15;
  };

  const updateGrammarRules = (field: string, value: any) => {
    setEditableWorksheet({
      ...editableWorksheet,
      grammar_rules: {
        ...editableWorksheet.grammar_rules,
        [field]: value
      }
    });
  };

  const updateRule = (index: number, field: string, value: any) => {
    const updatedRules = [...editableWorksheet.grammar_rules.rules];
    updatedRules[index] = {
      ...updatedRules[index],
      [field]: value
    };
    updateGrammarRules('rules', updatedRules);
  };

  if (!grammarRules) return null;

  return (
    <div className="bg-white border rounded-lg shadow-sm mb-6 overflow-hidden">
      {/* Grammar Rules Header */}
      <ExerciseHeader
        icon="grammar"
        title="Grammar Rules"
        isEditing={false}
        time={getGrammarTime()}
        onTitleChange={() => {}}
      />

      <div className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-xl font-semibold text-worksheet-purpleDark">
            {isEditing ? (
              <input 
                type="text" 
                value={editableWorksheet.grammar_rules.title} 
                onChange={e => updateGrammarRules('title', e.target.value)} 
                className="w-full border p-2 editable-content" 
              />
            ) : grammarRules.title}
          </h3>
        </div>
        
        <div className="mb-4 p-4 bg-blue-50 border-l-4 border-blue-400 rounded-md">
          {isEditing ? (
            <textarea 
              value={editableWorksheet.grammar_rules.introduction} 
              onChange={e => updateGrammarRules('introduction', e.target.value)} 
              className="w-full h-20 border p-2 editable-content" 
              placeholder="Introduction to the grammar topic..."
            />
          ) : (
            <p className="leading-snug text-blue-800">{grammarRules.introduction}</p>
          )}
        </div>

        <div className="space-y-4">
          {grammarRules.rules.map((rule, index) => (
            <div key={index} className="border-l-2 border-worksheet-purple pl-4">
              <h4 className="font-medium text-worksheet-purpleDark mb-2">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editableWorksheet.grammar_rules.rules[index].title} 
                    onChange={e => updateRule(index, 'title', e.target.value)} 
                    className="w-full border p-1 editable-content text-sm" 
                  />
                ) : rule.title}
              </h4>
              
              <p className="text-gray-700 mb-3">
                {isEditing ? (
                  <textarea 
                    value={editableWorksheet.grammar_rules.rules[index].explanation} 
                    onChange={e => updateRule(index, 'explanation', e.target.value)} 
                    className="w-full h-16 border p-2 editable-content text-sm" 
                  />
                ) : rule.explanation}
              </p>
              
              {rule.examples && rule.examples.length > 0 && (
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm font-medium text-gray-600 mb-2">Examples:</p>
                  <ul className="space-y-1">
                    {rule.examples.map((example, exIndex) => (
                      <li key={exIndex} className="text-sm text-gray-700">
                        {isEditing ? (
                          <input 
                            type="text" 
                            value={example} 
                            onChange={e => {
                              const updatedExamples = [...editableWorksheet.grammar_rules.rules[index].examples];
                              updatedExamples[exIndex] = e.target.value;
                              updateRule(index, 'examples', updatedExamples);
                            }} 
                            className="w-full border p-1 editable-content text-xs" 
                          />
                        ) : (
                          <span>• {example}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
