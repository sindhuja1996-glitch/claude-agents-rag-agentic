import { NextRequest, NextResponse } from 'next/server';
import { getAgent, AgentId } from '@/lib/agents';
import { GeminiImageFallbackError, generateImageResponse } from '@/lib/gemini-image';
import { ChatMessage } from '@/lib/image-chat';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { messages, agentId } = await req.json() as {
      messages?: ChatMessage[];
      agentId?: string;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const agent = getAgent((agentId || 'auto') as AgentId);
    if (agent.id !== 'nano-banana-studio') {
      return NextResponse.json({ error: 'Image route only supports Nano Banana Studio.' }, { status: 400 });
    }

    const result = await generateImageResponse(messages);

    return NextResponse.json({
      text: result.text,
      images: result.images,
      meta: {
        model: result.model,
        fallbackUsed: result.fallbackUsed,
        attemptedModels: result.attemptedModels,
      },
    });
  } catch (error) {
    console.error('Image chat API error:', error);
    if (error instanceof GeminiImageFallbackError) {
      return NextResponse.json({
        error: error.message,
        attempts: error.attempts,
      }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : 'Image generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
