import React, { useState } from "react";
import ReactDOM from "react-dom";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Check, X } from "lucide-react";

export interface NanoSkill {
  name: string;
  confidence: number;
  reason: string;
}

interface NanoSkillBadgeProps {
  nanoSkill: NanoSkill | null | undefined;
  /** Additional nano_skills (e.g. secondary writing skill) */
  allNanoSkills?: NanoSkill[];
  isEditing?: boolean;
  onEdit?: (newSkill: NanoSkill, skillIndex?: number) => void;
  className?: string;
}

// Format: ns.A2.grammar.third_person_s -> "A2 · third person s"
const formatDisplayName = (name: string): string => {
  const cefrMatch = name.match(/^ns\.([ABC][12])\./);
  const cefrLevel = cefrMatch ? cefrMatch[1] : null;
  const skillPart = cefrLevel
    ? name.replace(/^ns\.[ABC][12]\./, "").replace(/_/g, " ")
    : name.replace(/^ns\.[a-z_]+\./, "").replace(/_/g, " ");
  return cefrLevel ? `${cefrLevel} · ${skillPart}` : skillPart;
};

// Color based on confidence
const getBadgeColor = (confidence: number): string => {
  if (confidence >= 0.8) return "bg-green-50 text-green-700 border-green-200";
  if (confidence >= 0.5) return "bg-yellow-50 text-yellow-700 border-yellow-200";
  return "bg-muted text-muted-foreground border-border";
};

// Grammar topics that don't contain the word "grammar" in their nano_skill name
const GRAMMAR_TOPICS = /\b(past_simple|past_continuous|past_perfect|present_simple|present_continuous|present_perfect|present_perfect_continuous|future_simple|future_going_to|future_continuous|first_conditional|second_conditional|third_conditional|mixed_conditionals|passive_voice|reported_speech|relative_clauses|modal_verbs|gerund_infinitive|phrasal_verbs|comparatives|superlatives|articles|prepositions|word_order|negative_prefixes|word_formation|sentence_transformation|error_correction)\b/;

const VOCABULARY_TOPICS = /\b(vocabulary|collocations|idioms|synonyms|antonyms)\b/;

// Determine badge label based on skill category
const getBadgeLabel = (name: string): string => {
  if (/\bwriting\b/.test(name) || /\bwr\b/.test(name)) return "wr";
  if (/\bspeaking\b/.test(name) || /\bsp\b/.test(name)) return "sp";
  if (/\blistening\b/.test(name)) return "li";
  if (/\breading\b/.test(name)) return "rd";
  if (/\bvisual_comprehension\b/.test(name)) return "vc";
  if (/\bgrammar\b/.test(name) || GRAMMAR_TOPICS.test(name)) return "gr";
  if (VOCABULARY_TOPICS.test(name)) return "vo";
  if (/\bparaphrasing\b/.test(name)) return "wr";
  if (/\bdialogue\b/.test(name)) return "sp";
  if (/\bfunctional\b/.test(name)) return "sp";
  if (/\bcomprehension\b/.test(name)) return "rd";
  return "ns";
};

const SingleBadge: React.FC<{
  nanoSkill: NanoSkill;
  label?: string;
  skillIndex: number;
  onEdit?: (newSkill: NanoSkill, skillIndex: number) => void;
}> = ({ nanoSkill, label, skillIndex, onEdit }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isEditPopoverOpen, setIsEditPopoverOpen] = useState(false);
  const [editedSkill, setEditedSkill] = useState<NanoSkill | null>(null);

  const displayName = formatDisplayName(nanoSkill.name);
  const confidencePercent = Math.round(nanoSkill.confidence * 100);
  const badgeLabel = label || getBadgeLabel(nanoSkill.name);

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    setIsHovered(true);
  };

  const handleEditStart = () => {
    setEditedSkill({ ...nanoSkill });
    setIsEditPopoverOpen(true);
  };

  const handleEditSave = () => {
    if (editedSkill && onEdit) onEdit(editedSkill, skillIndex);
    setIsEditPopoverOpen(false);
  };

  const handleEditCancel = () => {
    setEditedSkill(null);
    setIsEditPopoverOpen(false);
  };

  return (
    <span className="inline-flex items-center gap-0.5">
      <Badge
        variant="outline"
        className={`text-xs cursor-help ${getBadgeColor(nanoSkill.confidence)}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsHovered(false)}
      >
        {badgeLabel} ({confidencePercent}%)
      </Badge>

      {isHovered && ReactDOM.createPortal(
        <div 
          style={{ 
            position: 'fixed', left: tooltipPosition.x, top: tooltipPosition.y,
            transform: 'translate(-50%, -100%)', zIndex: 99999, pointerEvents: 'none'
          }}
          className="w-72 p-3 bg-popover border border-border rounded-lg shadow-lg animate-in fade-in-0 zoom-in-95"
        >
          <div className="space-y-2">
            <p className="font-semibold text-sm text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground">{nanoSkill.reason}</p>
            <div className="flex items-center gap-2 pt-1 border-t border-border">
              <span className="text-xs text-muted-foreground">Full ID:</span>
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all">{nanoSkill.name}</code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confidence:</span>
              <span className="text-xs font-medium">{confidencePercent}%</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Per-skill edit button */}
      {onEdit && (
        <Popover open={isEditPopoverOpen} onOpenChange={setIsEditPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handleEditStart}>
              <Pencil className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Edit Nano Skill</h4>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Skill Name</label>
                <Input
                  value={editedSkill?.name || ""}
                  onChange={(e) => setEditedSkill((prev) => prev ? { ...prev, name: e.target.value } : null)}
                  placeholder="ns.A2.grammar.example"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Confidence (0.0 - 1.0)</label>
                <Input
                  type="number" min="0" max="1" step="0.1"
                  value={editedSkill?.confidence || 0}
                  onChange={(e) => setEditedSkill((prev) => prev ? { ...prev, confidence: parseFloat(e.target.value) || 0 } : null)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Reason</label>
                <Input
                  value={editedSkill?.reason || ""}
                  onChange={(e) => setEditedSkill((prev) => prev ? { ...prev, reason: e.target.value } : null)}
                  placeholder="Why this skill..."
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={handleEditCancel}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleEditSave}>
                  <Check className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </span>
  );
};

const NanoSkillBadge: React.FC<NanoSkillBadgeProps> = ({
  nanoSkill,
  allNanoSkills,
  isEditing = false,
  onEdit,
  className = "",
}) => {
  if (!nanoSkill) return null;

  // Build list of skills to display
  const skillsToShow: NanoSkill[] = allNanoSkills && allNanoSkills.length > 0
    ? allNanoSkills
    : [nanoSkill];

  return (
    <div className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {skillsToShow.map((skill, idx) => (
        <SingleBadge
          key={`${skill.name}-${idx}`}
          nanoSkill={skill}
          skillIndex={idx}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
};

export default NanoSkillBadge;
