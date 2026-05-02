import React, { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'react-qr-code';

interface AudioPlayerProps {
  audioUrl: string;
  transcript?: string;
  duration?: number;
  voice?: string;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  transcript,
  duration,
  voice
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setAudioDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(audioUrl);
      setIsCopied(true);
      toast({
        title: "Audio link copied!",
        description: "Share it with your students",
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Failed to copy",
        description: "Please try again",
      });
    }
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 via-purple-50 to-blue-50 rounded-lg p-6 border-2 border-worksheet-purple shadow-md">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      
      {/* Grid Layout: Audio Player (left) + QR Code (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6">
        {/* LEFT: Audio Player (75-80%) */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            🎧 Lesson Audio
            {voice && <span className="text-sm text-gray-500">({voice})</span>}
          </h3>
          
          {/* Progress Bar */}
          <div className="space-y-2">
            <Slider
              value={[currentTime]}
              max={audioDuration}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-600">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(audioDuration)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <Button
              onClick={togglePlay}
              size="lg"
              className="bg-worksheet-purple hover:bg-worksheet-purple/90"
            >
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 ml-1" />}
            </Button>
            
            <div className="flex items-center gap-2 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleMute}
                className="p-2"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-24"
              />
            </div>
          </div>

          {/* Transcript (optional) */}
          {transcript && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-worksheet-purple">
                Show Transcript
              </summary>
              <div className="mt-2 p-4 bg-white rounded-lg border text-sm text-gray-700 leading-relaxed">
                {transcript}
              </div>
            </details>
          )}
        </div>
        
        {/* RIGHT: QR Code (20-25%) - only for non-base64 URLs */}
        {!audioUrl.startsWith('data:') && (
          <div className="flex flex-col items-center justify-center bg-white rounded-lg border-2 border-worksheet-purple p-4 shadow-sm min-w-[160px]">
            <div 
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleCopyLink}
              title="Click to copy audio link"
            >
              <QRCode value={audioUrl} size={120} />
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleCopyLink}
              className="mt-2 text-xs h-8 px-2"
            >
              {isCopied ? (
                <>
                  <Check className="h-3 w-3 mr-1 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy audio link
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500 text-center mt-1">
              Scan QR or click to copy
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioPlayer;
