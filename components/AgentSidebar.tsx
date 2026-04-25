'use client';

import { AGENT_LIST, Agent, AgentId } from '@/lib/agents';
import { Cpu, ChevronRight, X } from 'lucide-react';
import { ChatSession } from '@/lib/image-chat';

interface AgentSidebarProps {
  activeAgent: AgentId;
  onSelect: (id: AgentId) => void;
  messageCount: number;
  isMobile?: boolean;
  onClose?: () => void;
  sessions?: ChatSession[];
  activeSessionId?: string;
  onSelectSession?: (id: string) => void;
  onNewChat?: () => void;
}

export default function AgentSidebar({
  activeAgent,
  onSelect,
  messageCount,
  isMobile = false,
  onClose,
  sessions = [],
  activeSessionId,
  onSelectSession,
  onNewChat,
}: AgentSidebarProps) {
  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: isMobile ? 'min(86vw, 320px)' : 260,
        minWidth: isMobile ? 'min(86vw, 320px)' : 260,
        background: '#080C10',
        borderRight: '1px solid #1A2332',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4" style={{ borderBottom: '1px solid #1A2332' }}>
        <div
          className="flex items-center justify-center rounded-lg"
          style={{
            width: 32,
            height: 32,
            background: 'rgba(0,255,156,0.12)',
            border: '1px solid rgba(0,255,156,0.25)',
          }}
        >
          <Cpu size={16} style={{ color: '#00FF9C' }} />
        </div>
        <div>
          <div className="font-display font-700 text-sm leading-tight" style={{ color: '#E6EDF3', fontFamily: 'Syne, sans-serif', fontWeight: 700 }}>
            Agentic AI
          </div>
          <div className="text-xs leading-tight" style={{ color: '#4A5568', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
            powered by Groq
          </div>
        </div>
        {messageCount > 0 && (
          <div
            className="ml-auto flex items-center justify-center text-xs rounded-full"
            style={{
              width: 20,
              height: 20,
              background: 'rgba(0,255,156,0.15)',
              color: '#00FF9C',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.65rem',
              border: '1px solid rgba(0,255,156,0.2)',
            }}
          >
            {messageCount}
          </div>
        )}
        {isMobile && onClose && (
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            style={{
              marginLeft: 8,
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
        )}
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto py-2 chat-scroll">
        <div className="px-3 py-1.5">
          <span
            className="text-xs uppercase tracking-widest"
            style={{ color: '#4A5568', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}
          >
            Agents
          </span>
        </div>
        {AGENT_LIST.map((agent: Agent) => {
          const isActive = agent.id === activeAgent;
          return (
            <button
              key={agent.id}
              onClick={() => {
                onSelect(agent.id);
                onClose?.();
              }}
              className="agent-card w-full text-left px-3 py-2.5 rounded-lg mx-1 my-0.5 flex items-center gap-2.5 group"
              style={{
                width: 'calc(100% - 8px)',
                background: isActive ? agent.accentColor : 'transparent',
                border: isActive ? `1px solid ${agent.color}22` : '1px solid transparent',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>{agent.emoji}</span>
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium truncate leading-tight"
                  style={{
                    color: isActive ? agent.color : '#C9D1D9',
                    fontFamily: 'Syne, sans-serif',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: '0.82rem',
                  }}
                >
                  {agent.name}
                </div>
                <div
                  className="text-xs truncate leading-tight mt-0.5"
                  style={{ color: '#4A5568', fontFamily: 'DM Sans, sans-serif', fontSize: '0.7rem' }}
                >
                  {agent.tagline}
                </div>
              </div>
              {isActive && (
                <ChevronRight size={12} style={{ color: agent.color, opacity: 0.7, flexShrink: 0 }} />
              )}
            </button>
          );
        })}

        <div className="px-3 pt-3 pb-1.5" style={{ borderTop: '1px solid #101723', marginTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span
              className="text-xs uppercase tracking-widest"
              style={{ color: '#4A5568', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}
            >
              Chats
            </span>
            {onNewChat && (
              <button
                onClick={onNewChat}
                style={{
                  padding: '5px 8px',
                  borderRadius: 8,
                  border: '1px solid #1A2332',
                  background: 'rgba(255,255,255,0.03)',
                  color: '#C9D1D9',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.62rem',
                  cursor: 'pointer',
                }}
              >
                New Chat
              </button>
            )}
          </div>
        </div>

        {sessions.length === 0 ? (
          <div style={{ padding: '0 12px 8px', color: '#4A5568', fontFamily: 'DM Sans, sans-serif', fontSize: '0.72rem' }}>
            No saved chats yet.
          </div>
        ) : (
          sessions.map(session => {
            const isActiveSession = session.id === activeSessionId;
            return (
              <button
                key={session.id}
                onClick={() => {
                  onSelectSession?.(session.id);
                  onClose?.();
                }}
                style={{
                  width: 'calc(100% - 8px)',
                  margin: '0 4px 4px',
                  padding: '9px 10px',
                  borderRadius: 10,
                  border: `1px solid ${isActiveSession ? '#243044' : 'transparent'}`,
                  background: isActiveSession ? 'rgba(255,255,255,0.04)' : 'transparent',
                  color: '#C9D1D9',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session.title}
                </div>
                <div style={{ marginTop: 3, color: '#4A5568', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem' }}>
                  {new Date(session.updatedAt).toLocaleDateString()}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid #1A2332' }}>
        <div
          className="flex items-center gap-1.5"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem', color: '#4A5568' }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#00FF9C',
              boxShadow: '0 0 6px rgba(0,255,156,0.8)',
            }}
          />
          <span>llama-3.3-70b-versatile</span>
        </div>
      </div>
    </aside>
  );
}
