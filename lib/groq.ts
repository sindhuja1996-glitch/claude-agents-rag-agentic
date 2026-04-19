import Groq from 'groq-sdk';

let groqClient: Groq | null = null;

export function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is not set. Get your free key at https://console.groq.com');
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export const GROQ_MODELS = {
  fast: 'llama-3.1-8b-instant',
  balanced: 'llama-3.3-70b-versatile',
  powerful: 'llama-3.3-70b-versatile',
  coding: 'llama-3.3-70b-versatile',
} as const;
