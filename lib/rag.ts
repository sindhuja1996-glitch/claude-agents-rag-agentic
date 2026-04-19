// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocumentChunk {
  id: string;
  docId: string;
  docName: string;
  text: string;
  index: number;
}

export interface RAGDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  chunks: DocumentChunk[];
  uploadedAt: number;
}

export interface RetrievedChunk extends DocumentChunk {
  score: number;
}

// ─── Text Extraction ──────────────────────────────────────────────────────────

/** Extract plain text from supported file types */
export async function extractText(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  const textTypes = [
    'txt', 'md', 'mdx', 'ts', 'tsx', 'js', 'jsx', 'py', 'java',
    'go', 'rs', 'cpp', 'c', 'cs', 'rb', 'php', 'swift', 'kt',
    'json', 'yaml', 'yml', 'toml', 'env', 'sh', 'bash', 'sql',
    'html', 'css', 'scss', 'xml', 'csv',
  ];

  if (textTypes.includes(ext) || file.type.startsWith('text/')) {
    return readAsText(file);
  }

  if (ext === 'pdf') {
    // Server-side extraction via API
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/extract-text', { method: 'POST', body: form });
    if (!res.ok) throw new Error('PDF extraction failed');
    const { text } = await res.json();
    return text as string;
  }

  throw new Error(`Unsupported file type: .${ext}`);
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 600;   // target tokens per chunk (approx 4 chars = 1 token)
const CHUNK_OVERLAP = 80; // overlap in chars

export function chunkText(
  text: string,
  docId: string,
  docName: string
): DocumentChunk[] {
  // Normalise whitespace
  const normalised = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  // Split into paragraphs first, then merge into size-bounded chunks
  const paragraphs = normalised.split(/\n\n+/);
  const chunks: DocumentChunk[] = [];
  let buffer = '';
  let chunkIndex = 0;

  const flush = () => {
    const trimmed = buffer.trim();
    if (trimmed.length < 30) return; // skip tiny fragments
    chunks.push({
      id: `${docId}_${chunkIndex}`,
      docId,
      docName,
      text: trimmed,
      index: chunkIndex++,
    });
    // carry overlap forward
    buffer = trimmed.slice(-CHUNK_OVERLAP);
  };

  for (const para of paragraphs) {
    const candidate = buffer ? buffer + '\n\n' + para : para;
    if (candidate.length > CHUNK_SIZE * 4 && buffer) {
      flush();
      buffer = para;
    } else {
      buffer = candidate;
    }
  }
  if (buffer.trim()) flush();

  return chunks;
}

// ─── TF-IDF Retrieval ─────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s_]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const total = tokens.length || 1;
  tf.forEach((v, k) => tf.set(k, v / total));
  return tf;
}

function buildIDF(chunks: DocumentChunk[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const chunk of chunks) {
    const unique = new Set(tokenize(chunk.text));
    unique.forEach(t => df.set(t, (df.get(t) ?? 0) + 1));
  }
  const N = chunks.length;
  const idf = new Map<string, number>();
  df.forEach((count, term) => {
    idf.set(term, Math.log((N + 1) / (count + 1)) + 1);
  });
  return idf;
}

export function retrieveChunks(
  query: string,
  allChunks: DocumentChunk[],
  topK = 5
): RetrievedChunk[] {
  if (allChunks.length === 0) return [];

  const idf = buildIDF(allChunks);
  const queryTokens = tokenize(query);
  const queryTF = termFreq(queryTokens);

  const scored = allChunks.map(chunk => {
    const chunkTokens = tokenize(chunk.text);
    const chunkTF = termFreq(chunkTokens);

    // TF-IDF dot product
    let score = 0;
    queryTF.forEach((qtf, term) => {
      const ctf = chunkTF.get(term) ?? 0;
      const idfVal = idf.get(term) ?? 1;
      score += qtf * ctf * idfVal * idfVal;
    });

    return { ...chunk, score };
  });

  return scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ─── Context Builder ──────────────────────────────────────────────────────────

export function buildRAGContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return '';

  const sections = chunks.map((c, i) =>
    `### [Source ${i + 1}: ${c.docName} — chunk ${c.index + 1}]\n${c.text}`
  );

  return [
    '---',
    '## 📎 Relevant context from your uploaded documents:',
    '',
    sections.join('\n\n'),
    '',
    '---',
    'Use the above context to answer the question. If the context does not contain enough information, say so clearly.',
  ].join('\n');
}

// ─── Unique ID helper ─────────────────────────────────────────────────────────

export function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}
