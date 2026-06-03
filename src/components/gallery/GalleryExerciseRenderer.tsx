import React from "react";

// Strip -picture / -audio suffix so we render by base type.
// Also collapse common aliases so renderer cases stay short.
const normalize = (t: string): string => {
  const base = String(t || "").replace(/-picture$/, "").replace(/-audio$/, "");
  const aliases: Record<string, string> = {
    "synonyms-antonyms": "synonyms",
    "antonyms-synonyms": "synonyms",
    "synonyms_antonyms": "synonyms",
    "matching-halves": "matching",
    "match-halves": "matching",
    "word_order": "word-order",
    "complete_word": "complete-word",
    "negative_prefixes": "negative-prefixes",
    "word_formation": "word-formation",
    "fill-in-blanks": "fill-in-the-blanks",
  };
  return aliases[base] || base;
};

// v6.9.33 — Defensive: extract plain text from string|number|object so
// objects like { text: "..." } never render as "[object Object]" or raw JSON.
// Also filters out nano-skill metadata objects which sometimes leak into
// exercise items (`{name, mastery, reason}` shape).
const toText = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    // Skip nano-skill rating shapes — they don't belong in exercise content.
    if ("mastery" in o || "reason" in o) {
      return typeof o.name === "string" ? o.name as string : "";
    }
    const candidate =
      o.text ?? o.word ?? o.label ?? o.value ?? o.term ?? o.prompt ??
      o.input ?? o.base ?? o.gapped ?? o.masked ?? o.first ?? o.a ??
      o.left ?? o.right ?? o.line ?? o.name ?? o.answer ?? o.option ??
      o.sentence ?? o.statement ?? o.question;
    if (candidate != null && typeof candidate !== "object") return String(candidate);
    // Last-resort: silently swallow rather than dumping raw JSON.
    return "";
  }
  return String(v);
};

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
    {children}
  </span>
);

const QuestionText = (q: any): string => {
  if (typeof q === "string") return q;
  if (q && typeof q === "object") return toText(q);
  return String(q ?? "");
};

interface Props { exercise: any; index: number }

const GalleryExerciseRenderer: React.FC<Props> = ({ exercise, index }) => {
  const ex = exercise || {};
  const type = normalize(ex.type || "");
  const title = ex.title || ex.type || "Exercise";
  const instructions: string | undefined = ex.instructions;
  const imageUrl: string | undefined = ex.imageUrl || ex.image_url || ex.image;
  const audioUrl: string | undefined = ex.audioUrl || ex.audio_url || ex.audio;
  const transcript: string | undefined = ex.transcript || ex.audio_transcript;
  const wordBank: any[] = ex.word_bank || ex.wordBank || [];

  const renderBody = () => {
    switch (type) {
      case "reading":
      case "gap-text": {
        const content = ex.content || ex.text || ex.passage;
        const cq = ex.comprehension_questions || ex.questions || [];
        return (
          <>
            {content && <p className="whitespace-pre-wrap text-sm leading-relaxed">{String(content)}</p>}
            {Array.isArray(cq) && cq.length > 0 && (
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                {cq.map((q: any, i: number) => <li key={i}>{QuestionText(q)}</li>)}
              </ol>
            )}
          </>
        );
      }
      case "fill-in-blanks":
      case "fill-in-the-blanks": {
        const sentences = ex.sentences || ex.items || ex.questions || [];
        return (
          <>
            {wordBank.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {wordBank.map((w: any, i: number) => <Label key={i}>{toText(w)}</Label>)}
              </div>
            )}
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {sentences.map((s: any, i: number) => (
                <li key={i}>{toText(s)}</li>
              ))}
            </ol>
          </>
        );
      }
      case "multiple-choice": {
        const qs = ex.questions || ex.items || [];
        return (
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            {qs.map((q: any, i: number) => (
              <li key={i}>
                <div>{toText(q.question || q.text || q.prompt || q)}</div>
                {Array.isArray(q.options) && (
                  <ul className="mt-1 list-[upper-alpha] space-y-0.5 pl-6 text-muted-foreground">
                    {q.options.map((o: any, oi: number) => <li key={oi}>{toText(o)}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        );
      }
      case "true-false": {
        const stmts = ex.statements || ex.items || ex.questions || [];
        return (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {stmts.map((s: any, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span className="flex-1">{toText(s)}</span>
                <Label>True / False</Label>
              </li>
            ))}
          </ol>
        );
      }
      case "matching":
      case "matching-halves": {
        // v6.9.34 — accept `pairs`, `items`, OR parallel `left/right`,
        // `first/second`, `halves` arrays (used by "Matching Halves").
        let pairs: any[] = ex.pairs || ex.items || ex.matches || [];
        if (pairs.length === 0) {
          const left = ex.left || ex.first || ex.halves_left || ex.starts || [];
          const right = ex.right || ex.second || ex.halves_right || ex.endings || [];
          if (Array.isArray(left) && Array.isArray(right) && left.length) {
            pairs = left.map((l: any, i: number) => ({ left: l, right: right[i] }));
          }
        }
        return (
          <table className="w-full text-sm">
            <tbody>
              {pairs.map((p: any, i: number) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-1.5 pr-3 font-medium">{toText(p?.left ?? p?.first ?? p?.term ?? p?.a ?? p?.word ?? p)}</td>
                  <td className="py-1.5 text-muted-foreground">{toText(p?.right ?? p?.second ?? p?.definition ?? p?.b ?? p?.match ?? p?.pair ?? p?.synonym ?? p?.antonym ?? p?.ending ?? p?.completion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      case "dialogue": {
        const lines = ex.dialogue || ex.lines || ex.speakers || ex.items || [];
        return (
          <div className="space-y-1 text-sm">
            {lines.map((l: any, i: number) => (
              <p key={i}>
                <strong className="text-foreground">{toText(l?.speaker || l?.name || `Speaker ${i + 1}`)}:</strong>{" "}
                <span>{toText(l?.line ?? l?.text ?? l)}</span>
              </p>
            ))}
          </div>
        );
      }
      case "answer-questions":
      case "discussion": {
        const qs = ex.questions || ex.prompts || ex.items || [];
        return (
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {qs.map((q: any, i: number) => <li key={i}>{QuestionText(q)}</li>)}
          </ol>
        );
      }
      case "error-correction": {
        const items = ex.sentences || ex.items || ex.questions || [];
        return (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr><th className="pb-1 text-left">Incorrect</th><th className="pb-1 text-left">Correction</th></tr>
            </thead>
            <tbody>
              {items.map((it: any, i: number) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-1.5 pr-3">{toText(it?.incorrect ?? it?.original ?? it?.text ?? it?.sentence ?? it)}</td>
                  <td className="py-1.5 text-muted-foreground">{toText(it?.correction ?? it?.correct ?? it?.answer ?? "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      case "odd-one-out": {
        const groups = ex.groups || ex.items || ex.questions || [];
        return (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {groups.map((g: any, i: number) => (
              <li key={i}>
                <div className="flex flex-wrap gap-1.5">
                  {(g.words || g.options || g.items || []).map((w: any, wi: number) => <Label key={wi}>{toText(w)}</Label>)}
                </div>
              </li>
            ))}
          </ol>
        );
      }
      case "word-order": {
        const items = ex.sentences || ex.items || ex.questions || ex.scrambled_sentences || [];
        return (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {items.map((it: any, i: number) => (
              <li key={i} className="flex flex-wrap gap-1.5">
                {(() => {
                  // v6.9.34 — accept tokens|scrambled|shuffled|words as
                  // arrays OR delimited strings (' | ', ' / ', ' , ', spaces).
                  const splitStr = (s: string) =>
                    s.split(/\s*[|/,]\s*/).filter(Boolean).length > 1
                      ? s.split(/\s*[|/,]\s*/).filter(Boolean)
                      : s.split(/\s+/).filter(Boolean);
                  let words: any[] = [];
                  const raw =
                    it?.words ?? it?.shuffled ?? it?.tokens ?? it?.scrambled ??
                    it?.sentence ?? it?.prompt ?? (typeof it === 'string' ? it : null);
                  if (Array.isArray(raw)) words = raw;
                  else if (typeof raw === 'string') words = splitStr(raw);
                  return (words as any[]).map((w: any, wi: number) => (
                    <Label key={wi}>{toText(w)}</Label>
                  ));
                })()}
                {it?.answer && (
                  <span className="ml-2 text-xs text-muted-foreground italic">→ {toText(it.answer)}</span>
                )}
              </li>
            ))}
          </ol>
        );
      }
      case "synonyms":
      case "antonyms":
      case "paraphrasing":
      case "negative-prefixes":
      case "complete-word":
      case "word-formation": {
        const items = ex.items || ex.questions || ex.sentences || ex.words || ex.pairs || [];
        return (
          <table className="w-full text-sm">
            <tbody>
              {items.map((it: any, i: number) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-1.5 pr-3 font-medium">
                    {toText(it?.term ?? it?.prompt ?? it?.word ?? it?.base ?? it?.input ?? it?.gapped ?? it?.masked ?? it?.text ?? it?.question ?? it?.root ?? it?.original ?? it?.stem ?? it)}
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {toText(it?.definition ?? it?.answer ?? it?.target ?? it?.solution ?? it?.synonym ?? it?.antonym ?? it?.completed ?? it?.negative ?? it?.opposite ?? it?.transformed ?? it?.full ?? "")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }
      case "categorize":
      case "categorise":
      case "categorisation":
      case "categorization": {
        const categories = ex.categories || [];
        const items = ex.items || [];
        return (
          <>
            {items.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {items.map((w: any, i: number) => <Label key={i}>{toText(w)}</Label>)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {(Array.isArray(categories) ? categories : Object.keys(categories || {})).map((c: any, i: number) => (
                <div key={i} className="rounded border border-border/60 p-2 text-sm">
                  <div className="font-semibold">{toText(typeof c === "string" ? c : (c?.name ?? c?.label ?? `Category ${i + 1}`))}</div>
                </div>
              ))}
            </div>
          </>
        );
      }
      case "describe":
      case "describe-picture":
      case "answer-questions-picture": {
        const prompts = ex.prompts || ex.questions || [];
        return (
          <>
            {imageUrl && <img src={imageUrl} alt={title} loading="lazy" className="mb-3 max-h-64 rounded border" />}
            {Array.isArray(prompts) && prompts.length > 0 && (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {prompts.map((p: any, i: number) => <li key={i}>{QuestionText(p)}</li>)}
              </ol>
            )}
          </>
        );
      }
      case "listening-comprehension":
      case "listening": {
        const qs = ex.questions || ex.comprehension_questions || [];
        return (
          <>
            {audioUrl && <audio controls src={audioUrl} className="mb-3 w-full" />}
            {transcript && (
              <details className="mb-3 rounded border border-border/60 bg-muted/40 p-2 text-xs">
                <summary className="cursor-pointer font-medium">Transcript</summary>
                <p className="mt-2 whitespace-pre-wrap">{transcript}</p>
              </details>
            )}
            {Array.isArray(qs) && qs.length > 0 && (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {qs.map((q: any, i: number) => <li key={i}>{QuestionText(q)}</li>)}
              </ol>
            )}
          </>
        );
      }
      default: {
        // Fallback: render any present generic fields, else dump JSON.
        const content = typeof ex.content === "string" ? ex.content : null;
        const qs = ex.questions || ex.items || [];
        if (content || (Array.isArray(qs) && qs.length > 0)) {
          return (
            <>
              {content && <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>}
              {Array.isArray(qs) && qs.length > 0 && (
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                  {qs.map((q: any, i: number) => <li key={i}>{QuestionText(q)}</li>)}
                </ol>
              )}
            </>
          );
        }
        return (
          <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-xs text-muted-foreground">
            {JSON.stringify(ex, null, 2)}
          </pre>
        );
      }
    }
  };

  return (
    <article className="rounded-lg border border-l-4 border-l-primary/40 bg-card p-5">
      <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {index + 1}. {title}
        </h2>
        {ex.type && <Label>{ex.type}</Label>}
      </header>
      {instructions && <p className="mb-3 text-sm italic text-muted-foreground">{instructions}</p>}
      {renderBody()}
    </article>
  );
};

export default GalleryExerciseRenderer;
