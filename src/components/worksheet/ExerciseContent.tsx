
import React from "react";

interface ExerciseContentProps {
  instructions: string;
  isEditing: boolean;
  onInstructionsChange: (value: string) => void;
  content?: string;
  onContentChange?: (value: string) => void;
}

const ExerciseContent: React.FC<ExerciseContentProps> = ({
  instructions, isEditing, onInstructionsChange, content, onContentChange
}) => {
  // Count words in reading content if available
  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;
  const showWordCount = content && content.length > 0;

  return (
    <>
      <p className="font-medium mb-3 leading-snug">
        {isEditing ? (
          <input
            type="text"
            value={instructions}
            onChange={e => onInstructionsChange(e.target.value)}
            className="w-full border p-2 editable-content"
          />
        ) : instructions}
      </p>
      {content !== undefined && (
        <div className="mb-4 p-4 bg-gray-50 rounded-md">
          {showWordCount && (
            <div className="text-xs text-gray-500 mb-2">
              Word count: {wordCount}
            </div>
          )}
          {isEditing && onContentChange ? (
            <textarea
              value={content}
              onChange={e => onContentChange(e.target.value)}
              className="w-full h-32 border p-2 editable-content"
            />
          ) : (
            <p className="whitespace-pre-line leading-snug">{content}</p>
          )}
        </div>
      )}
    </>
  );
};

export default ExerciseContent;
