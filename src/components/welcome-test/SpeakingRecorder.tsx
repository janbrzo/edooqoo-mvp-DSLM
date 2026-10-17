/**
 * SpeakingRecorder - Microphone recording component for Welcome Test speaking questions
 * Records up to 60s of audio, uploads to R2 via base64 JSON, saves URL as answer
 * One save path (`saveRecording`): the Save button, Next/Skip/Complete (through
 * `flushSpeaking`) and unmount all share one upload. Minimum length 1.5 s.
 * Cross-browser: tries audio/webm, audio/mp4, then no mimeType
 * P1.8: capability guards + honest upload failures (no fabricated placeholder answers)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Play, Pause, RotateCcw, Upload, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { devLog } from '@/utils/logger';
import { registerSpeakingFlusher } from '@/lib/welcomeTest/speakingFlush';
import {
  checkRecordingSupport,
  describeMicrophoneError,
  getSupportedMimeType,
  tryUploadRecording,
  uploadRecording,
} from '@/lib/audio/recorder';

interface SpeakingRecorderProps {
  maxSeconds?: number;
  answer?: string; // URL if already recorded
  /** Called once per saved recording with the question it was recorded for. */
  onAnswer: (audioUrl: string, questionId?: string) => void;
  questionId?: string;
}

/**
 * Backwards-compatible wrapper kept for existing callers.
 * Returns null on failure (never a placeholder string).
 */
export async function uploadBlobToR2(blob: Blob): Promise<string | null> {
  return tryUploadRecording(blob, { filenamePrefix: 'welcome-test-speaking' });
}


/** Recordings shorter than this are discarded (accidental taps, empty audio). */
const MIN_RECORDING_MS = 1500;

export function SpeakingRecorder({ maxSeconds = 60, answer, onAnswer, questionId }: SpeakingRecorderProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'recorded' | 'uploading' | 'done' | 'error'>(
    answer ? 'done' : 'idle'
  );
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(answer || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const startedAtRef = useRef(0);
  // Set when the last recording was discarded as too short; makes a navigation
  // flush report "not saved" once so the message is seen before leaving.
  const errorFromTooShortRef = useRef(false);
  // Resolvers waiting for the recorder's final blob (onstop).
  const stopWaitersRef = useRef<Array<(blob: Blob | null) => void>>([]);
  // Single upload in flight: every save path (Save button, Next, Skip, Complete,
  // unmount) shares it, so one recording is uploaded exactly once.
  const uploadRef = useRef<Promise<boolean> | null>(null);
  const questionIdRef = useRef(questionId);
  const onAnswerRef = useRef(onAnswer);
  questionIdRef.current = questionId;
  onAnswerRef.current = onAnswer;

  const clearTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  // Reset visual state when the question or the saved answer changes
  useEffect(() => {
    setStatus(answer ? 'done' : 'idle');
    setAudioUrl(answer || null);
    setSeconds(0);
    setIsPlaying(false);
    setErrorMsg(null);
  }, [answer, questionId]);

  /** Stops an active recording and resolves with its final blob (null when none or too short). */
  const stopAndGetBlob = useCallback((): Promise<Blob | null> => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === 'recording') {
      clearTimer();
      return new Promise((resolve) => {
        stopWaitersRef.current.push(resolve);
        mr.stop();
      });
    }
    return Promise.resolve(blobRef.current);
  }, []);

  /**
   * The only save path. Resolves true when there is nothing left to save (or the
   * upload succeeded), false when a recording exists but could not be saved.
   */
  const saveRecording = useCallback((): Promise<boolean> => {
    if (uploadRef.current) return uploadRef.current;
    const job = (async () => {
      const targetQuestionId = questionIdRef.current;
      const blob = await stopAndGetBlob();
      if (!blob) {
        const tooShort = errorFromTooShortRef.current;
        errorFromTooShortRef.current = false;
        return !tooShort;
      }
      setStatus('uploading');
      setErrorMsg(null);
      try {
        const url = await uploadRecording(blob, {
          filenamePrefix: 'welcome-test-speaking',
          onRetry: (attempt) => devLog('[SpeakingRecorder] Upload retry', attempt),
        });
        blobRef.current = null;
        setAudioUrl(url);
        setStatus('done');
        onAnswerRef.current(url, targetQuestionId);
        toast.success('Recording saved!');
        return true;
      } catch (err) {
        // Honest failure: keep the blob so the student can retry.
        devLog('[SpeakingRecorder] Upload error:', err);
        setStatus('recorded');
        setErrorMsg("We couldn't upload your recording. Check your connection and tap Save again.");
        toast.error('Recording not saved: please try again.');
        return false;
      }
    })().finally(() => { uploadRef.current = null; });
    uploadRef.current = job;
    return job;
  }, [stopAndGetBlob]);

  // Let the page flush this recording before navigating (Next, Skip, Complete).
  useEffect(() => registerSpeakingFlusher(saveRecording), [saveRecording]);

  // Cleanup on unmount: finish and upload whatever was recorded, release the mic.
  useEffect(() => {
    return () => {
      void saveRecording();
      clearTimer();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [saveRecording]);

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    errorFromTooShortRef.current = false;

    const support = checkRecordingSupport();
    if (!support.supported) {
      setErrorMsg(support.reason ?? 'Recording is not available in this browser.');
      setStatus('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const mimeType = getSupportedMimeType();
      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
      } catch (err) {
        devLog('[SpeakingRecorder] MediaRecorder creation failed:', err);
        try {
          mediaRecorder = new MediaRecorder(stream);
        } catch {
          stream.getTracks().forEach(t => t.stop());
          setErrorMsg('Your browser does not support audio recording. Please try Chrome or Firefox.');
          setStatus('error');
          return;
        }
      }

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        clearTimer();
        const tooShort = Date.now() - startedAtRef.current < MIN_RECORDING_MS;
        let result: Blob | null = null;
        if (tooShort || chunksRef.current.length === 0) {
          blobRef.current = null;
          errorFromTooShortRef.current = true;
          setAudioUrl(null);
          setSeconds(0);
          setErrorMsg('That recording was too short. Please record for a couple of seconds.');
          setStatus('error');
        } else {
          const actualMime = mediaRecorder.mimeType || 'audio/webm';
          result = new Blob(chunksRef.current, { type: actualMime });
          blobRef.current = result;
          setAudioUrl(URL.createObjectURL(result));
          setStatus('recorded');
        }
        const waiters = stopWaitersRef.current;
        stopWaitersRef.current = [];
        waiters.forEach((resolve) => resolve(result));
      };

      mediaRecorder.onerror = () => {
        setErrorMsg('Recording failed. Please try again.');
        setStatus('error');
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      startedAtRef.current = Date.now();
      setStatus('recording');
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds(prev => {
          if (prev >= maxSeconds - 1) {
            clearTimer();
            if (mediaRecorder.state === 'recording') mediaRecorder.stop();
            return maxSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      devLog('[SpeakingRecorder] Microphone error:', err);
      setErrorMsg(describeMicrophoneError(err));
      setStatus('error');
    }
  }, [maxSeconds]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      clearTimer();
      mediaRecorderRef.current.stop();
    }
  }, []);

  const playAudio = useCallback(() => {
    if (!audioUrl) return;
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => setIsPlaying(false);
    audio.play();
    setIsPlaying(true);
  }, [audioUrl]);

  const pauseAudio = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const resetRecording = useCallback(() => {
    if (audioUrl && audioUrl.startsWith('blob:')) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    blobRef.current = null;
    errorFromTooShortRef.current = false;
    setSeconds(0);
    setStatus('idle');
    setIsPlaying(false);
    setErrorMsg(null);
  }, [audioUrl]);

  const uploadAndSave = useCallback(() => { void saveRecording(); }, [saveRecording]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-3">
      {status === 'recording' && (
        <div className="flex items-center justify-center gap-0.5 h-12 bg-red-50 dark:bg-red-900/10 rounded-lg px-4">
          {Array.from({ length: 20 }, (_, i) => (
            <div
              key={i}
              className="w-1 bg-red-400 rounded-full animate-pulse"
              style={{
                height: `${12 + Math.random() * 24}px`,
                animationDelay: `${i * 50}ms`,
                animationDuration: `${300 + Math.random() * 400}ms`,
              }}
            />
          ))}
        </div>
      )}

      {(status === 'recording' || status === 'recorded') && (
        <div className="text-center text-sm font-mono text-muted-foreground">
          {formatTime(seconds)} / {formatTime(maxSeconds)}
        </div>
      )}

      {(status === 'error' || (status === 'recorded' && errorMsg)) && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{errorMsg || 'Recording failed. Please try again.'}</span>
        </div>
      )}


      <div className="flex items-center justify-center gap-2 flex-wrap">
        {(status === 'idle' || status === 'error') && (
          <Button onClick={startRecording} variant="outline" size="sm" className="gap-2 min-h-[44px] px-4">
            <Mic className="h-5 w-5 text-red-500" />
            Start Recording
          </Button>
        )}

        {status === 'recording' && (
          <Button onClick={stopRecording} variant="destructive" size="sm" className="gap-2 min-h-[44px] px-4">
            <Square className="h-4 w-4" />
            Stop ({formatTime(maxSeconds - seconds)} left)
          </Button>
        )}

        {status === 'recorded' && (
          <>
            <Button onClick={isPlaying ? pauseAudio : playAudio} variant="outline" size="sm" className="gap-1.5 min-h-[44px]">
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <Button onClick={resetRecording} variant="ghost" size="sm" className="gap-1.5 min-h-[44px]">
              <RotateCcw className="h-4 w-4" />
              Re-record
            </Button>
            <Button onClick={uploadAndSave} size="sm" className="gap-1.5 min-h-[44px]"
              variant={errorMsg ? 'destructive' : 'default'}>
              <Upload className="h-4 w-4" />
              {errorMsg ? 'Retry save' : 'Save'}
            </Button>

          </>
        )}

        {status === 'uploading' && (
          <Button disabled size="sm" className="gap-2 min-h-[44px]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </Button>
        )}

        {status === 'done' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Recording saved
            </div>
            <Button onClick={resetRecording} variant="ghost" size="sm" className="gap-1.5 text-xs min-h-[44px]">
              <RotateCcw className="h-3 w-3" />
              Re-record
            </Button>
          </div>
        )}
      </div>

      {status === 'idle' && (
        <p className="text-[11px] text-muted-foreground text-center">
          Click to record your answer. You can record up to {maxSeconds} seconds.
        </p>
      )}
    </div>
  );
}
