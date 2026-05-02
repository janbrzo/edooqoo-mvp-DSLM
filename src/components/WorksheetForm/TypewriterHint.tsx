import { useState, useEffect, useRef } from 'react';

const hints = [
  "Input quality equals worksheet quality",
  "More context and clear requirements mean better worksheet",
  "Worksheet creator works only with what you write. Not with what you think",
  "Short inputs give generic worksheets",
  "More context in all 4 fields equals better worksheets",
  "Less context means more generic tasks",
  "Better input means better worksheets",
  "Fill in all 4 fields for best results",
  "Be specific to get useful worksheets",
  "More context equals less editing later",
  "Input context quality shapes the final worksheet",
  "AI cannot guess your idea. Write it!",
  "Short context gives average results",
  "Clear context creates better lessons",
  "Worksheet creator follows instructions, not thoughts."
];

export default function TypewriterHint() {
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wordIndexRef = useRef(0);

  useEffect(() => {
    const currentHint = hints[currentHintIndex];
    const words = currentHint.split(' ');
    const typingDuration = 3000; // 3 seconds total for typing
    const wordDelay = typingDuration / words.length;
    
    // Reset for new hint
    wordIndexRef.current = 0;
    setDisplayedWords([]);
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Start typing words one by one
    intervalRef.current = setInterval(() => {
      if (wordIndexRef.current < words.length) {
        wordIndexRef.current++;
        setDisplayedWords(words.slice(0, wordIndexRef.current));
      } else {
        // All words displayed - move to next hint
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        // Immediately start next hint after typing finishes
        setCurrentHintIndex((prev) => (prev + 1) % hints.length);
      }
    }, wordDelay);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentHintIndex]);

  return (
    <div className="h-6 mb-2">
      <p className="text-sm font-medium text-red-600">
        {displayedWords.join(' ')}
        <span className="animate-pulse">|</span>
      </p>
    </div>
  );
}
