
import { EnglishLevel } from './types';
import { ENGLISH_LEVEL_DESCRIPTIONS } from './constants';

interface EnglishLevelSelectorProps {
  englishLevel: EnglishLevel;
  setEnglishLevel: (level: EnglishLevel) => void;
}

export default function EnglishLevelSelector({ englishLevel, setEnglishLevel }: EnglishLevelSelectorProps) {
  return (
    <div>
      <p className="text-sm text-gray-600">CEFR Scale: {ENGLISH_LEVEL_DESCRIPTIONS[englishLevel]}</p>
    </div>
  );
}
