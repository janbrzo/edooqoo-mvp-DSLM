/**
 * ListeningPlayer - Audio playback component for Welcome Test listening questions
 * Shows audio player + optional transcript toggle + answer input
 */

import { useState, useRef } from 'react';
import { Play, Pause, Volume2, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface ListeningPlayerProps {
  audioUrl: string;
  transcript?: string;
}

export function ListeningPlayer({ audioUrl, transcript }: ListeningPlayerProps) {
  const hasAudio = audioUrl && audioUrl.trim() !== '';
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTranscript, setShowTranscript] = useState(!hasAudio); // auto-show if no audio
  const [playCount, setPlayCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const togglePlay = () => {
    if (!hasAudio) return;
    if (!audioRef.current) {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setProgress(100);
        if (intervalRef.current) clearInterval(intervalRef.current);
      };

      audio.onplay = () => {
        setPlayCount(prev => prev + 1);
        intervalRef.current = setInterval(() => {
          if (audio.duration) {
            setProgress((audio.currentTime / audio.duration) * 100);
          }
        }, 100);
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const replay = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
      setIsPlaying(true);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Volume2 className="h-3.5 w-3.5" />
        <span>Listen to the audio, then answer below</span>
        {playCount > 0 && <span className="ml-auto">Played {playCount}×</span>}
      </div>

      {hasAudio ? (
        <div className="flex items-center gap-2">
          <Button onClick={togglePlay} variant="outline" size="sm" className="gap-1.5 h-8">
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {isPlaying ? 'Pause' : 'Play'}
          </Button>

          <div className="flex-1">
            <Progress value={progress} className="h-1.5" />
          </div>

          {playCount > 0 && (
            <Button onClick={replay} variant="ghost" size="sm" className="h-8 gap-1 text-xs">
              <RotateCcw className="h-3 w-3" />
              Replay
            </Button>
          )}
        </div>
      ) : (
        <div className="text-xs text-amber-600 dark:text-amber-400 italic">
          ⚠️ Audio not available — transcript shown below
        </div>
      )}

      {/* Transcript toggle */}
      {transcript && (
        <div>
          <Button
            onClick={() => setShowTranscript(!showTranscript)}
            variant="ghost"
            size="sm"
            className="text-xs h-7 gap-1.5 text-muted-foreground"
          >
            {showTranscript ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showTranscript ? 'Hide text' : 'Show text (if listening doesn\'t work)'}
          </Button>
          {showTranscript && (
            <div className="mt-2 p-2.5 bg-background rounded border text-sm text-muted-foreground italic">
              {transcript}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
