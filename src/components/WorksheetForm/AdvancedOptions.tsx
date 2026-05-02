
import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import LanguageStyleSlider from "./LanguageStyleSlider";
import { useIsMobile } from "@/hooks/use-mobile";

interface AdvancedOptionsProps {
  languageStyle: number;
  onLanguageStyleChange: (value: number) => void;
}

const AdvancedOptions: React.FC<AdvancedOptionsProps> = ({
  languageStyle,
  onLanguageStyleChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  // Load saved state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('advancedOptionsOpen');
    if (savedState) {
      setIsOpen(JSON.parse(savedState));
    }
  }, []);

  // Save state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('advancedOptionsOpen', JSON.stringify(isOpen));
  }, [isOpen]);

  return (
    <div className="w-full">
      <LanguageStyleSlider 
        value={languageStyle} 
        onChange={onLanguageStyleChange} 
      />
    </div>
  );
};

export default AdvancedOptions;
