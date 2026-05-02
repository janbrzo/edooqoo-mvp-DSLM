/**
 * LiveAudioPlayer - Mini play/pause icon button for teacher view
 * Shows student's recorded audio as a small icon (like on /shared)
 */
import React, { useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';

interface LiveAudioPlayerProps {
  audioUrl?: string;
  className?: string;
}

export const LiveAudioPlayer: React.FC<LiveAudioPlayerProps> = ({ audioUrl, className = '' }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  if (!audioUrl) return null;

  const toggle = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className={`inline-flex items-center ${className}`}>
      <button
        onClick={toggle}
        className="h-6 w-6 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors"
        title={isPlaying ? 'Pause' : 'Play student audio'}
      >
        {isPlaying
          ? <Pause className="h-3 w-3 text-primary" />
          : <Play className="h-3 w-3 text-primary ml-0.5" />
        }
      </button>
      <audio
        ref={audioRef}
        preload="none"
        onEnded={() => setIsPlaying(false)}
        onError={() => setIsPlaying(false)}
      >
        <source src={audioUrl} type="audio/webm" />
        <source src={audioUrl} type="audio/mp4" />
      </audio>
    </div>
  );
};

export default LiveAudioPlayer;
