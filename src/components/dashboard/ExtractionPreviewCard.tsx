// v6.9.62 P6 — Preview UI for an AI student-profile extraction.
// Accordion: Notes / Signals / Goals / Level / Main Goal / Native lang / Pacing.
// Each item has an "Include" switch + confidence + evidence quote.
import React, { useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Sparkles, MessageSquareQuote } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import type { IntakeExtractionPayload, IntakeIncludes } from '@/lib/intake/applyIntakeExtraction';

interface Props {
  extraction: IntakeExtractionPayload;
  includes: IntakeIncludes;
  setIncludes: React.Dispatch<React.SetStateAction<IntakeIncludes>>;
  existing: {
    english_level?: string | null;
    main_goal?: string | null;
    native_language?: string | null;
  };
}

const AUTO_THRESHOLD = 0.75;
const NATIVE_AUTO_THRESHOLD = 0.8;

function ConfidenceBadge({ conf, auto }: { conf?: number; auto: boolean }) {
  const pct = typeof conf === 'number' ? Math.round(conf * 100) : 0;
  return (
    <Badge
      variant="outline"
      className={
        auto
          ? 'bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px]'
          : 'bg-amber-50 text-amber-700 border-amber-300 text-[10px]'
      }
    >
      {auto ? 'Auto-apply' : 'Suggestion'} · {pct}%
    </Badge>
  );
}

function Evidence({ quote }: { quote?: string }) {
  if (!quote) return null;
  return (
    <div className="mt-1 flex gap-1 text-[11px] text-muted-foreground/90 italic">
      <MessageSquareQuote className="h-3 w-3 mt-0.5 shrink-0" />
      <span className="line-clamp-2">{quote}</span>
    </div>
  );
}

export const ExtractionPreviewCard: React.FC<Props> = ({
  extraction,
  includes,
  setIncludes,
  existing,
}) => {
  const signals = extraction.signals ?? [];
  const goals = extraction.goals ?? [];

  const summary = useMemo(() => {
    let auto = 0;
    let sugg = 0;
    let skipped = 0;
    // Notes
    if (extraction.summary_notes) (includes.notes !== false ? auto++ : skipped++);
    // Signals (always "auto" once accepted because category-based row insert)
    signals.forEach((_, i) => {
      const inc = includes.signals?.[String(i)];
      if (inc === false) skipped++; else auto++;
    });
    // Goals
    goals.forEach((g, i) => {
      const inc = includes.goals?.[String(i)];
      const ok = (g.confidence ?? 0) >= AUTO_THRESHOLD;
      if (inc === false) skipped++;
      else if (ok) auto++;
      else sugg++;
    });
    // Level
    if (extraction.english_level?.value) {
      const inc = includes.english_level !== false;
      const wouldAuto = !existing.english_level && (extraction.english_level.confidence ?? 0) >= AUTO_THRESHOLD;
      if (!inc) skipped++;
      else if (wouldAuto) auto++;
      else sugg++;
    }
    if (extraction.main_goal?.value) {
      const inc = includes.main_goal !== false;
      const wouldAuto = !existing.main_goal && (extraction.main_goal.confidence ?? 0) >= AUTO_THRESHOLD;
      if (!inc) skipped++;
      else if (wouldAuto) auto++;
      else sugg++;
    }
    if (extraction.native_language?.value) {
      const inc = includes.native_language !== false;
      const wouldAuto = (!existing.native_language || existing.native_language === 'Spanish')
        && (extraction.native_language.confidence ?? 0) >= NATIVE_AUTO_THRESHOLD;
      if (!inc) skipped++;
      else if (wouldAuto) auto++;
      else sugg++;
    }
    if (extraction.pacing) {
      const inc = includes.pacing !== false;
      if (!inc) skipped++; else sugg++; // pacing is ALWAYS a suggestion
    }
    return { auto, sugg, skipped };
  }, [extraction, includes, signals, goals, existing]);

  const setNotes = (v: boolean) => setIncludes((p) => ({ ...p, notes: v }));
  const setSignal = (i: number, v: boolean) =>
    setIncludes((p) => ({ ...p, signals: { ...(p.signals ?? {}), [String(i)]: v } }));
  const setGoal = (i: number, v: boolean) =>
    setIncludes((p) => ({ ...p, goals: { ...(p.goals ?? {}), [String(i)]: v } }));

  const hasAny =
    !!extraction.summary_notes
    || signals.length > 0
    || goals.length > 0
    || !!extraction.english_level?.value
    || !!extraction.main_goal?.value
    || !!extraction.native_language?.value
    || !!extraction.pacing;

  if (!hasAny) {
    return (
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        We couldn't extract anything actionable. Try adding more context.
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          AI extracted profile
        </div>
        <span className="text-[11px] text-muted-foreground">
          {summary.auto} auto · {summary.sugg} suggestions · {summary.skipped} skipped
        </span>
      </div>

      <Accordion type="multiple" defaultValue={["notes", "signals", "goals"]} className="text-xs">
        {/* Notes */}
        {extraction.summary_notes ? (
          <AccordionItem value="notes">
            <AccordionTrigger className="text-xs py-2">Notes summary</AccordionTrigger>
            <AccordionContent>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-foreground/90 leading-snug flex-1">
                  {extraction.summary_notes}
                </p>
                <Switch
                  checked={includes.notes !== false}
                  onCheckedChange={setNotes}
                  aria-label="Include notes"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        ) : null}

        {/* Signals */}
        {signals.length > 0 ? (
          <AccordionItem value="signals">
            <AccordionTrigger className="text-xs py-2">Signals ({signals.length})</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {signals.map((s, i) => {
                  const inc = includes.signals?.[String(i)] !== false;
                  return (
                    <div key={i} className="rounded border bg-muted/20 p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{s.category}</Badge>
                            {s.subtype ? <Badge variant="outline" className="text-[10px]">{s.subtype}</Badge> : null}
                            <ConfidenceBadge conf={s.confidence} auto />
                          </div>
                          <p className="text-xs mt-1 text-foreground/90">{s.text}</p>
                          <Evidence quote={s.evidence_quote} />
                        </div>
                        <Switch checked={inc} onCheckedChange={(v) => setSignal(i, v)} aria-label="Include signal" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ) : null}

        {/* Goals */}
        {goals.length > 0 ? (
          <AccordionItem value="goals">
            <AccordionTrigger className="text-xs py-2">Goals ({goals.length})</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2">
                {goals.map((g, i) => {
                  const inc = includes.goals?.[String(i)] !== false;
                  const auto = (g.confidence ?? 0) >= AUTO_THRESHOLD;
                  return (
                    <div key={i} className="rounded border bg-muted/20 p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{g.goal_type ?? 'additional'}</Badge>
                            {g.target_date ? <Badge variant="outline" className="text-[10px]">{g.target_date}</Badge> : null}
                            <ConfidenceBadge conf={g.confidence} auto={auto} />
                          </div>
                          <p className="text-xs mt-1 font-medium text-foreground">{g.title}</p>
                          {g.description ? (
                            <p className="text-[11px] mt-0.5 text-muted-foreground line-clamp-2">{g.description}</p>
                          ) : null}
                          <Evidence quote={g.evidence_quote} />
                        </div>
                        <Switch checked={inc} onCheckedChange={(v) => setGoal(i, v)} aria-label="Include goal" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
        ) : null}

        {/* Level */}
        {extraction.english_level?.value ? (
          <AccordionItem value="level">
            <AccordionTrigger className="text-xs py-2">English level</AccordionTrigger>
            <AccordionContent>
              <div className="rounded border bg-muted/20 p-2 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{extraction.english_level.value}</Badge>
                    <ConfidenceBadge
                      conf={extraction.english_level.confidence}
                      auto={!existing.english_level && (extraction.english_level.confidence ?? 0) >= AUTO_THRESHOLD}
                    />
                  </div>
                  {existing.english_level ? (
                    <p className="text-[11px] mt-1 text-amber-700">
                      You already set level <strong>{existing.english_level}</strong>. AI value will be saved as a suggestion.
                    </p>
                  ) : null}
                  <Evidence quote={extraction.english_level.evidence_quote} />
                </div>
                <Switch
                  checked={includes.english_level !== false}
                  onCheckedChange={(v) => setIncludes((p) => ({ ...p, english_level: v }))}
                  aria-label="Include level"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        ) : null}

        {/* Main goal */}
        {extraction.main_goal?.value ? (
          <AccordionItem value="main-goal">
            <AccordionTrigger className="text-xs py-2">Main goal</AccordionTrigger>
            <AccordionContent>
              <div className="rounded border bg-muted/20 p-2 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <ConfidenceBadge
                      conf={extraction.main_goal.confidence}
                      auto={!existing.main_goal && (extraction.main_goal.confidence ?? 0) >= AUTO_THRESHOLD}
                    />
                    {extraction.main_goal.target_date ? (
                      <Badge variant="outline" className="text-[10px]">{extraction.main_goal.target_date}</Badge>
                    ) : null}
                  </div>
                  <p className="text-xs mt-1 font-medium text-foreground">{extraction.main_goal.value}</p>
                  {existing.main_goal ? (
                    <p className="text-[11px] mt-1 text-amber-700">
                      You already set a main goal. AI value will be saved as a suggestion.
                    </p>
                  ) : null}
                  <Evidence quote={extraction.main_goal.evidence_quote} />
                </div>
                <Switch
                  checked={includes.main_goal !== false}
                  onCheckedChange={(v) => setIncludes((p) => ({ ...p, main_goal: v }))}
                  aria-label="Include main goal"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        ) : null}

        {/* Native language */}
        {extraction.native_language?.value ? (
          <AccordionItem value="native">
            <AccordionTrigger className="text-xs py-2">Native language</AccordionTrigger>
            <AccordionContent>
              <div className="rounded border bg-muted/20 p-2 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{extraction.native_language.value}</Badge>
                    <ConfidenceBadge
                      conf={extraction.native_language.confidence}
                      auto={(!existing.native_language || existing.native_language === 'Spanish')
                        && (extraction.native_language.confidence ?? 0) >= NATIVE_AUTO_THRESHOLD}
                    />
                  </div>
                  <Evidence quote={extraction.native_language.evidence_quote} />
                </div>
                <Switch
                  checked={includes.native_language !== false}
                  onCheckedChange={(v) => setIncludes((p) => ({ ...p, native_language: v }))}
                  aria-label="Include native language"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        ) : null}

        {/* Pacing */}
        {extraction.pacing ? (
          <AccordionItem value="pacing">
            <AccordionTrigger className="text-xs py-2">Pacing suggestion</AccordionTrigger>
            <AccordionContent>
              <div className="rounded border bg-muted/20 p-2 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <ConfidenceBadge conf={extraction.pacing.confidence} auto={false} />
                    {extraction.pacing.sessions_per_week ? (
                      <Badge variant="outline" className="text-[10px]">
                        {extraction.pacing.sessions_per_week}/week
                      </Badge>
                    ) : null}
                    {extraction.pacing.preferred_time ? (
                      <Badge variant="outline" className="text-[10px]">{extraction.pacing.preferred_time}</Badge>
                    ) : null}
                  </div>
                  {extraction.pacing.rationale ? (
                    <p className="text-[11px] mt-1 text-muted-foreground">{extraction.pacing.rationale}</p>
                  ) : null}
                  <Evidence quote={extraction.pacing.evidence_quote} />
                  <p className="text-[11px] mt-1 text-amber-700">
                    Always saved as a pending pacing proposal — accept it from the Pacing bell.
                  </p>
                </div>
                <Switch
                  checked={includes.pacing !== false}
                  onCheckedChange={(v) => setIncludes((p) => ({ ...p, pacing: v }))}
                  aria-label="Include pacing"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        ) : null}
      </Accordion>
    </div>
  );
};

export default ExtractionPreviewCard;