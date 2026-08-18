
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface FormFieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: Array<{ id: string; title: string }>;
  isOptional?: boolean;
  isRequired?: boolean;
  /** Optional input name attribute — used for DOM-fallback reads (v4.7 stale-closure recovery). */
  name?: string;
  /**
   * v6.9.94 — hard character budget for this field. The backend rejects any
   * assembled prompt over 5000 chars (generateWorksheet/security.ts), and the
   * prompt scaffolding alone consumes ~2.6k, so unbounded pasting into a single
   * field used to produce an opaque HTTP 400 for the teacher.
   */
  maxLength?: number;
  /** Show a `123 / 500` counter under the input. Requires `maxLength`. */
  showCounter?: boolean;
}

export default function FormField({ 
  label, 
  placeholder, 
  value, 
  onChange, 
  suggestions, 
  isOptional = false,
  isRequired = false,
  name,
  maxLength,
  showCounter = true,
}: FormFieldProps) {
  const isMobile = useIsMobile();
  const hasLimit = typeof maxLength === 'number' && maxLength > 0;
  const nearLimit = hasLimit && value.length >= maxLength * 0.9;
  
  return (
    <div>
      <label className={cn(
        "block font-medium mb-2 text-sm",
        isOptional ? "text-muted-foreground" : "text-foreground"
      )}>
        {label}
      </label>
      <Input
        type="text"
        name={name}
        placeholder={placeholder}
        value={value} 
        maxLength={hasLimit ? maxLength : undefined}
        onChange={e => onChange(hasLimit ? e.target.value.slice(0, maxLength) : e.target.value)}
        className={cn('mb-1', isMobile && 'text-sm')}
      />
      <div className="mb-2 min-h-[1rem]">
        {hasLimit && showCounter && (
          <p className={cn(
            'text-xs text-right',
            nearLimit ? 'text-destructive' : 'text-muted-foreground',
          )}>
            {value.length} / {maxLength}
          </p>
        )}
      </div>
      <div className={`flex flex-wrap gap-2 ${isMobile ? 'gap-1' : ''}`}>
        {suggestions.map(suggestion => (
          <Button 
            key={suggestion.id} 
            type="button" 
            variant="outline" 
            size={isMobile ? "sm" : "sm"}
            onClick={() => onChange(hasLimit ? suggestion.title.slice(0, maxLength) : suggestion.title)}
            className={`font-light ${isMobile ? 'text-xs px-2 py-1' : 'text-sm'}`}
          >
            {suggestion.title.length > (isMobile ? 30 : 50) ? `${suggestion.title.substring(0, isMobile ? 30 : 50)}...` : suggestion.title}
          </Button>
        ))}
      </div>
    </div>
  );
}
