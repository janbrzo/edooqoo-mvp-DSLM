import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RotateCw } from "lucide-react";

/**
 * BrainResetGame — lightweight, language-free Memory Pairs minigame
 * shown on the Welcome Test "paused" screen so students can
 * mentally reset before resuming. NO English knowledge required —
 * uses emoji symbols only. Purely client-side; nothing is persisted.
 */

const EMOJI_POOL = ["🌸", "🌊", "🍀", "🌞", "🍋", "🌙", "🪐", "🍉"];

interface CardState {
  id: number;
  symbol: string;
  flipped: boolean;
  matched: boolean;
}

function buildDeck(pairs: number): CardState[] {
  const picked = [...EMOJI_POOL].sort(() => Math.random() - 0.5).slice(0, pairs);
  const deck = [...picked, ...picked]
    .map((symbol, i) => ({ id: i, symbol, flipped: false, matched: false }))
    .sort(() => Math.random() - 0.5)
    .map((c, i) => ({ ...c, id: i }));
  return deck;
}

export function BrainResetGame({ pairs = 6 }: { pairs?: number }) {
  const [deck, setDeck] = useState<CardState[]>(() => buildDeck(pairs));
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);

  const allMatched = useMemo(() => deck.length > 0 && deck.every((c) => c.matched), [deck]);

  useEffect(() => {
    if (selected.length !== 2) return;
    const [a, b] = selected;
    const cardA = deck[a];
    const cardB = deck[b];
    setMoves((m) => m + 1);
    if (cardA.symbol === cardB.symbol) {
      setDeck((d) => d.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)));
      setSelected([]);
    } else {
      const t = setTimeout(() => {
        setDeck((d) => d.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c)));
        setSelected([]);
      }, 700);
      return () => clearTimeout(t);
    }
  }, [selected, deck]);

  const handleFlip = (idx: number) => {
    if (selected.length === 2) return;
    const card = deck[idx];
    if (card.flipped || card.matched) return;
    setDeck((d) => d.map((c, i) => (i === idx ? { ...c, flipped: true } : c)));
    setSelected((s) => [...s, idx]);
  };

  const reset = () => {
    setDeck(buildDeck(pairs));
    setSelected([]);
    setMoves(0);
  };

  return (
    <Card className="max-w-md w-full">
      <CardContent className="py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Quick brain reset</h3>
          </div>
          <span className="text-xs text-muted-foreground">Moves: {moves}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Match the pairs while your test is paused. No English required — just relax.
        </p>

        <div className="grid grid-cols-4 gap-2">
          {deck.map((card, idx) => {
            const shown = card.flipped || card.matched;
            return (
              <button
                key={card.id}
                onClick={() => handleFlip(idx)}
                disabled={shown || selected.length === 2}
                className={`aspect-square rounded-lg text-2xl flex items-center justify-center transition-all
                  ${
                    shown
                      ? card.matched
                        ? "bg-primary/10 border-2 border-primary/40"
                        : "bg-secondary border-2 border-primary"
                      : "bg-muted hover:bg-muted/70 border-2 border-transparent"
                  }`}
                aria-label={shown ? card.symbol : "Hidden card"}
              >
                {shown ? card.symbol : ""}
              </button>
            );
          })}
        </div>

        {allMatched && (
          <div className="text-center text-sm text-primary font-medium">
            🎉 All matched in {moves} moves!
          </div>
        )}

        <Button variant="ghost" size="sm" onClick={reset} className="w-full">
          <RotateCw className="h-3.5 w-3.5 mr-2" />
          New game
        </Button>
      </CardContent>
    </Card>
  );
}