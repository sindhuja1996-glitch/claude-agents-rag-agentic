'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, Database, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { RAGDocument, extractText, chunkText, genId } from '@/lib/rag';

interface RAGPanelProps {
  documents: RAGDocument[];
  onDocumentsChange: (docs: RAGDocument[]) => void;
}

type UploadStatus = 'idle' | 'processing' | 'done' | 'error';

interface FileState {
  name: string;
  status: UploadStatus;
  error?: string;
}

const ACCEPTED = '.txt,.md,.mdx,.ts,.tsx,.js,.jsx,.py,.java,.go,.rs,.cpp,.c,.cs,.rb,.php,.swift,.kt,.json,.yaml,.yml,.toml,.sh,.sql,.html,.css,.pdf,.csv';

export default function RAGPanel({ documents, onDocumentsChange }: RAGPanelProps) {
  const [fileStates, setFileStates] = useState<FileState[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalChunks = documents.reduce((s, d) => s + d.chunks.length, 0);

  const processFiles = useCallback(async (files: File[]) => {
    const newStates: FileState[] = files.map(f => ({ name: f.name, status: 'processing' }));
    setFileStates(prev => [...prev, ...newStates]);

    const newDocs: RAGDocument[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await extractText(file);
        const docId = genId();
        const chunks = chunkText(text, docId, file.name);

        newDocs.push({
          id: docId,
          name: file.name,
          type: file.type || 'text/plain',
          size: file.size,
          chunks,
          uploadedAt: Date.now(),
        });

        setFileStates(prev =>
          prev.map((s, idx) =>
            s.name === file.name && s.status === 'processing'
              ? { ...s, status: 'done' }
              : s
          )
        );
      } catch (err) {
        setFileStates(prev =>
          prev.map(s =>
            s.name === file.name && s.status === 'processing'
              ? { ...s, status: 'error', error: err instanceof Error ? err.message : 'Failed' }
              : s
          )
        );
      }
    }

    if (newDocs.length > 0) {
      onDocumentsChange([...documents, ...newDocs]);
    }

    // Clear done states after 3s
    setTimeout(() => {
      setFileStates(prev => prev.filter(s => s.status !== 'done'));
    }, 3000);
  }, [documents, onDocumentsChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) processFiles(files);
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) processFiles(files);
    e.target.value = '';
  }, [processFiles]);

  const removeDoc = useCallback((id: string) => {
    onDocumentsChange(documents.filter(d => d.id !== id));
  }, [documents, onDocumentsChange]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = {
      pdf: '📄', py: '🐍', ts: '📘', tsx: '📘', js: '📙', jsx: '📙',
      json: '🔧', md: '📝', sql: '🗄️', go: '🐹', rs: '🦀', java: '☕',
      html: '🌐', css: '🎨', yaml: '⚙️', yml: '⚙️', sh: '💻',
    };
    return map[ext] ?? '📄';
  };

  return (
    <div
      style={{
        width: 260,
        minWidth: 260,
        background: '#080C10',
        borderLeft: '1px solid #1A2332',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #1A2332',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Database size={14} style={{ color: '#00D4FF' }} />
        </div>
        <div>
          <div style={{ color: '#E6EDF3', fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.82rem' }}>
            RAG Context
          </div>
          <div style={{ color: '#4A5568', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>
            {totalChunks} chunks · {documents.length} files
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div style={{ padding: '12px 12px 8px' }}>
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          style={{
            border: `2px dashed ${isDragging ? '#00D4FF' : '#1A2332'}`,
            borderRadius: 10,
            padding: '14px 10px',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(0,212,255,0.05)' : 'rgba(255,255,255,0.01)',
            transition: 'all 0.15s',
          }}
        >
          <Upload size={18} style={{ color: isDragging ? '#00D4FF' : '#4A5568', margin: '0 auto 6px' }} />
          <div style={{ color: '#8B949E', fontFamily: 'DM Sans, sans-serif', fontSize: '0.75rem', lineHeight: 1.4 }}>
            Drop files or <span style={{ color: '#00D4FF' }}>click to upload</span>
          </div>
          <div style={{ color: '#4A5568', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.58rem', marginTop: 4 }}>
            PDF · TXT · MD · TS · PY · JSON · SQL…
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED}
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />
      </div>

      {/* Upload states */}
      {fileStates.length > 0 && (
        <div style={{ padding: '0 12px 8px' }}>
          {fileStates.map((fs, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 8px',
                borderRadius: 6,
                background: fs.status === 'error' ? 'rgba(255,69,96,0.07)' : 'rgba(0,255,156,0.05)',
                border: `1px solid ${fs.status === 'error' ? 'rgba(255,69,96,0.2)' : 'rgba(0,255,156,0.15)'}`,
                marginBottom: 4,
              }}
            >
              {fs.status === 'processing' && (
                <Loader size={11} style={{ color: '#00FF9C', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              )}
              {fs.status === 'done' && <CheckCircle size={11} style={{ color: '#00FF9C', flexShrink: 0 }} />}
              {fs.status === 'error' && <AlertCircle size={11} style={{ color: '#FF4560', flexShrink: 0 }} />}
              <span style={{
                color: fs.status === 'error' ? '#FF4560' : '#8B949E',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.65rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {fs.error ?? fs.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Document list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {documents.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '24px 8px',
            color: '#2D3748', fontFamily: 'DM Sans, sans-serif', fontSize: '0.75rem',
          }}>
            No documents yet.<br />Upload files to give the AI context from your codebase or docs.
          </div>
        ) : (
          documents.map(doc => (
            <div
              key={doc.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid #1A2332',
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{getFileIcon(doc.name)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: '#C9D1D9', fontFamily: 'DM Sans, sans-serif',
                  fontSize: '0.75rem', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {doc.name}
                </div>
                <div style={{ color: '#4A5568', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem', marginTop: 2 }}>
                  {doc.chunks.length} chunks · {formatSize(doc.size)}
                </div>
              </div>
              <button
                onClick={() => removeDoc(doc.id)}
                style={{
                  flexShrink: 0, width: 18, height: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 4,
                  background: 'transparent',
                  border: 'none',
                  color: '#4A5568',
                  cursor: 'pointer',
                  transition: 'color 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#FF4560')}
                onMouseLeave={e => (e.currentTarget.style.color = '#4A5568')}
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* RAG active indicator */}
      {documents.length > 0 && (
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #1A2332',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#00D4FF',
            boxShadow: '0 0 6px rgba(0,212,255,0.8)',
          }} />
          <span style={{ color: '#4A5568', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.6rem' }}>
            RAG active — context injected
          </span>
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
