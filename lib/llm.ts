export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmRequest {
  baseUrl: string;
  apiKey?: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmModel {
  id: string;
  owner?: string;
}

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('Base URL is required');
  }
  if (trimmed.endsWith('/v1')) {
    return trimmed;
  }
  return `${trimmed}/v1`;
}

function buildHeaders(apiKey?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

export async function callChatCompletion(request: LlmRequest): Promise<string> {
  const url = `${normalizeBaseUrl(request.baseUrl)}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(request.apiKey),
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2048
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API request failed (${response.status})`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from model');
  }
  return content;
}

export async function fetchModels(baseUrl: string, apiKey?: string): Promise<LlmModel[]> {
  const url = `${normalizeBaseUrl(baseUrl)}/models`;
  const response = await fetch(url, {
    headers: buildHeaders(apiKey)
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models (${response.status})`);
  }

  const data = await response.json();
  const models = (data?.data ?? data?.models ?? []) as LlmModel[];
  return Array.isArray(models) ? models : [];
}
