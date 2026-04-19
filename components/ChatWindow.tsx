'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Trash2, Database } from 'lucide-react';
import { Agent, AgentId } from '@/lib/agents';
import { RAGDocument, retrieveChunks, buildRAGContext } from '@/lib/rag';
import MessageBubble from './MessageBubble';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatWindowProps {
  agent: Agent;
  onMessageCountChange: (count: number) => void;
  ragDocuments?: RAGDocument[];
  onAgentChange?: (id: AgentId) => void;
}

export default function ChatWindow({
  agent,
  onMessageCountChange,
  ragDocuments = [],
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const streamBufferRef = useRef('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);
  useEffect(() => { onMessageCountChange(messages.length); }, [messages.length, onMessageCountChange]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
    }
  }, [input]);

  const buildUserContent = useCallback((userText: string): string => {
    if (ragDocuments.length === 0) return userText;
    const allChunks = ragDocuments.flatMap(d => d.chunks);
    const chunks = retrieveChunks(userText, allChunks, 5);
    if (chunks.length === 0) return userText;
    return `${buildRAGContext(chunks)}\n\n## User question:\n${userText}`;
  }, [ragDocuments]);

  const sendMessage = useCallback(async (userContent: string) => {
    if (!userContent.trim() || isLoading) return;
    setError(null);

    const rawMsg: Message = { role: 'user', content: userContent.trim() };
    setMessages(prev => [...prev, rawMsg]);
    setInput('');
    setIsLoading(true);
    streamBufferRef.current = '';
    setStreamVersion(v => v + 1);

    const augmentedMsg: Message = { role: 'user', content: buildUserContent(userContent.trim()) };
    const apiHistory = [...messages, augmentedMsg];

    try {
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const raw = decoder.decode(value, { stream: true });
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const { text } = JSON.parse(data);
            if (text) {
              streamBufferRef.current += text;
              window.dispatchEvent(
                new CustomEvent('stream-token', { detail: streamBufferRef.current })
              );
            }
          } catch { /* ignore */ }
        }
      }

      const final = streamBufferRef.current;
      streamBufferRef.current = '';
      setIsLoading(false);
      setMessages(prev => [...prev, { role: 'assistant', content: final }]);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsLoading(false);
    }
  }, [agent.id, isLoading, messages, buildUserContent]);

  const handleSubmit = useCallback(() => sendMessage(input), [input, sendMessage]);
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
  }, [handleSubmit]);

  const clearChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
    streamBufferRef.current = '';
    setError(null);
  }, []);

  const ragActive = ragDocuments.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#080C10' }}>
      {/* Header */}
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
        {ragActive && (
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

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }} className="chat-scroll">
        {messages.length === 0 && !isLoading ? (
          <WelcomeScreen agent={agent} ragActive={ragActive} onExampleClick={sendMessage} />
        ) : (
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} agent={agent} />
            ))}
            {isLoading && (
              <LiveStreamBubble key={streamVersion} agent={agent} bufferRef={streamBufferRef} />
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

      {/* Input */}
      <div style={{ flexShrink: 0, padding: '10px 16px', borderTop: '1px solid #1A2332' }}>
        <div style={{
          display: 'flex', gap: 8, alignItems: 'flex-end', borderRadius: 12, padding: 8,
          background: '#0D1117',
          border: `1px solid ${input ? agent.color + '55' : '#1A2332'}`,
          transition: 'border-color 0.2s',
        }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${agent.name}…${ragActive ? ' (RAG active)' : ''}`}
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
            disabled={!input.trim() || isLoading}
            style={{
              width: 36, height: 36, flexShrink: 0, borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: input.trim() && !isLoading ? agent.color : 'rgba(255,255,255,0.05)',
              color: input.trim() && !isLoading ? '#080C10' : '#4A5568',
              border: 'none', cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            {isLoading ? <Spinner color={agent.color} /> : <Send size={15} />}
          </button>
        </div>
        <div style={{
          textAlign: 'center', marginTop: 5,
          fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', color: '#2D3748',
        }}>
          ↵ send · ⇧↵ newline · AI-generated
        </div>
      </div>
    </div>
  );
}

/* ─── Live stream bubble ─────────────────────────────────────────────────────
   Mounts once. Listens for 'stream-token' events and writes text
   directly to the DOM — bypasses React reconciler entirely.
   No re-renders of ChatWindow or this component on every token.
*/
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
      behavior: 'smooth', // ✅ FIXED
    });
  };

  window.addEventListener('stream-token', onToken);

  if (preRef.current && bufferRef.current) {
    preRef.current.textContent = bufferRef.current;
  }

  return () => window.removeEventListener('stream-token', onToken);
}, []);

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
        border: `2px solid transparent`, borderTopColor: color,
        animation: 'chatSpin 0.7s linear infinite',
      }} />
      <style>{`@keyframes chatSpin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function WelcomeScreen({
  agent, ragActive, onExampleClick,
}: { agent: Agent; ragActive: boolean; onExampleClick: (t: string) => void }) {
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
          <Database size={12} /> RAG active — I have context from your documents
        </div>
      )}
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ color: '#4A5568', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, textAlign: 'left' }}>
          Try →
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
            <span style={{ color: agent.color, marginRight: 8 }}>›</span>{ex}
          </button>
        ))}
      </div>
    </div>
  );
}
