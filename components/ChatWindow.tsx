'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Database, ImagePlus, X, Mic, MicOff } from 'lucide-react';
import { Agent, AgentId } from '@/lib/agents';
import { RAGDocument, retrieveChunks, buildRAGContext } from '@/lib/rag';
import { ChatMessage, ImageAttachment } from '@/lib/image-chat';
import MessageBubble from './MessageBubble';

interface ChatWindowProps {
  agent: Agent;
  onMessageCountChange: (count: number) => void;
  ragDocuments?: RAGDocument[];
  onAgentChange?: (id: AgentId) => void;
  initialMessages?: ChatMessage[];
  onMessagesChange?: (messages: ChatMessage[]) => void;
}

interface BrowserSpeechRecognitionAlternative {
  transcript: string;
}

interface BrowserSpeechRecognitionResultLike {
  [index: number]: BrowserSpeechRecognitionAlternative | undefined;
  length: number;
}

interface BrowserSpeechRecognitionEventLike extends Event {
  results: ArrayLike<BrowserSpeechRecognitionResultLike>;
}

interface BrowserSpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
}

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognitionLike;

export default function ChatWindow({
  agent,
  onMessageCountChange,
  ragDocuments = [],
  initialMessages = [],
  onMessagesChange,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const streamBufferRef = useRef('');
  const [error, setError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState('Thinking...');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognitionLike | null>(null);
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const isImageAgent = agent.id === 'nano-banana-studio';
  const isRealtimeIntel = agent.id === 'realtime-intel';
  const isExamPrepAgent = agent.id === 'exam-prep-coach';
  const [examIntake, setExamIntake] = useState<{
    originalPrompt: string;
    stepIndex: number;
    answers: Record<string, string>;
    questions: Array<{ key: string; question: string; options: string[] }>;
  } | null>(null);
  const [voiceLang, setVoiceLang] = useState<'en-IN' | 'hi-IN' | 'te-IN'>('en-IN');
  const [isListening, setIsListening] = useState(false);
  const [responseLanguageHint, setResponseLanguageHint] = useState<string | null>(null);
  const isVoiceSupported = typeof window !== 'undefined' && Boolean((window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionCtor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
  }).SpeechRecognition || (window as Window & {
    SpeechRecognition?: BrowserSpeechRecognitionCtor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
  }).webkitSpeechRecognition);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom, isLoading]);
  useEffect(() => { onMessageCountChange(messages.length); }, [messages.length, onMessageCountChange]);
  useEffect(() => { onMessagesChange?.(messages); }, [messages, onMessagesChange]);
  useEffect(() => {
    abortRef.current?.abort();
    recognitionRef.current?.stop();
    setMessages(initialMessages);
    setExamIntake(null);
    setInput('');
    setPendingImages([]);
    setError(null);
    setIsLoading(false);
    streamBufferRef.current = '';
    setLoadingStatus('Thinking...');
    setIsListening(false);
    setResponseLanguageHint(null);
  }, [initialMessages]);

  useEffect(() => () => {
    abortRef.current?.abort();
    recognitionRef.current?.stop();
  }, []);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const buildUserContent = useCallback((userText: string): string => {
    if (ragDocuments.length === 0 || isImageAgent) return userText;
    const allChunks = ragDocuments.flatMap(d => d.chunks);
    const chunks = retrieveChunks(userText, allChunks, 5);
    if (chunks.length === 0) return userText;
    return `${buildRAGContext(chunks)}\n\n## User question:\n${userText}`;
  }, [ragDocuments, isImageAgent]);

  const shouldStartExamIntake = useCallback((text: string) => {
    if (!isExamPrepAgent) return false;
    const lower = text.toLowerCase();
    const broadSignals = ['prepare', 'prep', 'exam', 'mock', 'paper', 'study plan', 'current affairs', 'topic wise'];
    const hasBroadIntent = broadSignals.some(signal => lower.includes(signal));
    const hasEnoughSpecificity =
      /(prelims|mains|interview)/i.test(text) &&
      /(english|hindi|telugu)/i.test(text) &&
      /(easy|medium|hard)/i.test(text);

    return hasBroadIntent && !hasEnoughSpecificity;
  }, [isExamPrepAgent]);

  const buildExamQuestionFlow = useCallback((text: string) => {
    const lower = text.toLowerCase();
    const asksMockPaper = /mock|question paper|practice paper|paper/i.test(text);
    const asksPlan = /study plan|roadmap|schedule/i.test(text);
    const asksCurrentAffairs = /current affairs|latest/i.test(text);
    const asksTopicWise = /topic wise|subject wise|each topic/i.test(text);

    const questions: Array<{ key: string; question: string; options: string[] }> = [];

    if (!/(prelims|mains|interview)/i.test(text)) {
      questions.push({
        key: 'paperStage',
        question: asksMockPaper
          ? 'Which paper should I generate for you?'
          : 'Which stage are you preparing for?',
        options: ['Prelims', 'Mains', 'Interview', 'Not sure'],
      });
    }

    if (asksTopicWise && !/polity|history|economy|science|geography|reasoning|aptitude/i.test(lower)) {
      questions.push({
        key: 'topicFocus',
        question: 'Which topic area should I focus on first?',
        options: ['General Studies', 'Polity', 'History', 'Economy'],
      });
    }

    if (!/(english|hindi|telugu)/i.test(text)) {
      questions.push({
        key: 'language',
        question: 'Which language do you want the output in?',
        options: ['English', 'Hindi', 'Telugu'],
      });
    }

    if (!/(easy|medium|hard)/i.test(text)) {
      questions.push({
        key: 'difficulty',
        question: asksPlan
          ? 'What level should I target in the plan?'
          : 'What difficulty should I target?',
        options: ['Easy', 'Medium', 'Hard'],
      });
    }

    if (!asksCurrentAffairs) {
      questions.push({
        key: 'currentAffairs',
        question: 'Do you want current affairs included?',
        options: ['Yes', 'No'],
      });
    }

    questions.push({
      key: 'answers',
      question: asksMockPaper
        ? 'Should I include the answer key and explanations?'
        : 'Do you want answers or explanation notes included?',
      options: ['Yes', 'No'],
    });

    return questions;
  }, []);

  const getExamQuestionMessage = useCallback((questions: Array<{ key: string; question: string; options: string[] }>, stepIndex: number) => {
    const step = questions[stepIndex];
    return {
      role: 'assistant' as const,
      content: step.question,
      meta: {
        quickReplies: [...step.options],
        intakeType: 'exam-prep' as const,
        intakeQuestionKey: step.key,
      },
    };
  }, []);

  const readFileAsDataUrl = useCallback((file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  }), []);

  const runNetworkRequest = useCallback(async (apiHistory: ChatMessage[], displayText?: string) => {
    try {
      if (isImageAgent) {
        setLoadingStatus('Analyzing image request...');
        const res = await fetch('/api/image-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: apiHistory, agentId: agent.id }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Image request failed');
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.text || 'Image generated successfully.',
          images: data.images,
          meta: data.meta,
        }]);
        setIsLoading(false);
        return;
      }

      setLoadingStatus(
        isRealtimeIntel
          ? 'Searching recent sources and analyzing results...'
          : 'Analyzing your request...'
      );
      abortRef.current = new AbortController();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortRef.current.signal,
        body: JSON.stringify({ messages: apiHistory, agentId: agent.id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Request failed');
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let firstChunkReceived = false;
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!firstChunkReceived) {
          setLoadingStatus('Generating response...');
          firstChunkReceived = true;
        }
        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const { text } = JSON.parse(data);
            if (text) {
              streamBufferRef.current += text;
              window.dispatchEvent(new CustomEvent('stream-token', { detail: streamBufferRef.current }));
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }

      const final = streamBufferRef.current || displayText || '';
      streamBufferRef.current = '';
      setIsLoading(false);
      setMessages(prev => [...prev, { role: 'assistant', content: final }]);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsLoading(false);
    } finally {
      abortRef.current = null;
      setLoadingStatus('Thinking...');
    }
  }, [agent.id, isImageAgent, isRealtimeIntel]);

  const continueExamIntake = useCallback(async (
    nextMessages: ChatMessage[],
    nextIntake: { originalPrompt: string; stepIndex: number; answers: Record<string, string>; questions: Array<{ key: string; question: string; options: string[] }> },
  ) => {
    const nextStepIndex = nextIntake.stepIndex + 1;
    if (nextStepIndex < nextIntake.questions.length) {
      setMessages(prev => [...prev, getExamQuestionMessage(nextIntake.questions, nextStepIndex)]);
      setExamIntake({ ...nextIntake, stepIndex: nextStepIndex });
      return true;
    }

    setExamIntake(null);
    const finalInstruction = [
      `Original request: ${nextIntake.originalPrompt}`,
      `Paper/stage: ${nextIntake.answers.paperStage ?? 'Not specified'}`,
      `Language: ${nextIntake.answers.language ?? 'Not specified'}`,
      `Difficulty: ${nextIntake.answers.difficulty ?? 'Not specified'}`,
      `Topic focus: ${nextIntake.answers.topicFocus ?? 'Not specified'}`,
      `Include current affairs: ${nextIntake.answers.currentAffairs ?? 'Not specified'}`,
      `Include answers/explanations: ${nextIntake.answers.answers ?? 'Not specified'}`,
      'Use the above answers to continue and generate the best exam prep response. If freshness is needed for current affairs, use recent web-backed context.',
    ].join('\n');

    const finalMessages = [...nextMessages, { role: 'user' as const, content: finalInstruction }];
    await runNetworkRequest(finalMessages, finalInstruction);
    return true;
  }, [getExamQuestionMessage, runNetworkRequest]);

  const handleImageInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(file => file.type.startsWith('image/'));
    if (!files.length) return;

    try {
      const attachments = await Promise.all(files.map(async file => ({
        type: 'image' as const,
        name: file.name,
        mimeType: file.type || 'image/png',
        dataUrl: await readFileAsDataUrl(file),
      })));
      setPendingImages(prev => [...prev, ...attachments].slice(0, 4));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image');
    } finally {
      e.target.value = '';
    }
  }, [readFileAsDataUrl]);

  const removePendingImage = useCallback((index: number) => {
    setPendingImages(prev => prev.filter((_, currentIndex) => currentIndex !== index));
  }, []);

  const startVoiceInput = useCallback(() => {
    if (!isVoiceSupported || isListening) return;
    const SpeechRecognitionCtor = (window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionCtor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
    }).SpeechRecognition || (window as Window & {
      SpeechRecognition?: BrowserSpeechRecognitionCtor;
      webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
    }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = voiceLang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: BrowserSpeechRecognitionEventLike) => {
      const transcript = Array.from(event.results)
        .map(result => result?.[0]?.transcript ?? '')
        .join(' ')
        .trim();
      setInput(transcript);
      setResponseLanguageHint(
        voiceLang === 'te-IN' ? 'Telugu' : voiceLang === 'hi-IN' ? 'Hindi' : 'English'
      );
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, isVoiceSupported, voiceLang]);

  const stopVoiceInput = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const sendMessage = useCallback(async (userContent: string) => {
    const trimmed = userContent.trim();
    if ((!trimmed && pendingImages.length === 0) || isLoading) return;
    setError(null);
    const currentPendingImages = pendingImages;

    const rawMsg: ChatMessage = {
      role: 'user',
      content: trimmed,
      attachments: currentPendingImages.length ? currentPendingImages : undefined,
    };

    setMessages(prev => [...prev, rawMsg]);
    setInput('');
    setIsLoading(true);
    streamBufferRef.current = '';
    setStreamVersion(v => v + 1);

    const augmentedMsg: ChatMessage = {
      role: 'user',
      content: buildUserContent(
        responseLanguageHint
          ? `${trimmed}\n\nPlease respond in ${responseLanguageHint}.`
          : trimmed
      ),
      attachments: currentPendingImages.length ? currentPendingImages : undefined,
    };
    const nextMessages = [...messages, rawMsg];
    const apiHistory = [...messages, augmentedMsg];
    setPendingImages([]);

    if (isExamPrepAgent && examIntake) {
      const currentStep = examIntake.questions[examIntake.stepIndex];
      const nextIntake = {
        ...examIntake,
        answers: {
          ...examIntake.answers,
          [currentStep.key]: trimmed,
        },
      };
      await continueExamIntake(nextMessages, nextIntake);
      return;
    }

    if (isExamPrepAgent && shouldStartExamIntake(trimmed)) {
      const questions = buildExamQuestionFlow(trimmed);
      const firstQuestion = getExamQuestionMessage(questions, 0);
      setMessages(prev => [...prev, firstQuestion]);
      setExamIntake({
        originalPrompt: trimmed,
        stepIndex: 0,
        answers: {},
        questions,
      });
      setIsLoading(false);
      return;
    }

    await runNetworkRequest(apiHistory);
    setResponseLanguageHint(null);
  }, [
    buildExamQuestionFlow,
    buildUserContent,
    continueExamIntake,
    examIntake,
    getExamQuestionMessage,
    isExamPrepAgent,
    isLoading,
    messages,
    pendingImages,
    responseLanguageHint,
    runNetworkRequest,
    shouldStartExamIntake,
  ]);

  const handleSubmit = useCallback(() => sendMessage(input), [input, sendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    recognitionRef.current?.stop();
    setMessages([]);
    setIsLoading(false);
    streamBufferRef.current = '';
    setError(null);
    setPendingImages([]);
    setInput('');
    setExamIntake(null);
    setLoadingStatus('Thinking...');
    setIsListening(false);
    setResponseLanguageHint(null);
  }, []);

  const ragActive = ragDocuments.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#080C10' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 24px', borderBottom: '1px solid #1A2332', flexShrink: 0,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: agent.accentColor, border: `1px solid ${agent.color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem',
        }}>
          {agent.emoji}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: agent.color, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.95rem' }}>
            {agent.name}
          </div>
          <div style={{ color: '#8B949E', fontFamily: 'DM Sans, sans-serif', fontSize: '0.72rem', marginTop: 1 }}>
            {agent.description}
          </div>
        </div>
        {ragActive && !isImageAgent && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 6,
            background: 'rgba(0,212,255,0.07)', border: '1px solid rgba(0,212,255,0.2)',
            color: '#00D4FF', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem',
          }}>
            <Database size={10} />{ragDocuments.length} doc{ragDocuments.length !== 1 ? 's' : ''}
          </div>
        )}
        {messages.length > 0 && (
          <button onClick={clearChat} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
            background: 'rgba(255,69,96,0.08)', border: '1px solid rgba(255,69,96,0.2)',
            color: '#FF4560', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem',
          }}>
            <Trash2 size={11} /> Clear
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }} className="chat-scroll">
        {messages.length === 0 && !isLoading ? (
          <WelcomeScreen
            agent={agent}
            ragActive={ragActive && !isImageAgent}
            onExampleClick={sendMessage}
            isRealtimeIntel={isRealtimeIntel}
          />
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} agent={agent} onQuickReply={sendMessage} />
            ))}
            {isLoading && (
              <div style={{
                margin: '0 24px 8px',
                color: agent.color,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.68rem',
                opacity: 0.9,
              }}>
                {loadingStatus}
              </div>
            )}
            {isLoading && !isImageAgent && (
              <LiveStreamBubble key={streamVersion} agent={agent} bufferRef={streamBufferRef} />
            )}
            {isLoading && isImageAgent && (
              <ImageLoadingBubble agent={agent} />
            )}
          </>
        )}

        {error && (
          <div style={{
            margin: '8px 24px', padding: '10px 14px', borderRadius: 8,
            background: 'rgba(255,69,96,0.08)', border: '1px solid rgba(255,69,96,0.2)',
            color: '#FF4560', fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem',
            display: 'flex', gap: 8,
          }}>
            <span>⚠</span><span>{error}</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ flexShrink: 0, padding: '10px 16px', borderTop: '1px solid #1A2332' }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end', borderRadius: 12, padding: 8,
          background: '#0D1117',
          border: `1px solid ${input || pendingImages.length ? agent.color + '55' : '#1A2332'}`,
          transition: 'border-color 0.2s',
        }}>
          {isVoiceSupported && !isImageAgent && (
            <>
              <select
                value={voiceLang}
                onChange={e => setVoiceLang(e.target.value as 'en-IN' | 'hi-IN' | 'te-IN')}
                disabled={isListening || isLoading}
                style={{
                  height: 36,
                  borderRadius: 8,
                  border: '1px solid #1A2332',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#C9D1D9',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.68rem',
                  padding: '0 8px',
                  outline: 'none',
                }}
              >
                <option value="en-IN">English</option>
                <option value="hi-IN">Hindi</option>
                <option value="te-IN">Telugu</option>
              </select>
              <button
                onClick={isListening ? stopVoiceInput : startVoiceInput}
                disabled={isLoading}
                title={isListening ? 'Stop voice input' : 'Start voice input'}
                style={{
                  width: 36, height: 36, flexShrink: 0, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isListening ? 'rgba(255,69,96,0.12)' : 'rgba(255,255,255,0.04)',
                  color: isListening ? '#FF4560' : '#8B949E',
                  border: `1px solid ${isListening ? 'rgba(255,69,96,0.25)' : '#1A2332'}`,
                  cursor: 'pointer',
                }}
              >
                {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            </>
          )}
          {isImageAgent && (
            <>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageInput}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => imageInputRef.current?.click()}
                disabled={isLoading}
                title="Attach image"
                style={{
                  width: 36, height: 36, flexShrink: 0, borderRadius: 8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#F59E0B',
                  border: '1px solid rgba(245,158,11,0.15)',
                  cursor: 'pointer',
                }}
              >
                <ImagePlus size={15} />
              </button>
            </>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isImageAgent
              ? 'Describe, generate, or edit an image...'
              : `Ask ${agent.name}...${ragActive ? ' (RAG active)' : ''}`}
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none',
              color: '#C9D1D9', fontFamily: 'DM Sans, sans-serif', fontSize: '0.875rem',
              lineHeight: '1.6', maxHeight: 160, minHeight: 36, padding: '6px 8px',
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={(!input.trim() && pendingImages.length === 0) || isLoading}
            style={{
              width: 36, height: 36, flexShrink: 0, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: (input.trim() || pendingImages.length) && !isLoading ? agent.color : 'rgba(255,255,255,0.05)',
              color: (input.trim() || pendingImages.length) && !isLoading ? '#080C10' : '#4A5568',
              border: 'none',
              cursor: (input.trim() || pendingImages.length) && !isLoading ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            {isLoading ? <Spinner color={agent.color} /> : <Send size={15} />}
          </button>
        </div>

        {isImageAgent && pendingImages.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            {pendingImages.map((image, index) => (
              <div key={`${image.name}-${index}`} style={{ position: 'relative', width: 72, height: 72 }}>
                <img
                  src={image.dataUrl}
                  alt={image.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 10,
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}
                />
                <button
                  onClick={() => removePendingImage(index)}
                  style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: '#080C10',
                    color: '#F59E0B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{
          textAlign: 'center', marginTop: 5,
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#2D3748',
        }}>
          {isImageAgent ? 'attach image or type prompt | enter to send' : 'enter sends | shift+enter adds a newline | AI-generated'}
        </div>
      </div>
    </div>
  );
}

function LiveStreamBubble({
  agent,
  bufferRef,
}: {
  agent: Agent;
  bufferRef: React.MutableRefObject<string>;
}) {
  const preRef = useRef<HTMLPreElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onToken = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;

      if (preRef.current) {
        preRef.current.textContent = text;
      }

      endRef.current?.scrollIntoView({
        block: 'end',
        behavior: 'smooth',
      });
    };

    window.addEventListener('stream-token', onToken);

    if (preRef.current && bufferRef.current) {
      preRef.current.textContent = bufferRef.current;
    }

    return () => window.removeEventListener('stream-token', onToken);
  }, [bufferRef]);

  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 24px' }}>
      <div style={{
        width: 28, height: 28, flexShrink: 0, borderRadius: 8, marginTop: 2,
        background: agent.accentColor, border: `1px solid ${agent.color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
      }}>
        {agent.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0, maxWidth: '56rem' }}>
        <div style={{ color: agent.color, fontFamily: 'Syne, sans-serif', fontSize: '0.72rem', marginBottom: 6 }}>
          {agent.name}
        </div>
        <div style={{
          background: '#0D1117', border: '1px solid #1A2332',
          borderRadius: '0 12px 12px 12px', padding: '14px 16px',
        }}>
          <pre
            ref={preRef}
            style={{
              margin: 0, background: 'transparent',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem',
              lineHeight: '1.7', color: '#C9D1D9',
            }}
          />
          <span className="cursor-blink" />
        </div>
      </div>
      <div ref={endRef} />
    </div>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <>
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        border: '2px solid transparent', borderTopColor: color,
        animation: 'chatSpin 0.7s linear infinite',
      }} />
      <style>{`@keyframes chatSpin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function ImageLoadingBubble({ agent }: { agent: Agent }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 24px' }}>
      <div style={{
        width: 28, height: 28, flexShrink: 0, borderRadius: 8, marginTop: 2,
        background: agent.accentColor, border: `1px solid ${agent.color}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem',
      }}>
        {agent.emoji}
      </div>
      <div style={{ flex: 1, minWidth: 0, maxWidth: '56rem' }}>
        <div style={{ color: agent.color, fontFamily: 'Syne, sans-serif', fontSize: '0.72rem', marginBottom: 6 }}>
          {agent.name}
        </div>
        <div style={{
          background: '#0D1117', border: '1px solid #1A2332',
          borderRadius: '0 12px 12px 12px', padding: '14px 16px',
          color: '#C9D1D9', fontFamily: 'DM Sans, sans-serif', fontSize: '0.9rem',
        }}>
          Rendering image with Gemini models...
        </div>
      </div>
    </div>
  );
}

type IntelCategory = 'govt-jobs' | 'latest-news' | 'stocks' | 'sports' | 'weather' | 'trends';

function RealtimeIntelStarter({
  onSubmit,
  accentColor,
}: {
  onSubmit: (text: string) => void;
  accentColor: string;
}) {
  const [category, setCategory] = useState<IntelCategory>('govt-jobs');
  const [country, setCountry] = useState('India');
  const [stateMode, setStateMode] = useState<'yes' | 'no'>('yes');
  const [stateName, setStateName] = useState('Telangana');
  const [timeWindow, setTimeWindow] = useState('this week');
  const [jobType, setJobType] = useState('all government jobs');
  const [includeEligibility, setIncludeEligibility] = useState<'yes' | 'no'>('yes');
  const [newsRegion, setNewsRegion] = useState('India');
  const [marketName, setMarketName] = useState('Indian stock market');
  const [sportsScope, setSportsScope] = useState('cricket');
  const [weatherLocation, setWeatherLocation] = useState('Hyderabad');
  const [trendFocus, setTrendFocus] = useState('IT job market');
  const [freeText, setFreeText] = useState('');

  const buildPrompt = () => {
    switch (category) {
      case 'govt-jobs':
        return [
          `Give me the latest government job updates for ${country}`,
          stateMode === 'yes' ? `focused on ${stateName}` : 'covering all states and national openings',
          `for ${timeWindow}`,
          `with priority on ${jobType}`,
          includeEligibility === 'yes'
            ? 'Include post name, department, application dates, eligibility, age limit, selection process, fees, salary, and official source links.'
            : 'Include post name, department, application dates, and official source links.',
          'If important details are missing in source pages, say that clearly.',
        ].join(', ') + '.';
      case 'latest-news':
        return `Give me the latest news for ${newsRegion} for ${timeWindow}. Organize it by top headlines, policy/government, business, international, and explain why each item matters with dates and sources.`;
      case 'stocks':
        return `Give me a detailed real-time update on ${marketName} for ${timeWindow}. Cover major movers, indices, likely causes, sector trends, risks, and what to watch next with source-backed details.`;
      case 'sports':
        return `Give me the latest ${sportsScope} updates for ${timeWindow}. Include key results, upcoming matches, standings or tournament implications, dates, and why each update matters.`;
      case 'weather':
        return `Give me the latest weather and forecast update for ${weatherLocation} for ${timeWindow}. Include temperatures, rain or storm risk, warnings if any, and practical advice.`;
      case 'trends':
        return `Give me the latest trend analysis on ${trendFocus} for ${timeWindow}. Explain what is changing, why it is happening, who it affects, and what to watch next with recent source-backed details.`;
      default:
        return freeText.trim();
    }
  };

  const submit = () => {
    const prompt = category === 'trends' && freeText.trim()
      ? `Give me the latest trend analysis on ${freeText.trim()} for ${timeWindow} with recent source-backed details.`
      : buildPrompt();
    onSubmit(prompt);
  };

  const categories: Array<{ id: IntelCategory; label: string }> = [
    { id: 'govt-jobs', label: 'Govt Jobs' },
    { id: 'latest-news', label: 'Latest News' },
    { id: 'stocks', label: 'Stocks' },
    { id: 'sports', label: 'Sports' },
    { id: 'weather', label: 'Weather' },
    { id: 'trends', label: 'Trends' },
  ];

  return (
    <div style={{
      width: '100%',
      maxWidth: 620,
      marginBottom: 22,
      padding: 16,
      borderRadius: 16,
      background: 'rgba(255,255,255,0.02)',
      border: `1px solid ${accentColor}22`,
      textAlign: 'left',
    }}>
      <div style={{ color: '#E6EDF3', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.96rem', marginBottom: 6 }}>
        Guided Realtime Search
      </div>
      <div style={{ color: '#8B949E', fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', lineHeight: 1.5, marginBottom: 12 }}>
        Pick a category and fill a few options. I will turn it into a focused real-time query before searching.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {categories.map(item => (
          <button
            key={item.id}
            onClick={() => setCategory(item.id)}
            style={{
              padding: '7px 10px',
              borderRadius: 999,
              border: `1px solid ${category === item.id ? accentColor + '55' : '#1A2332'}`,
              background: category === item.id ? `${accentColor}22` : 'rgba(255,255,255,0.02)',
              color: category === item.id ? accentColor : '#8B949E',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.66rem',
              cursor: 'pointer',
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {category === 'govt-jobs' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <InlineField label="Country" value={country} onChange={setCountry} placeholder="India" />
          <BinaryChoice label="Specific state?" value={stateMode} onChange={setStateMode} accentColor={accentColor} />
          {stateMode === 'yes' && (
            <InlineField label="State" value={stateName} onChange={setStateName} placeholder="Telangana" />
          )}
          <ChoiceRow
            label="Time Window"
            value={timeWindow}
            onChange={setTimeWindow}
            options={['today', 'this week', 'this month']}
            accentColor={accentColor}
          />
          <InlineField label="Job Focus" value={jobType} onChange={setJobType} placeholder="Group exams, teaching, police, railway..." />
          <BinaryChoice label="Include eligibility and full details?" value={includeEligibility} onChange={setIncludeEligibility} accentColor={accentColor} />
        </div>
      )}

      {category === 'latest-news' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <InlineField label="Region" value={newsRegion} onChange={setNewsRegion} placeholder="India, US, global..." />
          <ChoiceRow
            label="Time Window"
            value={timeWindow}
            onChange={setTimeWindow}
            options={['today', 'this week', 'this month']}
            accentColor={accentColor}
          />
        </div>
      )}

      {category === 'stocks' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <InlineField label="Market or Stock" value={marketName} onChange={setMarketName} placeholder="Nifty, Sensex, Tesla, Nvidia..." />
          <ChoiceRow
            label="Time Window"
            value={timeWindow}
            onChange={setTimeWindow}
            options={['today', 'this week', 'this month']}
            accentColor={accentColor}
          />
        </div>
      )}

      {category === 'sports' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <InlineField label="Sport / League" value={sportsScope} onChange={setSportsScope} placeholder="cricket, IPL, football, NBA..." />
          <ChoiceRow
            label="Time Window"
            value={timeWindow}
            onChange={setTimeWindow}
            options={['today', 'this week']}
            accentColor={accentColor}
          />
        </div>
      )}

      {category === 'weather' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <InlineField label="Location" value={weatherLocation} onChange={setWeatherLocation} placeholder="Hyderabad" />
          <ChoiceRow
            label="Forecast Window"
            value={timeWindow}
            onChange={setTimeWindow}
            options={['today', 'this week']}
            accentColor={accentColor}
          />
        </div>
      )}

      {category === 'trends' && (
        <div style={{ display: 'grid', gap: 10 }}>
          <InlineField label="Trend Topic" value={trendFocus} onChange={setTrendFocus} placeholder="IT jobs, AI hiring, startup funding..." />
          <InlineField label="Other Topic (optional)" value={freeText} onChange={setFreeText} placeholder="Use this if your topic is very specific" />
          <ChoiceRow
            label="Time Window"
            value={timeWindow}
            onChange={setTimeWindow}
            options={['today', 'this week', 'this month']}
            accentColor={accentColor}
          />
        </div>
      )}

      <button
        onClick={submit}
        style={{
          marginTop: 14,
          padding: '10px 14px',
          borderRadius: 10,
          border: 'none',
          background: accentColor,
          color: '#080C10',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.7rem',
          cursor: 'pointer',
        }}
      >
        Search With These Options
      </button>
    </div>
  );
}

function InlineField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: '#4A5568', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 12px',
          borderRadius: 10,
          border: '1px solid #1A2332',
          background: '#0D1117',
          color: '#E6EDF3',
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '0.84rem',
          outline: 'none',
        }}
      />
    </label>
  );
}

function BinaryChoice({
  label,
  value,
  onChange,
  accentColor,
}: {
  label: string;
  value: 'yes' | 'no';
  onChange: (value: 'yes' | 'no') => void;
  accentColor: string;
}) {
  return (
    <ChoiceRow
      label={label}
      value={value}
      onChange={value => onChange(value as 'yes' | 'no')}
      options={['yes', 'no']}
      accentColor={accentColor}
    />
  );
}

function ChoiceRow({
  label,
  value,
  onChange,
  options,
  accentColor,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  accentColor: string;
}) {
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: '#4A5568', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {options.map(option => (
          <button
            key={option}
            onClick={() => onChange(option)}
            style={{
              padding: '8px 10px',
              borderRadius: 999,
              border: `1px solid ${value === option ? accentColor + '55' : '#1A2332'}`,
              background: value === option ? `${accentColor}22` : 'rgba(255,255,255,0.02)',
              color: value === option ? accentColor : '#8B949E',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.66rem',
              cursor: 'pointer',
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function WelcomeScreen({
  agent, ragActive, onExampleClick, isRealtimeIntel,
}: {
  agent: Agent;
  ragActive: boolean;
  onExampleClick: (t: string) => void;
  isRealtimeIntel: boolean;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100%', padding: '40px 32px', textAlign: 'center',
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: agent.accentColor, border: `2px solid ${agent.color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem',
        boxShadow: `0 0 40px ${agent.color}22`,
      }}>
        {agent.emoji}
      </div>
      <h2 style={{ color: agent.color, fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '1.5rem', marginBottom: 8 }}>
        {agent.name}
      </h2>
      <p style={{ color: '#8B949E', fontFamily: 'DM Sans, sans-serif', fontSize: '0.875rem', maxWidth: 340, lineHeight: 1.6, marginBottom: 20 }}>
        {agent.description}
      </p>
      {ragActive && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20,
          padding: '6px 14px', borderRadius: 8,
          background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)',
          color: '#00D4FF', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem',
        }}>
          <Database size={12} /> RAG active - I have context from your documents
        </div>
      )}
      {isRealtimeIntel && (
        <RealtimeIntelStarter onSubmit={onExampleClick} accentColor={agent.color} />
      )}
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ color: '#4A5568', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, textAlign: 'left' }}>
          Try -&gt;
        </div>
        {agent.examples.map((ex, i) => (
          <button key={i} onClick={() => onExampleClick(ex)} style={{
            width: '100%', textAlign: 'left', padding: '10px 14px',
            borderRadius: 8, marginBottom: 6, cursor: 'pointer',
            background: 'rgba(255,255,255,0.02)', border: '1px solid #1A2332',
            color: '#8B949E', fontFamily: 'DM Sans, sans-serif', fontSize: '0.82rem',
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = agent.color + '44'; e.currentTarget.style.background = agent.accentColor; e.currentTarget.style.color = '#C9D1D9'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#1A2332'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.color = '#8B949E'; }}
          >
            <span style={{ color: agent.color, marginRight: 8 }}>{'>'}</span>{ex}
          </button>
        ))}
      </div>
    </div>
  );
}
