import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, RotateCw } from "lucide-react";

/**
 * BrainResetSequenceGame — Simon-says style sequence memory.
 * 4 colored pads, sequence grows each round. Language-free.
 */
const PADS = [
  { base: "bg-primary/30", lit: "bg-primary" },
  { base: "bg-secondary", lit: "bg-secondary-foreground" },
  { base: "bg-accent", lit: "bg-accent-foreground" },
  { base: "bg-muted", lit: "bg-muted-foreground" },
];

type Mode = "watch" | "input" | "gameover";

export function BrainResetSequenceGame() {
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [mode, setMode] = useState<Mode>("watch");
  const [activePad, setActivePad] = useState<number | null>(null);
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  const startNewGame = () => {
    clearTimers();
    setSequence([Math.floor(Math.random() * 4)]);
    setPlayerIndex(0);
    setMode("watch");
  };

  // Boot first round on mount
  useEffect(() => {
    startNewGame();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Play the sequence whenever we enter watch mode
  useEffect(() => {
    if (mode !== "watch" || sequence.length === 0) return;
    clearTimers();
    sequence.forEach((padIdx, i) => {
      timersRef.current.push(
        setTimeout(() => setActivePad(padIdx), i * 700 + 300),
      );
      timersRef.current.push(
        setTimeout(() => setActivePad(null), i * 700 + 800),
      );
    });
    timersRef.current.push(
      setTimeout(() => {
        setPlayerIndex(0);
        setMode("input");
      }, sequence.length * 700 + 400),
    );
    return clearTimers;
  }, [mode, sequence]);

  const handlePad = (idx: number) => {
    if (mode !== "input") return;
    setActivePad(idx);
    setTimeout(() => setActivePad(null), 200);
    if (idx !== sequence[playerIndex]) {
      setMode("gameover");
      return;
    }
    const next = playerIndex + 1;
    if (next >= sequence.length) {
      // Round cleared — extend sequence
      setTimeout(() => {
        setSequence((s) => [...s, Math.floor(Math.random() * 4)]);
        setMode("watch");
      }, 500);
    } else {
      setPlayerIndex(next);
    }
  };

  return (
    <Card className="max-w-md w-full">
      <CardContent className="py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Color sequence</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {mode === "gameover"
              ? `Reached round ${sequence.length - 1}`
              : `Round ${sequence.length}`}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Watch the pattern, then tap it back. The sequence grows each round.
        </p>

        <div className="grid grid-cols-2 gap-2">
          {PADS.map((pad, idx) => {
            const active = activePad === idx;
            return (
              <button
                key={idx}
                onClick={() => handlePad(idx)}
                disabled={mode !== "input"}
                className={`aspect-square rounded-lg transition-all border-2 border-transparent ${
                  active ? pad.lit : pad.base
                }`}
                aria-label={`Pad ${idx + 1}`}
              />
            );
          })}
        </div>

        <div className="text-center text-xs text-muted-foreground">
          {mode === "watch" && "Watch…"}
          {mode === "input" && "Your turn"}
          {mode === "gameover" && "Game over"}
        </div>

        <Button variant="ghost" size="sm" onClick={startNewGame} className="w-full">
          <RotateCw className="h-3.5 w-3.5 mr-2" />
          {mode === "gameover" ? "Try again" : "Restart"}
        </Button>
      </CardContent>
    </Card>
  );
}