import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice layer for the mock interview: browser speech recognition for the
 * candidate's answers and speech synthesis for the interviewer's questions.
 * Falls back gracefully to text-only when the browser lacks support.
 */

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceSession() {
  const supported = typeof window !== "undefined" && Boolean(getRecognitionCtor());
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");

  const startListening = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;
    recRef.current?.abort();
    finalRef.current = "";
    setTranscript("");

    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e: SpeechRecognitionEventLike) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += chunk + " ";
        else interim += chunk;
      }
      setTranscript((finalRef.current + interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }, []);

  /** Stops capture and returns the final transcript. */
  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
    return (finalRef.current || transcript).trim();
  }, [transcript]);

  const speak = useCallback(
    (text: string) => {
      if (!ttsSupported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 1.02;
      utter.pitch = 1;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    },
    [ttsSupported],
  );

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [ttsSupported]);

  useEffect(
    () => () => {
      recRef.current?.abort();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    },
    [],
  );

  return {
    supported,
    ttsSupported,
    listening,
    speaking,
    transcript,
    setTranscript,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
