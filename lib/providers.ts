export type ProviderId = 'groq' | 'openai' | 'openai-compatible';

export interface ProviderSettings {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
}

export type ProviderSettingsMap = Record<ProviderId, ProviderSettings>;

export const DEFAULT_PROVIDER: ProviderId = 'groq';

export const PROVIDERS: Record<
  ProviderId,
  {
    label: string;
    defaultBaseUrl: string;
    requiresKey: boolean;
    defaultModel: string;
  }
> = {
  groq: {
    label: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai',
    requiresKey: true,
    defaultModel: 'deepseek-r1-distill-llama-70b'
  },
  openai: {
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com',
    requiresKey: true,
    defaultModel: 'gpt-4o-mini'
  },
  'openai-compatible': {
    label: 'OpenAI-compatible (Local)',
    defaultBaseUrl: 'http://localhost:11434',
    requiresKey: false,
    defaultModel: 'llama3.1'
  }
};

export function getProviderBaseUrl(
  providerId: ProviderId,
  settings?: ProviderSettingsMap
): string {
  return settings?.[providerId]?.baseUrl?.trim() || PROVIDERS[providerId].defaultBaseUrl;
}

export function getProviderModel(
  providerId: ProviderId,
  settings?: ProviderSettingsMap
): string {
  return settings?.[providerId]?.model?.trim() || PROVIDERS[providerId].defaultModel;
}
