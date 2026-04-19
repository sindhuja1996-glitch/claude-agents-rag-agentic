# ⚡ Agentic AI Suite

> **10 specialized AI agents for your daily software work** — powered by Groq's blazing-fast inference

A Next.js full-stack application featuring specialized AI agents that act as expert software engineers for every task you face daily.

---

## 🤖 Agents Included

| Agent | Purpose |
|-------|---------|
| ⚡ **Auto Agent** | Orchestrates all agents, handles any request intelligently |
| ✍️ **Code Writer** | Generates production-ready code in any language |
| 🐛 **Bug Fixer** | Diagnoses and fixes bugs with root-cause analysis |
| 🔍 **Code Reviewer** | PR-style reviews: quality, security, performance |
| 📝 **Doc Writer** | READMEs, JSDoc, API docs, changelogs |
| 🗄️ **SQL Master** | Natural language → optimized SQL queries |
| 🌿 **Git Helper** | Commit messages, PR descriptions, branching strategies |
| 🔮 **Regex Wizard** | Creates and explains any regex pattern |
| 🔌 **API Designer** | REST/GraphQL API design and OpenAPI specs |
| ⚡ **Perf Optimizer** | Find bottlenecks, reduce complexity, speed up code |
| 🛡️ **Security Scanner** | OWASP vulnerabilities, secure coding patterns |

---

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd agentic-ai-suite
npm install
```

### 2. Get a Free Groq API Key

1. Go to [https://console.groq.com](https://console.groq.com)
2. Sign up (free) and create an API key
3. It's free and very fast!

### 3. Set Up Environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```env
GROQ_API_KEY=gsk_your_actual_key_here
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 🏗️ Architecture

```
agentic-ai-suite/
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # Streaming chat API (SSE)
│   │   └── agents/route.ts    # Agent list API
│   ├── layout.tsx             # Root layout with fonts
│   ├── page.tsx               # Main page
│   └── globals.css            # Terminal dark theme
├── components/
│   ├── AgentSidebar.tsx       # Agent selection sidebar
│   ├── ChatWindow.tsx         # Main chat UI + streaming
│   └── MessageBubble.tsx      # Message renderer + syntax highlighting
└── lib/
    ├── agents.ts              # Agent definitions + system prompts
    └── groq.ts                # Groq client
```

### How Streaming Works

1. User sends message → `POST /api/chat`
2. Server calls Groq API with agent's system prompt + conversation history
3. Response streams back via **Server-Sent Events (SSE)**
4. Frontend reads the stream and updates UI in real-time
5. Full message stored in state when stream completes

---

## 🔧 Customizing Agents

Add or modify agents in `lib/agents.ts`:

```typescript
'my-agent': {
  id: 'my-agent',
  name: 'My Custom Agent',
  emoji: '🚀',
  tagline: 'Does amazing things',
  description: 'Full description here',
  color: '#00FF9C',
  accentColor: 'rgba(0,255,156,0.12)',
  model: 'llama-3.3-70b-versatile',
  examples: ['Example prompt 1', 'Example prompt 2'],
  systemPrompt: `You are an expert in...`,
},
```

## 📦 Tech Stack

- **Next.js 14** (App Router) — Framework
- **Groq SDK** — Ultra-fast LLM inference
- **llama-3.3-70b-versatile** — The AI model
- **TailwindCSS** — Styling
- **React Markdown + Syntax Highlighter** — Beautiful code rendering
- **JetBrains Mono + Syne** — Developer-focused typography

## 🌟 Features

- ⚡ **Real-time streaming** — See responses as they generate
- 🎨 **Syntax highlighting** — 100+ languages supported
- 📋 **One-click copy** — Copy any code block instantly
- 💬 **Conversation memory** — Full context within each session
- 🔄 **Agent switching** — Switch agents, start fresh automatically
- 📱 **Keyboard shortcuts** — Enter to send, Shift+Enter for newline

---

Built with ❤️ for developers who want AI superpowers in their daily work.
