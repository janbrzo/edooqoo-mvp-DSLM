import React from "react";

// Strip -picture / -audio suffix so we render by base type.
const normalize = (t: string): string =>
  String(t || "").replace(/-picture$/, "").replace(/-audio$/, "");

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="inline-block rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
    {children}
  </span>
);

const QuestionText = (q: any): string => {
  if (typeof q === "string") return q;
  if (q && typeof q === "object") return q.text || q.question || q.prompt || JSON.stringify(q);
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
                {wordBank.map((w: any, i: number) => <Label key={i}>{String(w)}</Label>)}
              </div>
            )}
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {sentences.map((s: any, i: number) => (
                <li key={i}>{typeof s === "string" ? s : (s.text || s.sentence || s.question || JSON.stringify(s))}</li>
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
                <div>{q.question || q.text || q.prompt}</div>
                {Array.isArray(q.options) && (
                  <ul className="mt-1 list-[upper-alpha] space-y-0.5 pl-6 text-muted-foreground">
                    {q.options.map((o: any, oi: number) => <li key={oi}>{typeof o === "string" ? o : (o.text || o.label || JSON.stringify(o))}</li>)}
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
                <span className="flex-1">{typeof s === "string" ? s : (s.text || s.statement || s.question)}</span>
                <Label>True / False</Label>
              </li>
            ))}
          </ol>
        );
      }
      case "matching":
      case "matching-halves": {
        const pairs = ex.pairs || ex.items || [];
        return (
          <table className="w-full text-sm">
            <tbody>
              {pairs.map((p: any, i: number) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-1.5 pr-3 font-medium">{p.left || p.first || p.term || p.a}</td>
                  <td className="py-1.5 text-muted-foreground">{p.right || p.second || p.definition || p.b}</td>
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
                <strong className="text-foreground">{l.speaker || l.name || `Speaker ${i + 1}`}:</strong>{" "}
                <span>{l.line || l.text || (typeof l === "string" ? l : "")}</span>
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
                  <td className="py-1.5 pr-3">{it.incorrect || it.original || it.text || it.sentence}</td>
                  <td className="py-1.5 text-muted-foreground">{it.correction || it.correct || it.answer || ""}</td>
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
                  {(g.words || g.options || g.items || []).map((w: any, wi: number) => <Label key={wi}>{String(w)}</Label>)}
                </div>
              </li>
            ))}
          </ol>
        );
      }
      case "word-order": {
        const items = ex.sentences || ex.items || ex.questions || [];
        return (
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {items.map((it: any, i: number) => (
              <li key={i} className="flex flex-wrap gap-1.5">
                {(it.words || it.shuffled || (typeof it === "string" ? it.split(/\s+/) : [])).map((w: string, wi: number) => (
                  <Label key={wi}>{w}</Label>
                ))}
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
        const items = ex.items || ex.questions || ex.sentences || [];
        return (
          <table className="w-full text-sm">
            <tbody>
              {items.map((it: any, i: number) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="py-1.5 pr-3 font-medium">{it.prompt || it.word || it.input || it.text || it.question}</td>
                  <td className="py-1.5 text-muted-foreground">{it.answer || it.target || it.solution || ""}</td>
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
                {items.map((w: any, i: number) => <Label key={i}>{String(w)}</Label>)}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {(Array.isArray(categories) ? categories : Object.keys(categories || {})).map((c: any, i: number) => (
                <div key={i} className="rounded border border-border/60 p-2 text-sm">
                  <div className="font-semibold">{typeof c === "string" ? c : (c.name || c.label || `Category ${i + 1}`)}</div>
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
