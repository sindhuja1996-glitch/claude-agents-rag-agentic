import { GoogleGenAI } from '@google/genai';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface InteractionOutput {
  text?: string;
}

const DEFAULT_GEMINI_MODEL = 'gemini-3-flash-preview';

let geminiClient: GoogleGenAI | null = null;

export function hasGeminiConfig(): boolean {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
}

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY environment variable is not set.');
  }
  return apiKey;
}

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  }

  return geminiClient;
}

export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeStatus = 'status' in error ? (error as { status?: number }).status : undefined;
  const maybeCode = 'code' in error ? Number((error as { code?: number | string }).code) : undefined;
  const maybeMessage = 'message' in error ? String((error as { message?: string }).message ?? '').toLowerCase() : '';

  return (
    maybeStatus === 429 ||
    maybeCode === 429 ||
    maybeMessage.includes('rate limit') ||
    maybeMessage.includes('too many requests') ||
    maybeMessage.includes('resource exhausted')
  );
}

function buildGeminiInput(messages: ChatMessage[]): string {
  return messages
    .map(message => {
      if (message.role === 'system') {
        return `[SYSTEM]\n${message.content.trim()}`;
      }

      if (message.role === 'assistant') {
        return `[ASSISTANT]\n${message.content.trim()}`;
      }

      return `[USER]\n${message.content.trim()}`;
    })
    .filter(Boolean)
    .join('\n\n');
}

export async function generateWithGemini(messages: ChatMessage[]): Promise<string> {
  const client = getGeminiClient();
  const interaction = await client.interactions.create({
    model: getGeminiModel(),
    input: buildGeminiInput(messages),
  });

  const outputs = (interaction.outputs ?? []) as InteractionOutput[];
  const text = [...outputs]
    .reverse()
    .map(output => output.text?.trim())
    .find(Boolean);

  if (!text) {
    throw new Error('Gemini returned an empty response.');
  }

  return text;
}
