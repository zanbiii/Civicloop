'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Mic, MicOff, Square, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useTranslate } from '@/components/AppLanguageProvider';

type VoiceLanguage = 'en' | 'kn' | 'hi';

interface VoiceInputProps {
  value: string;
  onChange: (text: string) => void;
  /** Receives everything dictated so far, so the caller can store it as the voice transcript. */
  onVoiceTranscript?: (transcript: string) => void;
  onListeningChange?: (listening: boolean) => void;
  language?: VoiceLanguage;
  placeholder?: string;
  rows?: number;
  className?: string;
}

const LANGUAGE_META: Record<VoiceLanguage, { bcp47: string; label: string }> = {
  en: { bcp47: 'en-IN', label: 'English' },
  kn: { bcp47: 'kn-IN', label: 'ಕನ್ನಡ' },
  hi: { bcp47: 'hi-IN', label: 'हिन्दी' },
};

/* The Web Speech API is not in TypeScript's DOM lib, so only the surface we use is typed here. */
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: RecognitionResult };
}
interface RecognitionErrorEvent {
  readonly error: string;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionConstructor = new () => Recognition;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => {};

function useSpeechSupported(): boolean {
  return useSyncExternalStore(noopSubscribe, () => getRecognitionConstructor() !== null, () => false);
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone permission was denied. You can type your description instead.',
  'service-not-allowed': 'Voice typing is blocked in this browser. You can type your description instead.',
  'no-speech': "We didn't hear anything. Tap the mic and try again.",
  'audio-capture': 'No microphone was found. You can type your description instead.',
  network: 'Voice typing needs an internet connection. You can type your description instead.',
  'language-not-supported': 'This language is not supported for voice typing here. Try English.',
};

export default function VoiceInput({
  value,
  onChange,
  onVoiceTranscript,
  onListeningChange,
  language = 'en',
  placeholder = 'Describe the issue — or tap the mic and speak.',
  rows = 4,
  className,
}: VoiceInputProps) {
  const t = useTranslate();
  const supported = useSpeechSupported();
  const recognitionRef = useRef<Recognition | null>(null);
  const valueRef = useRef(value);
  const spokenRef = useRef('');
  const callbacksRef = useRef({ onChange, onVoiceTranscript, onListeningChange });

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    callbacksRef.current = { onChange, onVoiceTranscript, onListeningChange };
  }, [onChange, onVoiceTranscript, onListeningChange]);

  useEffect(() => {
    recognitionRef.current?.abort();
  }, [language]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const start = () => {
    const Constructor = getRecognitionConstructor();
    if (!Constructor) return;
    setError(null);

    const recognition = new Constructor();
    recognition.lang = LANGUAGE_META[language].bcp47;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim(interimText);

      const spoken = finalText.trim();
      if (!spoken) return;
      const base = valueRef.current.trimEnd();
      const next = base ? `${base} ${spoken}` : spoken;
      valueRef.current = next;
      spokenRef.current = spokenRef.current ? `${spokenRef.current} ${spoken}` : spoken;
      callbacksRef.current.onChange(next);
      callbacksRef.current.onVoiceTranscript?.(spokenRef.current);
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return;
      setError(ERROR_MESSAGES[event.error] ?? 'Voice typing stopped unexpectedly. You can keep typing instead.');
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim('');
      callbacksRef.current.onListeningChange?.(false);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
      callbacksRef.current.onListeningChange?.(true);
    } catch {
      setError('Voice typing could not start. You can type your description instead.');
    }
  };

  const stop = () => recognitionRef.current?.stop();

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'relative rounded-xl border bg-white transition duration-150',
          listening
            ? 'border-red-400 ring-4 ring-red-100 dark:ring-red-950/60'
            : 'border-slate-300 hover:border-slate-400 focus-within:border-emerald-600 focus-within:ring-4 focus-within:ring-emerald-500/15 dark:focus-within:border-emerald-400',
        )}
      >
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t(placeholder)}
          rows={rows}
          aria-label={t(placeholder)}
          className="block w-full resize-none rounded-xl bg-transparent px-3.5 pb-14 pt-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:outline-none"
        />

        {interim && (
          <div className="pointer-events-none absolute inset-x-3.5 bottom-14 truncate text-sm italic text-slate-400">
            {interim}
          </div>
        )}

        <div className="absolute inset-x-2 bottom-2 flex items-center justify-between">
          <div className="flex items-center gap-2 pl-1.5 text-xs">
            {listening ? (
              <>
                <span className="flex h-4 items-center gap-0.5" aria-hidden>
                  {[0, 1, 2, 3, 4].map((bar) => (
                    <span
                      key={bar}
                      className="h-full w-0.5 origin-center animate-voice-bar rounded-full bg-red-500"
                      style={{ animationDelay: `${bar * 0.12}s` }}
                    />
                  ))}
                </span>
                <span className="font-semibold text-red-600">{t('Listening')} · {LANGUAGE_META[language].label}</span>
              </>
            ) : (
              <span className="text-slate-400">
                {supported ? `${t('Voice typing')} · ${LANGUAGE_META[language].label}` : t('Voice typing unavailable — type instead')}
              </span>
            )}
          </div>

          {supported ? (
            <button
              type="button"
              onClick={listening ? stop : start}
              aria-label={listening ? 'Stop voice typing' : 'Start voice typing'}
              className={cn(
                'relative flex h-10 w-10 items-center justify-center rounded-full text-white shadow transition active:scale-90',
                listening ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-700 hover:scale-105 hover:bg-emerald-800',
              )}
            >
              {listening && <span className="absolute inset-0 animate-ping rounded-full bg-red-500 opacity-40" />}
              {listening ? <Square className="relative h-4 w-4 fill-current" /> : <Mic className="h-5 w-5" />}
            </button>
          ) : (
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"
              title={t('Voice typing needs Chrome, Edge or Safari')}
            >
              <MicOff className="h-5 w-5" />
            </span>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="flex animate-slide-down items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t(error)}
        </div>
      )}
    </div>
  );
}
