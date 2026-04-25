'use client';

import { useState, useCallback, useEffect } from 'react';
import AgentSidebar from '@/components/AgentSidebar';
import ChatWindow from '@/components/ChatWindow';
import RAGPanel from '@/components/RAGPanel';
import { getAgent, AgentId } from '@/lib/agents';
import { RAGDocument } from '@/lib/rag';
import { ChatMessage, ChatSession } from '@/lib/image-chat';
import { Menu, PanelRight, Database, X } from 'lucide-react';

const CHAT_STORAGE_KEY = 'agentic-ai-suite-chat-sessions';

function createSession(agentId: AgentId, title = 'New Chat'): ChatSession {
  const now = Date.now();
  return {
    id: `${agentId}_${now}`,
    agentId,
    title,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
}

export default function Home() {
  const [activeAgentId, setActiveAgentId] = useState<AgentId>('auto');
  const [messageCount, setMessageCount] = useState(0);
  const [ragDocuments, setRagDocuments] = useState<RAGDocument[]>([]);
  const [showRAG, setShowRAG] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');

  const activeAgent = getAgent(activeAgentId);
  const activeSessions = sessions
    .filter(session => session.agentId === activeAgentId)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const activeSession = activeSessions.find(session => session.id === activeSessionId) ?? activeSessions[0] ?? null;

  const handleAgentChange = useCallback((id: AgentId) => {
    setActiveAgentId(id);
    setMessageCount(0);
    const nextSessions = sessions
      .filter(session => session.agentId === id)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    if (nextSessions[0]) {
      setActiveSessionId(nextSessions[0].id);
    } else {
      const session = createSession(id);
      setSessions(prev => [session, ...prev]);
      setActiveSessionId(session.id);
    }
  }, [sessions]);

  const handleNewChat = useCallback(() => {
    const session = createSession(activeAgentId);
    setSessions(prev => [session, ...prev]);
    setActiveSessionId(session.id);
    setMessageCount(0);
    if (isMobile) {
      setShowSidebar(false);
    }
  }, [activeAgentId, isMobile]);

  const handleSelectSession = useCallback((id: string) => {
    const session = sessions.find(item => item.id === id);
    if (!session) return;
    setActiveSessionId(id);
    setActiveAgentId(session.agentId as AgentId);
    if (isMobile) {
      setShowSidebar(false);
    }
  }, [isMobile, sessions]);

  const handleMessagesChange = useCallback((messages: ChatMessage[]) => {
    setMessageCount(messages.length);
    setSessions(prev => prev.map(session => {
      if (session.id !== activeSessionId) return session;
      const firstUserMessage = messages.find(message => message.role === 'user' && message.content.trim());
      return {
        ...session,
        messages,
        title: firstUserMessage ? firstUserMessage.content.trim().slice(0, 48) : session.title,
        updatedAt: Date.now(),
      };
    }));
  }, [activeSessionId]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 900px)');
    const sync = () => {
      const mobile = media.matches;
      setIsMobile(mobile);
      if (!mobile) {
        setShowSidebar(false);
      }
    };

    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
      if (!raw) {
        const initialSession = createSession('auto');
        setSessions([initialSession]);
        setActiveSessionId(initialSession.id);
        return;
      }

      const parsed = JSON.parse(raw) as ChatSession[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        const initialSession = createSession('auto');
        setSessions([initialSession]);
        setActiveSessionId(initialSession.id);
        return;
      }

      setSessions(parsed);
      setActiveSessionId(parsed[0].id);
      setActiveAgentId(parsed[0].agentId as AgentId);
    } catch {
      const initialSession = createSession('auto');
      setSessions([initialSession]);
      setActiveSessionId(initialSession.id);
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(sessions));
    }
  }, [sessions]);

  return (
    <main style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: '#080C10', position: 'relative' }}>
      {!isMobile && (
        <AgentSidebar
          activeAgent={activeAgentId}
          onSelect={handleAgentChange}
          messageCount={messageCount}
          sessions={activeSessions}
          activeSessionId={activeSession?.id}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
        />
      )}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', minWidth: 0 }}>
        {isMobile && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 12,
              zIndex: 20,
              display: 'flex',
              gap: 8,
            }}
          >
            <button
              onClick={() => setShowSidebar(true)}
              title="Open agents"
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid #1A2332',
                color: '#C9D1D9',
                cursor: 'pointer',
              }}
            >
              <Menu size={16} />
            </button>
            <button
              onClick={() => setShowRAG(v => !v)}
              title={showRAG ? 'Hide RAG panel' : 'Show RAG panel'}
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: showRAG ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${showRAG ? 'rgba(0,212,255,0.25)' : '#1A2332'}`,
                color: showRAG ? '#00D4FF' : '#C9D1D9',
                cursor: 'pointer',
              }}
            >
              <Database size={15} />
            </button>
          </div>
        )}
        <button
          onClick={() => setShowRAG(v => !v)}
          title={showRAG ? 'Hide RAG panel' : 'Show RAG panel'}
          style={{
            position: 'absolute', top: 10, right: showRAG && !isMobile ? 268 : 12, zIndex: isMobile ? 0 : 10,
            width: 28, height: 28, borderRadius: 7,
            display: isMobile ? 'none' : 'flex', alignItems: 'center', justifyContent: 'center',
            background: showRAG ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${showRAG ? 'rgba(0,212,255,0.25)' : '#1A2332'}`,
            color: showRAG ? '#00D4FF' : '#4A5568',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <PanelRight size={13} />
        </button>
        <ChatWindow
          key={activeSession?.id || activeAgentId}
          agent={activeAgent}
          onMessageCountChange={setMessageCount}
          ragDocuments={ragDocuments}
          initialMessages={activeSession?.messages ?? []}
          onMessagesChange={handleMessagesChange}
        />
      </div>
      {!isMobile && showRAG && (
        <RAGPanel
          documents={ragDocuments}
          onDocumentsChange={setRagDocuments}
        />
      )}
      {isMobile && showSidebar && (
        <div
          onClick={() => setShowSidebar(false)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 40,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              height: '100%',
              width: 'min(86vw, 320px)',
              background: '#080C10',
              boxShadow: '20px 0 60px rgba(0,0,0,0.35)',
            }}
          >
            <AgentSidebar
              activeAgent={activeAgentId}
              onSelect={handleAgentChange}
              messageCount={messageCount}
              isMobile
              onClose={() => setShowSidebar(false)}
              sessions={activeSessions}
              activeSessionId={activeSession?.id}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
            />
          </div>
        </div>
      )}
      {isMobile && showRAG && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 'min(88vw, 320px)',
              background: '#080C10',
              borderLeft: '1px solid #1A2332',
              pointerEvents: 'auto',
              boxShadow: '-20px 0 60px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '10px 12px',
                borderBottom: '1px solid #1A2332',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ color: '#E6EDF3', fontFamily: 'Syne, sans-serif', fontSize: '0.9rem', fontWeight: 700 }}>
                RAG Context
              </div>
              <button
                onClick={() => setShowRAG(false)}
                aria-label="Close RAG panel"
                style={{
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  border: '1px solid #1A2332',
                  background: 'rgba(255,255,255,0.03)',
                  color: '#8B949E',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <RAGPanel
                documents={ragDocuments}
                onDocumentsChange={setRagDocuments}
                fullWidth
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
