'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export type VoiceGender = 'female' | 'male' | 'default';

export interface SpeechOptions {
  rate?: number;   // 0.5 - 2.0
  pitch?: number;  // 0 - 2.0
  volume?: number; // 0 - 1
  voiceGender?: VoiceGender;
}

export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setIsSupported(true);

      const loadVoices = () => {
        const available = window.speechSynthesis.getVoices();
        if (available.length > 0) setVoices(available);
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      return () => {
        window.speechSynthesis.cancel();
      };
    }
  }, []);

  // Strip markdown for cleaner speech
  const cleanMarkdown = (text: string): string => {
    return text
      .replace(/```[\s\S]*?```/g, 'code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\[(.+?)\]\(.+?\)/g, '$1')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/^>\s+/gm, '')
      .replace(/\|.+\|/g, '')
      .replace(/[-=]{3,}/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  };

  const getBestVoice = useCallback((gender: VoiceGender): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;

    const english = voices.filter(v => v.lang.startsWith('en'));
    const pool = english.length > 0 ? english : voices;

    if (gender === 'female') {
      const female = pool.find(v =>
        /samantha|zira|karen|victoria|fiona|allison|ava|susan|female|woman/i.test(v.name)
      );
      return female || pool[0];
    }

    if (gender === 'male') {
      const male = pool.find(v =>
        /daniel|alex|fred|ralph|thomas|oliver|male|man/i.test(v.name)
      );
      return male || pool[0];
    }

    // Default: prefer high quality voices
    const premium = pool.find(v =>
      /samantha|daniel|karen|alex|enhanced|premium|neural/i.test(v.name)
    );
    return premium || pool[0];
  }, [voices]);

  const speak = useCallback((text: string, options: SpeechOptions = {}) => {
    if (!isSupported) return;

    window.speechSynthesis.cancel();

    const cleaned = cleanMarkdown(text);
    const utterance = new SpeechSynthesisUtterance(cleaned);

    utterance.rate = options.rate ?? 1.05;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;

    const voice = getBestVoice(options.voiceGender ?? 'default');
    if (voice) utterance.voice = voice;

    utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
    utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); };
    utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
    utterance.onpause = () => setIsPaused(true);
    utterance.onresume = () => setIsPaused(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isSupported, getBestVoice]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [isSupported]);

  const pause = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  }, [isSupported]);

  const resume = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  }, [isSupported]);

  return { speak, stop, pause, resume, isSpeaking, isPaused, isSupported, voices };
}
