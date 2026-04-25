import { NextRequest, NextResponse } from 'next/server';
import { getGroqClient } from '@/lib/groq';
import { getAgent, AgentId } from '@/lib/agents';
import { generateWithGemini, hasGeminiConfig, isRateLimitError } from '@/lib/gemini';
import {
  buildRecentWebContext,
  hasTavilyConfig,
  searchRecentWeb,
  shouldUseRecentWebSearch,
} from '@/lib/tavily';

export const runtime = 'nodejs';
export const maxDuration = 60;

function createSSETextResponse(text: string) {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { messages, agentId } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const agent = getAgent(agentId as AgentId);
    const groq = getGroqClient();
    const today = new Date().toISOString().slice(0, 10);
    const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: agent.systemPrompt },
    ];

    const typedMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    if (hasTavilyConfig() && shouldUseRecentWebSearch(agent.id, messages)) {
      const lastUserMessage = [...messages].reverse().find((message: { role: string; content: string }) => message.role === 'user')?.content;

      if (lastUserMessage) {
        try {
          const webContext = await searchRecentWeb(lastUserMessage, agent.id);
          if (webContext && webContext.results.length > 0) {
            chatMessages.push({
              role: 'system',
              content: buildRecentWebContext(webContext, today),
            });
          }
        } catch (searchError) {
          console.error('Tavily search error:', searchError);
        }
      }
    }

    let stream;

    try {
      stream = await groq.chat.completions.create({
        model: agent.model,
        messages: [...chatMessages, ...typedMessages],
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
        top_p: 0.9,
      });
    } catch (error) {
      if (isRateLimitError(error) && hasGeminiConfig()) {
        console.warn('Groq rate-limited. Falling back to Gemini for this request.');
        const fallbackText = await generateWithGemini([...chatMessages, ...typedMessages]);
        return createSSETextResponse(fallbackText);
      }
      throw error;
    }

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              const data = `data: ${JSON.stringify({ text: delta })}\n\n`;
              controller.enqueue(encoder.encode(data));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: unknown) {
    console.error('Chat API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
