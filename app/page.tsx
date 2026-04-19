'use client';

import { useState, useCallback } from 'react';
import AgentSidebar from '@/components/AgentSidebar';
import ChatWindow from '@/components/ChatWindow';
import RAGPanel from '@/components/RAGPanel';
import { getAgent, AgentId } from '@/lib/agents';
import { RAGDocument } from '@/lib/rag';
import { PanelRight } from 'lucide-react';

export default function Home() {
  const [activeAgentId, setActiveAgentId] = useState<AgentId>('auto');
  const [messageCount, setMessageCount] = useState(0);
  const [ragDocuments, setRagDocuments] = useState<RAGDocument[]>([]);
  const [showRAG, setShowRAG] = useState(true);

  const activeAgent = getAgent(activeAgentId);

  const handleAgentChange = useCallback((id: AgentId) => {
    setActiveAgentId(id);
    setMessageCount(0);
  }, []);

  return (
    <main style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#080C10', position: 'relative' }}>
      <AgentSidebar
        activeAgent={activeAgentId}
        onSelect={handleAgentChange}
        messageCount={messageCount}
      />
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <button
          onClick={() => setShowRAG(v => !v)}
          title={showRAG ? 'Hide RAG panel' : 'Show RAG panel'}
          style={{
            position: 'absolute', top: 10, right: showRAG ? 268 : 12, zIndex: 10,
            width: 28, height: 28, borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: showRAG ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${showRAG ? 'rgba(0,212,255,0.25)' : '#1A2332'}`,
            color: showRAG ? '#00D4FF' : '#4A5568',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <PanelRight size={13} />
        </button>
        <ChatWindow
          key={activeAgentId}
          agent={activeAgent}
          onMessageCountChange={setMessageCount}
          ragDocuments={ragDocuments}
        />
      </div>
      {showRAG && (
        <RAGPanel
          documents={ragDocuments}
          onDocumentsChange={setRagDocuments}
        />
      )}
    </main>
  );
}
