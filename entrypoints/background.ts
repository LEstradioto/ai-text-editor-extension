import { storage } from '#imports';
import { callChatCompletion, fetchModels, type ChatMessage, type LlmModel } from '../lib/llm';
import { ACTION_PROMPTS, SYSTEM_PROMPTS, type Action } from '../lib/prompts';
import {
  DEFAULT_PROVIDER,
  PROVIDERS,
  getProviderBaseUrl,
  getProviderModel,
  type ProviderId,
  type ProviderSettingsMap
} from '../lib/providers';

type StoredAction = Action | 'custom';

interface CustomPrompt {
  text: string;
  type: 'system' | 'context';
}

function isRestrictedUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('moz-extension://')
  );
}

async function showBadge(tabId: number, text: string, color = '#d14343'): Promise<void> {
  try {
    await browser.action.setBadgeText({ tabId, text });
    await browser.action.setBadgeBackgroundColor({ tabId, color });
    setTimeout(() => {
      browser.action.setBadgeText({ tabId, text: '' }).catch(() => null);
    }, 2500);
  } catch (err) {
    console.error('Failed to set badge', err);
  }
}

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    await browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ['content-scripts/content.js']
    });
    return true;
  } catch (err) {
    console.error('Failed to inject content script', err);
    await showBadge(tabId, 'N/A', '#444');
    return false;
  }
}

async function safeSendMessage<T>(
  tabId: number,
  message: Record<string, unknown>,
  attempt = 0,
  frameId?: number
): Promise<T | null> {
  try {
    return await browser.tabs.sendMessage(tabId, message, frameId !== undefined ? { frameId } : undefined);
  } catch (err: any) {
    const errMsg = String(err?.message || err);
    if (String(err?.message || err).includes('Receiving end does not exist')) {
      if (attempt === 0 && (await ensureContentScript(tabId))) {
        return await safeSendMessage<T>(tabId, message, 1, frameId);
      }
      await showBadge(tabId, 'N/A', '#444');
      return null;
    }
    if (errMsg.includes('message channel closed')) {
      return null;
    }
    throw err;
  }
}

async function findBestFrame(tabId: number): Promise<number | null> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const active = document.activeElement;
        const hasInput =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement;
        const hasContentEditable =
          active instanceof HTMLElement && active.isContentEditable;
        const selection = window.getSelection?.()?.toString() ?? '';
        const hasSelection = selection.trim().length > 0;
        const hasFocus = document.hasFocus();

        let score = 0;
        if (hasInput || hasContentEditable) score += 3;
        if (hasSelection) score += 2;
        if (hasFocus) score += 1;

        return { score };
      }
    });

    const best = results
      .map((result) => ({
        frameId: result.frameId,
        score: result.result?.score ?? 0
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (!best || best.score === 0) {
      return null;
    }

    return best.frameId;
  } catch (err) {
    console.error('Failed to probe frames', err);
    return null;
  }
}

async function getBestTextCandidate(tabId: number): Promise<{ text: string; frameId: number } | null> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => {
        const selection = window.getSelection?.()?.toString() ?? '';
        const active = document.activeElement;

        let text = '';
        let score = 0;

        if (selection.trim()) {
          text = selection;
          score = 100 + selection.length;
        } else if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
          text = active.value ?? '';
          score = 50 + text.length;
        } else if (active instanceof HTMLElement && active.isContentEditable) {
          text = active.innerText ?? '';
          score = 50 + text.length;
        }

        return { text, score };
      }
    });

    const best = results
      .map((result) => ({
        frameId: result.frameId,
        text: result.result?.text ?? '',
        score: result.result?.score ?? 0
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (!best || !best.text.trim()) {
      return null;
    }

    return { text: best.text, frameId: best.frameId };
  } catch (err) {
    console.error('Failed to get text candidate', err);
    return null;
  }
}

async function copyTextToClipboard(tabId: number, frameId: number, text: string): Promise<boolean> {
  try {
    const [{ result }] = await browser.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      args: [text],
      func: (value: string) => {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const ok = document.execCommand('copy');
        textarea.remove();
        return ok;
      }
    });
    return Boolean(result);
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}

async function getActiveProviderConfig(): Promise<{
  providerId: ProviderId;
  baseUrl: string;
  apiKey?: string;
  model: string;
}> {
  const [activeProvider, providerSettings, legacyGroqApiKey, legacySelectedModel] = await Promise.all([
    storage.getItem<ProviderId>('sync:activeProvider'),
    storage.getItem<ProviderSettingsMap>('sync:providerSettings'),
    storage.getItem<string>('sync:groqApiKey'),
    storage.getItem<string>('sync:selectedModel')
  ]);

  const settings: ProviderSettingsMap =
    providerSettings ?? { groq: {}, openai: {}, 'openai-compatible': {} };

  if (!providerSettings && (legacyGroqApiKey || legacySelectedModel)) {
    settings.groq = {
      apiKey: legacyGroqApiKey ?? '',
      model: legacySelectedModel ?? ''
    };
    await storage.setItem('sync:providerSettings', settings);
    await storage.setItem('sync:activeProvider', 'groq');
  }

  const providerId = (activeProvider ?? DEFAULT_PROVIDER) as ProviderId;

  return {
    providerId,
    baseUrl: getProviderBaseUrl(providerId, settings),
    apiKey: settings[providerId]?.apiKey?.trim(),
    model: getProviderModel(providerId, settings)
  };
}

async function buildMessagesForAction(text: string): Promise<{ messages: ChatMessage[]; temperature: number }> {
  const [lastAction, customPrompts, lastCustomPromptName] = await Promise.all([
    storage.getItem<StoredAction>('sync:lastAction'),
    storage.getItem<Record<string, CustomPrompt>>('sync:customPrompts'),
    storage.getItem<string>('sync:lastCustomPromptName')
  ]);

  if (lastAction === 'custom' && lastCustomPromptName && customPrompts?.[lastCustomPromptName]) {
    const promptData = customPrompts[lastCustomPromptName];
    if (promptData.type === 'system') {
      return {
        messages: [
          { role: 'system', content: promptData.text },
          { role: 'user', content: text }
        ],
        temperature: 0.7
      };
    }
    return {
      messages: [
        {
          role: 'user',
          content: `Context: ${promptData.text}\n\n${text}`
        }
      ],
      temperature: 0.7
    };
  }

  const action = (lastAction ?? 'fix-grammar') as Action;
  const systemPrompt = SYSTEM_PROMPTS[action] ?? SYSTEM_PROMPTS['fix-grammar'];
  const actionPrompt = ACTION_PROMPTS[action] ?? ACTION_PROMPTS['fix-grammar'];
  const temperature = action === 'fix-grammar' ? 0 : 0.7;

  return {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${actionPrompt}\n\n${text}` }
    ],
    temperature
  };
}

async function updateModels(): Promise<void> {
  try {
    const { providerId, baseUrl, apiKey } = await getActiveProviderConfig();
    if (PROVIDERS[providerId].requiresKey && !apiKey) {
      return;
    }

    const models = await fetchModels(baseUrl, apiKey);
    const modelsByProvider =
      (await storage.getItem<Record<ProviderId, LlmModel[]>>('local:modelsByProvider')) ?? {};
    modelsByProvider[providerId] = models;
    await storage.setItem('local:modelsByProvider', modelsByProvider);
    console.log(`${PROVIDERS[providerId].label} models updated:`, models.length);
  } catch (err) {
    console.error('Error updating models', err);
  }
}

async function runInlineFix(): Promise<void> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    return;
  }
  if (isRestrictedUrl(tab.url)) {
    await showBadge(tab.id, 'N/A', '#444');
    return;
  }

  try {
    const autoOpenPopup = (await storage.getItem<boolean>('sync:autoOpenPopup')) ?? true;
    if (autoOpenPopup) {
      try {
        const lastWindow = await browser.windows.getLastFocused().catch(() => null);
        if (lastWindow?.id !== undefined) {
          await browser.action.openPopup();
        }
      } catch (err) {
        console.error('Failed to open popup', err);
      }
    }

    await showBadge(tab.id, '...', '#4a6bff');

    let selection = null as { selectionId: string; text: string } | null;
    let targetFrameId: number | undefined = undefined;

    const frames = await browser.webNavigation.getAllFrames({ tabId: tab.id });
    for (const frame of frames) {
      const candidate = await safeSendMessage<{ selectionId: string; text: string } | null>(
        tab.id,
        {
          action: 'getEditableSelection'
        },
        0,
        frame.frameId
      );
      if (candidate?.selectionId) {
        selection = candidate;
        targetFrameId = frame.frameId;
        break;
      }
    }

    if (!selection) {
      const frameId = await findBestFrame(tab.id);
      if (frameId !== null) {
        selection = await safeSendMessage<{ selectionId: string; text: string } | null>(
          tab.id,
          {
            action: 'getEditableSelection'
          },
          0,
          frameId
        );
        targetFrameId = frameId;
      }
    }

    if (!selection) {
      selection = await safeSendMessage<{ selectionId: string; text: string } | null>(
        tab.id,
        {
          action: 'getEditableSelection'
        }
      );
    }

    if (!selection) {
      const candidate = await getBestTextCandidate(tab.id);
      if (!candidate) {
        await showBadge(tab.id, 'NO', '#444');
        return;
      }
      const { providerId, baseUrl, apiKey, model } = await getActiveProviderConfig();
      if (PROVIDERS[providerId].requiresKey && !apiKey) {
        await showBadge(tab.id, 'KEY', '#d14343');
        return;
      }
      const { messages, temperature } = await buildMessagesForAction(candidate.text);
      const result = await callChatCompletion({
        baseUrl,
        apiKey,
        model,
        messages,
        temperature
      });
      await storage.setItem('local:lastResultText', result);
      const autoCopy = (await storage.getItem<boolean>('sync:autoCopyResult')) ?? true;
      const copied = autoCopy
        ? await copyTextToClipboard(tab.id, candidate.frameId, result)
        : false;
      if (copied) {
        await safeSendMessage(tab.id, { action: 'selectAllInEditable' }, 0, candidate.frameId);
        await safeSendMessage(tab.id, {
          action: 'showInlineToast',
          message: 'Copied. Paste to replace.'
        }, 0, candidate.frameId);
      }
      await showBadge(tab.id, copied ? 'CP' : 'ERR', copied ? '#2e7d32' : '#d14343');
      return;
    }

    if (!selection?.selectionId) {
      await safeSendMessage(tab.id, {
        action: 'showInlineToast',
        message: 'Select text or focus an editable field first.'
      }, 0, targetFrameId);
      await showBadge(tab.id, 'NO', '#444');
      return;
    }

    if (selection.text === '') {
      await safeSendMessage(tab.id, {
        action: 'showInlineToast',
        message: 'Editable field is empty.'
      }, 0, targetFrameId);
      await showBadge(tab.id, 'NO', '#444');
      return;
    }

    const { providerId, baseUrl, apiKey, model } = await getActiveProviderConfig();
    if (PROVIDERS[providerId].requiresKey && !apiKey) {
      await safeSendMessage(tab.id, {
        action: 'showInlineToast',
        message: `Missing ${PROVIDERS[providerId].label} API key in settings.`
      }, 0, targetFrameId);
      await showBadge(tab.id, 'KEY', '#d14343');
      return;
    }

    const { messages, temperature } = await buildMessagesForAction(selection.text);
    const result = await callChatCompletion({
      baseUrl,
      apiKey,
      model,
      messages,
      temperature
    });
    await storage.setItem('local:lastResultText', result);

    await safeSendMessage(tab.id, {
      action: 'applyReplacement',
      selectionId: selection.selectionId,
      text: result
    }, 0, targetFrameId);
    const autoCopy = (await storage.getItem<boolean>('sync:autoCopyResult')) ?? true;
    if (autoCopy && targetFrameId !== undefined) {
      await copyTextToClipboard(tab.id, targetFrameId, result);
    }
    await showBadge(tab.id, 'OK', '#2e7d32');
  } catch (err: any) {
    console.error('Inline fix error', err);
    try {
      if (tab?.id) {
        await safeSendMessage(tab.id, {
          action: 'showInlineToast',
          message: err?.message || 'Failed to fix text.'
        });
      }
      if (tab?.id) {
        await showBadge(tab.id, 'ERR', '#d14343');
      }
    } catch (sendErr) {
      console.error('Failed to send error toast', sendErr);
    }
  }
}

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async (message) => {
    if (message?.action === 'updateModels') {
      await updateModels();
    }
  });

  browser.commands.onCommand.addListener(async (command) => {
    if (command === 'fix-grammar-inline') {
      await runInlineFix();
    }
  });
});
