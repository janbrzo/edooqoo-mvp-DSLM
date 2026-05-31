import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, RotateCw } from "lucide-react";

/**
 * BrainResetReactionGame — language-free "tap the lit square" reaction test.
 * 10 rounds, reports average reaction time. Pure client state.
 */
const GRID = 16;
const ROUNDS = 10;

export function BrainResetReactionGame() {
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<number | null>(null);
  const [times, setTimes] = useState<number[]>([]);
  const [waiting, setWaiting] = useState(true);
  const startAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNext = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setWaiting(true);
    setTarget(null);
    const delay = 600 + Math.random() * 1200;
    timerRef.current = setTimeout(() => {
      const idx = Math.floor(Math.random() * GRID);
      startAtRef.current = performance.now();
      setTarget(idx);
      setWaiting(false);
    }, delay);
  };

  useEffect(() => {
    if (round < ROUNDS) scheduleNext();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const handleClick = (idx: number) => {
    if (waiting || target === null) return;
    if (idx !== target) return;
    const dt = performance.now() - startAtRef.current;
    setTimes((t) => [...t, dt]);
    setRound((r) => r + 1);
  };

  const reset = () => {
    setTimes([]);
    setTarget(null);
    setRound(0);
    setWaiting(true);
  };

  const done = round >= ROUNDS;
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

  return (
    <Card className="max-w-md w-full">
      <CardContent className="py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Reaction tap</h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {done ? `Avg: ${avg} ms` : `Round ${Math.min(round + 1, ROUNDS)}/${ROUNDS}`}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Tap the highlighted square as fast as you can.
        </p>

        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: GRID }).map((_, idx) => {
            const isTarget = idx === target;
            return (
              <button
                key={idx}
                onClick={() => handleClick(idx)}
                disabled={done}
                className={`aspect-square rounded-lg transition-all border-2 ${
                  isTarget
                    ? "bg-primary border-primary animate-pulse"
                    : "bg-muted border-transparent hover:bg-muted/70"
                }`}
                aria-label={isTarget ? "Tap now" : "Wait"}
              />
            );
          })}
        </div>

        {done && (
          <div className="text-center text-sm text-primary font-medium">
            🎉 Average {avg} ms across {ROUNDS} rounds
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