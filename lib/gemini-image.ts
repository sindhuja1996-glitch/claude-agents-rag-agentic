import { GoogleGenAI } from '@google/genai';
import { ChatMessage, GeneratedImage } from '@/lib/image-chat';

const IMAGE_MODELS = [
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
  'gemini-2.5-flash-image',
] as const;

interface ImageAttempt {
  model: string;
  message: string;
  rateLimited: boolean;
}

export class GeminiImageFallbackError extends Error {
  attempts: ImageAttempt[];
  status: number;

  constructor(message: string, attempts: ImageAttempt[], status = 500) {
    super(message);
    this.name = 'GeminiImageFallbackError';
    this.attempts = attempts;
    this.status = status;
  }
}

let imageClient: GoogleGenAI | null = null;

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY or GOOGLE_API_KEY environment variable is not set.');
  }

  return apiKey;
}

function getImageClient(): GoogleGenAI {
  if (!imageClient) {
    imageClient = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  }

  return imageClient;
}

function dataUrlToBase64(dataUrl: string): string {
  const parts = dataUrl.split(',');
  return parts[1] ?? '';
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const maybeStatus = 'status' in error ? (error as { status?: number }).status : undefined;
  const maybeCode = 'code' in error ? Number((error as { code?: number | string }).code) : undefined;
  const maybeMessage = 'message' in error ? String((error as { message?: string }).message ?? '').toLowerCase() : '';

  return (
    maybeStatus === 429 ||
    maybeCode === 429 ||
    maybeMessage.includes('quota exceeded') ||
    maybeMessage.includes('rate limit') ||
    maybeMessage.includes('resource exhausted')
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function buildHistoryText(messages: ChatMessage[]): string {
  return messages
    .slice(-8)
    .map(message => {
      const header = message.role === 'assistant' ? '[ASSISTANT]' : '[USER]';
      const attachmentLine = message.attachments?.length
        ? `\nAttached images: ${message.attachments.map(file => file.name).join(', ')}`
        : '';

      return `${header}\n${message.content.trim() || '(no text provided)'}${attachmentLine}`;
    })
    .join('\n\n');
}

function buildPrompt(messages: ChatMessage[]): string {
  const lastUserMessage = [...messages].reverse().find(message => message.role === 'user');

  return [
    'You are Nano Banana Studio, a production-grade Gemini image assistant.',
    'You can generate new images, edit attached images, and describe attached images.',
    'If the user asks for an edit, preserve the subject identity and only change what was requested.',
    'If the user asks for a description, provide a useful concise description in text and do not invent details.',
    'If the user asks for generation, return the best possible image plus a short textual summary.',
    '',
    'Conversation context:',
    buildHistoryText(messages),
    '',
    'Current user request:',
    lastUserMessage?.content?.trim() || 'Describe the attached image.',
  ].join('\n');
}

export async function generateImageResponse(messages: ChatMessage[]): Promise<{
  text: string;
  images: GeneratedImage[];
  model: string;
  fallbackUsed: boolean;
  attemptedModels: string[];
}> {
  const client = getImageClient();
  const lastUserMessage = [...messages].reverse().find(message => message.role === 'user');
  const attachments = lastUserMessage?.attachments ?? [];
  const contents: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: buildPrompt(messages) },
    ...attachments.map(file => ({
      inlineData: {
        mimeType: file.mimeType,
        data: dataUrlToBase64(file.dataUrl),
      },
    })),
  ];

  const attempts: ImageAttempt[] = [];

  for (const [index, model] of IMAGE_MODELS.entries()) {
    try {
      const response = await client.models.generateContent({
        model,
        contents,
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .map(part => ('text' in part ? part.text : ''))
        .filter(Boolean)
        .join('\n')
        .trim();

      const images = parts
        .filter(part => 'inlineData' in part && Boolean(part.inlineData?.data))
        .map(part => ({
          mimeType: part.inlineData?.mimeType || 'image/png',
          dataUrl: `data:${part.inlineData?.mimeType || 'image/png'};base64,${part.inlineData?.data}`,
          model,
        }));

      if (!text && images.length === 0) {
        throw new Error(`Model ${model} returned no text or image parts.`);
      }

      return {
        text: text || 'Image generated successfully.',
        images,
        model,
        fallbackUsed: index > 0,
        attemptedModels: [...attempts.map(attempt => attempt.model), model],
      };
    } catch (error) {
      attempts.push({
        model,
        message: getErrorMessage(error),
        rateLimited: isRateLimitError(error),
      });
    }
  }

  const attemptedModels = attempts.map(attempt => attempt.model).join(' -> ');
  const allRateLimited = attempts.length > 0 && attempts.every(attempt => attempt.rateLimited);
  const detail = attempts
    .map(attempt => `${attempt.model}: ${attempt.message}`)
    .join(' | ');

  throw new GeminiImageFallbackError(
    `All Gemini image models failed. Attempted: ${attemptedModels}. ${detail}`,
    attempts,
    allRateLimited ? 429 : 500,
  );
}
