interface TavilySearchResult {
  title?: string;
  url: string;
  content?: string;
  published_date?: string;
}

interface TavilySearchResponse {
  answer?: string;
  results?: TavilySearchResult[];
}

export interface TavilyContext {
  answer?: string;
  results: TavilySearchResult[];
}

export function hasTavilyConfig(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

export function shouldUseRecentWebSearch(agentId: string, messages: Array<{ role: string; content: string }>): boolean {
  const lastUserMessage = [...messages].reverse().find(message => message.role === 'user')?.content ?? '';
  const text = lastUserMessage.toLowerCase();

  if (agentId === 'realtime-intel') {
    return true;
  }

  const recentSignals = [
    'current affairs',
    'latest',
    'recent',
    'today',
    'tomorrow',
    'yesterday',
    'this week',
    'this month',
    'news',
    'trending',
    'trend',
    'government jobs',
    'govt jobs',
    'job market',
    'stock',
    'stocks',
    'share market',
    'nifty',
    'sensex',
    'sports',
    'match',
    'weather',
    'forecast',
    'international news',
    'breaking',
    'recent questions',
    'latest questions',
  ];

  const isRecentRequest = recentSignals.some(signal => text.includes(signal));

  return isRecentRequest;
}

function detectTavilyTopic(query: string): 'news' | 'general' {
  const text = query.toLowerCase();
  const newsSignals = [
    'latest',
    'recent',
    'today',
    'this week',
    'this month',
    'news',
    'current affairs',
    'government jobs',
    'govt jobs',
    'job market',
    'trending',
    'stock',
    'stocks',
    'share market',
    'nifty',
    'sensex',
    'sports',
    'weather',
    'international',
    'breaking',
  ];

  return newsSignals.some(signal => text.includes(signal)) ? 'news' : 'general';
}

export async function searchRecentWeb(query: string, agentId?: string): Promise<TavilyContext | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;
  const topic = detectTavilyTopic(query);
  const maxResults = agentId === 'realtime-intel' ? 8 : 5;

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      topic,
      search_depth: 'advanced',
      time_range: 'month',
      max_results: maxResults,
      include_answer: 'basic',
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tavily search failed: ${response.status} ${text}`);
  }

  const data = await response.json() as TavilySearchResponse;

  return {
    answer: data.answer,
    results: data.results ?? [],
  };
}

export function buildRecentWebContext(context: TavilyContext, today: string): string {
  const lines = [
    `## Fresh web context fetched on ${today}`,
  ];

  if (context.answer) {
    lines.push('', `Summary: ${context.answer}`);
  }

  if (context.results.length > 0) {
    lines.push('', 'Sources:');
    for (let index = 0; index < context.results.length; index += 1) {
      const result = context.results[index];
      lines.push(
        `${index + 1}. ${result.title ?? 'Untitled source'}`,
        `URL: ${result.url}`,
        result.published_date ? `Published: ${result.published_date}` : '',
        result.content ? `Snippet: ${result.content}` : '',
        '',
      );
    }
  }

  lines.push(
    'Use this context for freshness-sensitive parts of the answer such as latest news, jobs, markets, sports, weather, trends, and real-time events.',
    'Cite source names and dates when making time-sensitive claims.',
    'If the web context is incomplete, say that clearly instead of inventing facts.',
  );

  return lines.filter(Boolean).join('\n');
}
