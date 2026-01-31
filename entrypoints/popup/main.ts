import './style.css';
import { storage } from '#imports';
import {
  callChatCompletion,
  fetchModels,
  type ChatMessage,
  type LlmModel
} from '../../lib/llm';
import {
  DEFAULT_PROVIDER,
  PROVIDERS,
  getProviderBaseUrl,
  getProviderModel,
  type ProviderId,
  type ProviderSettingsMap
} from '../../lib/providers';
import { ACTION_PROMPTS, SYSTEM_PROMPTS, type Action } from '../../lib/prompts';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <h1>AI Text Editor</h1>
    <div class="config-section">
      <details>
        <summary>API & Model Settings</summary>
        <select id="provider">
          <option value="groq">Groq</option>
          <option value="openai">OpenAI</option>
          <option value="openai-compatible">OpenAI-compatible (Local)</option>
        </select>
        <input type="text" id="baseUrl" placeholder="Base URL (https://.../v1)">
        <div class="field-error" id="baseUrlError"></div>
        <input type="password" id="apiKey" placeholder="API Key (not required for local)">
        <div class="field-error" id="apiKeyError"></div>
        <select id="modelSelect"></select>
        <input type="text" id="modelInput" placeholder="Custom model ID">
        <div class="field-error" id="modelError"></div>
        <div class="behavior-settings">
          <label>
            <input type="checkbox" id="autoOpenPopup">
            Auto-open popup on shortcut
          </label>
          <label>
            <input type="checkbox" id="autoCopyResult">
            Auto-copy results
          </label>
        </div>
        <div class="settings-status" id="settingsStatus"></div>
        <button id="saveSettings">Save Settings</button>
      </details>
    </div>
    <div class="custom-prompt">
      <div class="direct-input">
        <label>
          <input type="checkbox" id="useAsInput">
          Use direct input (no selection needed)
        </label>
        <textarea id="directInputText" placeholder="Enter text to process directly" class=""></textarea>
      </div>
      <div class="prompt-controls">
        <select id="savedPromptsSelect">
          <option value="">Select a saved prompt...</option>
        </select>
        <button id="useSelectedPrompt">Use</button>
        <button class="manage-prompts-button" id="managePrompts">Manage Prompts</button>
      </div>
    </div>
    <div class="buttons">
      <button id="fix-grammar">Fix Typos Only</button>
      <button id="improve">Improve Writing</button>
      <button id="professional">Make Professional</button>
      <button id="simplify">Simplify</button>
      <button id="summarize">Summarize</button>
      <button id="expand">Expand</button>
      <button id="bullets">To Bullets</button>
      <button id="better-way">Better Way of Saying</button>
      <button id="explain">Explain</button>
      <button id="tweet">Tweet</button>
      <button id="variations">Generate 3 Variations</button>
    </div>
    <div class="result-container">
      <div class="result-title">Results:</div>
      <div id="result"></div>
      <div class="result-actions">
        <button id="copyResult" class="secondary">Copy</button>
        <button id="replaceResult" class="secondary">Replace Selection</button>
      </div>
    </div>
    <div class="custom-prompts">
      <h3>Manage Custom Prompts</h3>
      <div id="savedPrompts"></div>
      <div class="prompt-form">
        <input type="text" id="newPromptName" placeholder="Prompt name">
        <textarea id="newPromptText" placeholder="Prompt text"></textarea>
        <div class="prompt-type-select">
          <select id="newPromptType">
            <option value="system">Use as system prompt</option>
            <option value="context">Add as context</option>
          </select>
        </div>
        <button id="savePrompt">Save Custom Prompt</button>
      </div>
    </div>
    <div class="settings-link">
      <a href="#" id="openOptions">Configure Model & API Key</a>
    </div>
`;

// ---------------------------------------------
//            TypeScript type helpers
// ---------------------------------------------

interface CustomPrompt {
  text: string;
  type: 'system' | 'context';
}

type StoredAction = Action | 'custom';

type SelectionRef = {
  tabId: number;
  frameId?: number;
  selectionId?: string;
  source: 'direct' | 'page';
};

let lastSelectionRef: SelectionRef | null = null;
let lastResultText = '';

// ---------------------------------------------
//      DOM element helpers (typed & asserted)
// ---------------------------------------------
function $(selector: string): HTMLElement {
  const el = document.querySelector(selector);
  if (!el) {
    throw new Error(`Element with selector "${selector}" not found.`);
  }
  return el as HTMLElement;
}

// Get DOM elements (now strictly typed)
const resultDiv              = $("#result")                as HTMLDivElement;
const copyResultButton       = $("#copyResult")           as HTMLButtonElement;
const replaceResultButton    = $("#replaceResult")        as HTMLButtonElement;
const directInputText        = $("#directInputText")        as HTMLTextAreaElement;
const useAsInputCheckbox     = $("#useAsInput")             as HTMLInputElement;
const savedPromptsSelect     = $("#savedPromptsSelect")     as HTMLSelectElement;
const useSelectedPromptButton= $("#useSelectedPrompt")      as HTMLButtonElement;
const managePromptsButton    = $("#managePrompts")          as HTMLButtonElement;
const customPromptsDiv       = $(".custom-prompts")         as HTMLDivElement;
const newPromptNameInput     = $("#newPromptName")          as HTMLInputElement;
const newPromptTextInput     = $("#newPromptText")          as HTMLTextAreaElement;
const newPromptTypeSelect    = $("#newPromptType")          as HTMLSelectElement;
const savePromptButton       = $("#savePrompt")             as HTMLButtonElement;
const savedPromptsDiv        = $("#savedPrompts")           as HTMLDivElement;

const buttons: Record<Action, HTMLButtonElement> = {
  'fix-grammar': $("#fix-grammar")       as HTMLButtonElement,
  'improve': $("#improve")               as HTMLButtonElement,
  'professional': $("#professional")     as HTMLButtonElement,
  'simplify': $("#simplify")             as HTMLButtonElement,
  'summarize': $("#summarize")           as HTMLButtonElement,
  'expand': $("#expand")                 as HTMLButtonElement,
  'bullets': $("#bullets")               as HTMLButtonElement,
  'variations': $("#variations")         as HTMLButtonElement,
  'better-way': $("#better-way")         as HTMLButtonElement,
  'explain': $("#explain")               as HTMLButtonElement,
  'tweet': $("#tweet")                   as HTMLButtonElement
};

// Add new DOM elements for settings (typed)
const providerSelect     = $("#provider")   as HTMLSelectElement;
const baseUrlInput       = $("#baseUrl")    as HTMLInputElement;
const apiKeyInput        = $("#apiKey")     as HTMLInputElement;
const modelSelect        = $("#modelSelect") as HTMLSelectElement;
const modelInput         = $("#modelInput")  as HTMLInputElement;
const saveSettingsButton = $("#saveSettings") as HTMLButtonElement;
const autoOpenCheckbox   = $("#autoOpenPopup") as HTMLInputElement;
const autoCopyCheckbox   = $("#autoCopyResult") as HTMLInputElement;
const baseUrlError       = $("#baseUrlError") as HTMLDivElement;
const apiKeyError        = $("#apiKeyError") as HTMLDivElement;
const modelError         = $("#modelError") as HTMLDivElement;
const settingsStatus     = $("#settingsStatus") as HTMLDivElement;

// Remove options page link
const optionsLink = document.getElementById('openOptions');
if (optionsLink && optionsLink.parentElement) {
  optionsLink.parentElement.remove();
}

// Toggle direct input textarea visibility
useAsInputCheckbox.addEventListener('change', () => {
  directInputText.classList.toggle('show', useAsInputCheckbox.checked);
});

// Load saved settings and models using WXT Storage
async function loadSettings() {
  const [
    activeProvider,
    providerSettings,
    customPrompts,
    modelsByProvider,
    legacyGroqApiKey,
    legacySelectedModel,
    legacyGroqModels,
    autoOpenPopup,
    autoCopyResult,
    lastResultTextStored
  ] = await Promise.all([
    storage.getItem<ProviderId>('sync:activeProvider'),
    storage.getItem<ProviderSettingsMap>('sync:providerSettings'),
    storage.getItem<Record<string, CustomPrompt>>('sync:customPrompts'),
    storage.getItem<Record<ProviderId, LlmModel[]>>('local:modelsByProvider'),
    storage.getItem<string>('sync:groqApiKey'),
    storage.getItem<string>('sync:selectedModel'),
    storage.getItem<LlmModel[]>('local:groqModels'),
    storage.getItem<boolean>('sync:autoOpenPopup'),
    storage.getItem<boolean>('sync:autoCopyResult'),
    storage.getItem<string>('local:lastResultText')
  ]);

  const migratedSettings: ProviderSettingsMap = providerSettings ?? {
    groq: {},
    openai: {},
    'openai-compatible': {}
  };

  if (!providerSettings && (legacyGroqApiKey || legacySelectedModel)) {
    migratedSettings.groq = {
      apiKey: legacyGroqApiKey ?? '',
      model: legacySelectedModel ?? ''
    };
    await storage.setItem('sync:providerSettings', migratedSettings);
    await storage.setItem('sync:activeProvider', 'groq');
  }

  const providerId = (activeProvider ?? DEFAULT_PROVIDER) as ProviderId;
  providerSelect.value = providerId;

  const normalizedModelsByProvider: Record<ProviderId, LlmModel[]> =
    modelsByProvider ?? { groq: [], openai: [], 'openai-compatible': [] };

  if (!modelsByProvider && legacyGroqModels) {
    normalizedModelsByProvider.groq = legacyGroqModels;
    await storage.setItem('local:modelsByProvider', normalizedModelsByProvider);
  }

  clearSettingsFeedback();
  applyProviderToForm(providerId, migratedSettings, normalizedModelsByProvider);

  if (customPrompts) {
    displaySavedPrompts(customPrompts);
    updateSavedPromptsDropdown(customPrompts);
  }

  autoOpenCheckbox.checked = autoOpenPopup ?? true;
  autoCopyCheckbox.checked = autoCopyResult ?? true;

  if (lastResultTextStored) {
    lastResultText = lastResultTextStored;
    resultDiv.innerText = lastResultTextStored;
  }

  updateResultActions();
}

function applyProviderToForm(
  providerId: ProviderId,
  settings: ProviderSettingsMap,
  modelsByProvider: Record<ProviderId, LlmModel[]>
): void {
  const providerSettings = settings[providerId] ?? {};
  apiKeyInput.value = providerSettings.apiKey ?? '';
  baseUrlInput.value = providerSettings.baseUrl ?? PROVIDERS[providerId].defaultBaseUrl;

  const modelValue = providerSettings.model ?? getProviderModel(providerId, settings);
  updateModelOptions(modelsByProvider[providerId] ?? [], modelValue);
  modelInput.value = modelValue;
  syncModelInputVisibility();
}

// Update model options select
function updateModelOptions(models: LlmModel[] = [], selectedModel?: string): void {
  const currentSelection = selectedModel ?? modelSelect.value;
  modelSelect.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Select a model';
  modelSelect.appendChild(placeholder);

  models.forEach((model) => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.id;
    modelSelect.appendChild(option);
  });

  const customOption = document.createElement('option');
  customOption.value = '__custom__';
  customOption.textContent = 'Custom model...';
  modelSelect.appendChild(customOption);

  if (currentSelection && Array.from(modelSelect.options).some((opt) => opt.value === currentSelection)) {
    modelSelect.value = currentSelection;
  } else if (currentSelection) {
    modelSelect.value = '__custom__';
    modelInput.value = currentSelection;
  } else {
    modelSelect.value = models.length ? models[0].id : '__custom__';
  }
}

// Listen for model updates via storage watcher
storage.watch<Record<ProviderId, LlmModel[]>>('local:modelsByProvider', (newModels) => {
  const providerId = (providerSelect.value || DEFAULT_PROVIDER) as ProviderId;
  updateModelOptions(newModels?.[providerId] ?? [], modelInput.value);
  syncModelInputVisibility();
});

storage.watch<string>('local:lastResultText', (newResult) => {
  if (!newResult) {
    return;
  }
  lastResultText = newResult;
  resultDiv.innerText = newResult;
  updateResultActions();
});

providerSelect.addEventListener('change', async () => {
  clearSettingsFeedback();
  const providerId = providerSelect.value as ProviderId;
  const settings = (await storage.getItem<ProviderSettingsMap>('sync:providerSettings')) ?? {
    groq: {},
    openai: {},
    'openai-compatible': {}
  };
  const modelsByProvider =
    (await storage.getItem<Record<ProviderId, LlmModel[]>>('local:modelsByProvider')) ?? {};
  applyProviderToForm(providerId, settings, modelsByProvider);
});

modelSelect.addEventListener('change', () => {
  if (modelSelect.value !== '__custom__' && modelSelect.value) {
    modelInput.value = modelSelect.value;
  }
  syncModelInputVisibility();
});

modelInput.addEventListener('input', () => {
  if (modelSelect.value !== '__custom__') {
    modelSelect.value = '__custom__';
  }
  syncModelInputVisibility();
});

function syncModelInputVisibility(): void {
  const shouldShow = modelSelect.value === '__custom__' || modelSelect.value === '';
  modelInput.classList.toggle('show', shouldShow);
}

// Update saved prompts dropdown
function updateSavedPromptsDropdown(prompts: Record<string, CustomPrompt> = {}): void {
  savedPromptsSelect.innerHTML = '<option value="">Select a saved prompt...</option>';
  Object.entries(prompts).forEach(([name]) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    savedPromptsSelect.appendChild(option);
  });
}

// Display saved custom prompts in management section
function displaySavedPrompts(prompts: Record<string, CustomPrompt> = {}): void {
  savedPromptsDiv.innerHTML = '';
  Object.entries(prompts).forEach(([name, promptData]) => {
    const promptDiv = document.createElement('div');
    promptDiv.className = 'saved-prompt';
    promptDiv.innerHTML = `
      <div class="saved-prompt-info">
        <div class="saved-prompt-name">${name}</div>
        <div class="saved-prompt-type">${promptData.type === 'system' ? 'System Prompt' : 'Context'}</div>
      </div>
      <div class="saved-prompt-actions">
        <button class="edit-prompt">Edit</button>
        <button class="delete-prompt">Delete</button>
      </div>
    `;

    const editButton = promptDiv.querySelector<HTMLButtonElement>('.edit-prompt');
    editButton?.addEventListener('click', () => {
      newPromptNameInput.value = name;
      newPromptTextInput.value = promptData.text;
      newPromptTypeSelect.value = promptData.type;
      customPromptsDiv.classList.add('show');
    });

    const deleteButton = promptDiv.querySelector<HTMLButtonElement>('.delete-prompt');
    deleteButton?.addEventListener('click', async () => {
      const promptsCopy = (await storage.getItem<Record<string, CustomPrompt>>('sync:customPrompts')) ?? {};
      delete promptsCopy[name];
      await storage.setItem('sync:customPrompts', promptsCopy);
      displaySavedPrompts(promptsCopy);
      updateSavedPromptsDropdown(promptsCopy);
    });

    savedPromptsDiv.appendChild(promptDiv);
  });
}

// Toggle custom prompts management section
managePromptsButton.addEventListener('click', () => {
  customPromptsDiv.classList.toggle('show');
});

// Use selected prompt and process text
useSelectedPromptButton.addEventListener('click', async () => {
  const selectedPrompt = savedPromptsSelect.value;
  if (selectedPrompt) {
    await storage.setItems([
      { key: 'sync:lastAction', value: 'custom' satisfies StoredAction },
      { key: 'sync:lastCustomPromptName', value: selectedPrompt }
    ]);
    const customPrompts = await storage.getItem<Record<string, CustomPrompt>>('sync:customPrompts');
    const promptData = customPrompts?.[selectedPrompt];
    if (promptData) {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        showError('No active tab found');
        return;
      }

      setLoading(true);
      try {
        const selectedText = await getSelectedText(tab);
        const messages: ChatMessage[] = [];

        if (promptData.type === 'system') {
          messages.push({
            role: 'system',
            content: promptData.text
          });
          messages.push({
            role: 'user',
            content: selectedText
          });
        } else {
          messages.push({
            role: 'user',
            content: `Context: ${promptData.text}\n\n${selectedText}`
          });
        }

        const result = await callLLM(messages);
        resultDiv.innerText = result;
        lastResultText = result;
        updateResultActions();
        await storage.setItem('local:lastResultText', result);
        const autoCopy = (await storage.getItem<boolean>('sync:autoCopyResult')) ?? true;
        if (autoCopy) {
          try {
            await navigator.clipboard.writeText(result);
            showMessage('Copied to clipboard!');
          } catch (err) {
            showMessage('Failed to copy result', true);
          }
        }
      } catch (error: any) {
        showError(error.message);
      } finally {
        setLoading(false);
      }
    }
  }
});

async function getActiveProviderConfig(): Promise<{
  providerId: ProviderId;
  baseUrl: string;
  apiKey?: string;
  model: string;
}> {
  const [activeProvider, providerSettings] = await Promise.all([
    storage.getItem<ProviderId>('sync:activeProvider'),
    storage.getItem<ProviderSettingsMap>('sync:providerSettings')
  ]);

  const providerId = (activeProvider ?? DEFAULT_PROVIDER) as ProviderId;
  const settings = providerSettings ?? {
    groq: {},
    openai: {},
    'openai-compatible': {}
  };

  return {
    providerId,
    baseUrl: getProviderBaseUrl(providerId, settings),
    apiKey: settings[providerId]?.apiKey?.trim(),
    model: getProviderModel(providerId, settings)
  };
}

// Modified API call function with better error handling
async function callLLM(messages: ChatMessage[], temperature = 0.7): Promise<string> {
  const { providerId, baseUrl, apiKey, model } = await getActiveProviderConfig();

  if (PROVIDERS[providerId].requiresKey && !apiKey) {
    throw new Error(`Please set your ${PROVIDERS[providerId].label} API key in the settings`);
  }

  try {
    return await callChatCompletion({
      baseUrl,
      apiKey,
      model,
      messages,
      temperature
    });
  } catch (error: any) {
    console.error('API call error:', error);
    if (error.message?.toLowerCase?.().includes('authentication')) {
      throw new Error('Invalid API key. Please check your settings.');
    }
    throw new Error(`Failed to process text: ${error.message}`);
  }
}

// Modified button click handler
async function handleButtonClick(action: Action): Promise<void> {
  const handleClick = async (): Promise<void> => {
    await storage.setItem('sync:lastAction', action as StoredAction);
    setLoading(true);
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }

      const selectedText = await getSelectedText(tab);
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: SYSTEM_PROMPTS[action]
        },
        {
          role: 'user',
          content: `${ACTION_PROMPTS[action]}\n\n${selectedText}`
        }
      ];

      const result = await callLLM(messages);
      resultDiv.innerText = result;
      lastResultText = result;
      updateResultActions();
      await storage.setItem('local:lastResultText', result);

      const autoCopy = (await storage.getItem<boolean>('sync:autoCopyResult')) ?? true;
      if (autoCopy) {
        try {
          await navigator.clipboard.writeText(result);
          showMessage('Copied to clipboard!');
        } catch (err) {
          showMessage('Failed to copy result', true);
        }
      }
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  await handleClick();
}

// Add event listeners
Object.entries(buttons).forEach(([action, button]) => {
  button.addEventListener('click', () => handleButtonClick(action as Action));
});

// Modified save settings with validation
async function saveSettings() {
  clearSettingsFeedback();
  const providerId = providerSelect.value as ProviderId;
  const apiKey = apiKeyInput.value.trim();
  const baseUrl = baseUrlInput.value.trim() || PROVIDERS[providerId].defaultBaseUrl;
  const chosenModel =
    modelSelect.value && modelSelect.value !== '__custom__'
      ? modelSelect.value
      : modelInput.value.trim();
  const model = chosenModel || PROVIDERS[providerId].defaultModel;

  baseUrlInput.value = baseUrl;
  modelInput.value = model;

  if (PROVIDERS[providerId].requiresKey && !apiKey) {
    setFieldError(apiKeyError, `${PROVIDERS[providerId].label} API key is required`);
    return;
  }

  if (!model) {
    setFieldError(modelError, 'Model ID is required');
    return;
  }

  setLoading(true);
  try {
    let fetchedModels: LlmModel[] | null = null;
    try {
      fetchedModels = await fetchModels(baseUrl, apiKey);
      if (fetchedModels.length === 0) {
        setSettingsStatus('No models returned. You can type a custom model ID.', true);
      }
    } catch (err: any) {
      const message = err?.message || 'Model list fetch failed';
      const statusMatch = message.match(/\((\d{3})\)/);
      const statusCode = statusMatch ? Number(statusMatch[1]) : null;
      if (statusCode === 401 || statusCode === 403) {
        setFieldError(apiKeyError, 'API key rejected by provider.');
      } else if (statusCode === 404) {
        setFieldError(baseUrlError, 'Base URL not found.');
      } else {
        setSettingsStatus(`Model list fetch failed: ${message}`, true);
      }
    }

    const providerSettings =
      (await storage.getItem<ProviderSettingsMap>('sync:providerSettings')) ?? {
        groq: {},
        openai: {},
        'openai-compatible': {}
      };

    providerSettings[providerId] = { apiKey, baseUrl, model };

    await storage.setItems([
      { key: 'sync:providerSettings', value: providerSettings },
      { key: 'sync:activeProvider', value: providerId },
      { key: 'sync:autoOpenPopup', value: autoOpenCheckbox.checked },
      { key: 'sync:autoCopyResult', value: autoCopyCheckbox.checked }
    ]);

    if (fetchedModels) {
      const modelsByProvider =
        (await storage.getItem<Record<ProviderId, LlmModel[]>>('local:modelsByProvider')) ?? {};
      modelsByProvider[providerId] = fetchedModels;
      await storage.setItem('local:modelsByProvider', modelsByProvider);
    }

    // Explicitly request a model update
    await browser.runtime.sendMessage({ action: 'updateModels' });

    setSettingsStatus('Settings saved.', false);
  } catch (error: any) {
    setSettingsStatus(`Failed to save settings: ${error.message}`, true);
  } finally {
    setLoading(false);
  }
}

// Helper function to show temporary message
function showMessage(message: string, isError: boolean = false): void {
  const div = document.createElement('div');
  div.textContent = message;
  div.className = isError ? 'error' : 'success';
  resultDiv.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

// Save custom prompt
async function saveCustomPrompt() {
  const name = newPromptNameInput.value.trim();
  const text = newPromptTextInput.value.trim();
  const type = newPromptTypeSelect.value as 'system' | 'context';

  if (!name || !text) {
    showMessage('Please enter both name and prompt text', true);
    return;
  }

  const customPrompts = (await storage.getItem<Record<string, CustomPrompt>>('sync:customPrompts')) || {};
  customPrompts[name] = { text, type };

  await storage.setItem('sync:customPrompts', customPrompts);
  displaySavedPrompts(customPrompts);
  updateSavedPromptsDropdown(customPrompts);

  newPromptNameInput.value = '';
  newPromptTextInput.value = '';
  showMessage('Prompt saved successfully!');
}

// Helper function to set loading state
function setLoading(isLoading: boolean): void {
  Object.values(buttons).forEach(button => {
    button.disabled = isLoading;
  });
  if (isLoading) {
    resultDiv.innerHTML = '<div class="loading">Processing...</div>';
    copyResultButton.disabled = true;
    replaceResultButton.disabled = true;
  } else {
    updateResultActions();
  }
}

copyResultButton.addEventListener('click', async () => {
  if (!lastResultText.trim()) {
    return;
  }
  try {
    await navigator.clipboard.writeText(lastResultText);
    showMessage('Copied to clipboard!');
  } catch (err) {
    console.error('Failed to copy result', err);
    showMessage('Failed to copy result', true);
  }
});

replaceResultButton.addEventListener('click', async () => {
  if (!lastSelectionRef || lastSelectionRef.source !== 'page' || !lastSelectionRef.selectionId) {
    showMessage('Select text in the page first', true);
    return;
  }
  if (!lastResultText.trim()) {
    return;
  }
  try {
    await browser.tabs.sendMessage(
      lastSelectionRef.tabId,
      { action: 'applyReplacement', selectionId: lastSelectionRef.selectionId, text: lastResultText },
      lastSelectionRef.frameId !== undefined ? { frameId: lastSelectionRef.frameId } : undefined
    );
    showMessage('Replaced selection!');
  } catch (err) {
    console.error('Failed to replace selection', err);
    showMessage('Failed to replace selection', true);
  }
});

// Helper function to show error
function showError(message: string): void {
  resultDiv.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'error';
  div.innerText = message;
  resultDiv.appendChild(div);
  lastResultText = '';
  void storage.setItem('local:lastResultText', '');
  updateResultActions();
}

function clearSettingsFeedback(): void {
  baseUrlError.textContent = '';
  apiKeyError.textContent = '';
  modelError.textContent = '';
  settingsStatus.textContent = '';
  settingsStatus.classList.remove('error', 'success');
}

function setFieldError(element: HTMLDivElement, message?: string): void {
  element.textContent = message ?? '';
  element.classList.toggle('show', Boolean(message));
}

function setSettingsStatus(message: string, isError = false): void {
  settingsStatus.textContent = message;
  settingsStatus.classList.toggle('error', isError);
  settingsStatus.classList.toggle('success', !isError);
}

function updateResultActions(): void {
  const hasResult = lastResultText.trim().length > 0;
  copyResultButton.disabled = !hasResult;
  const canReplace =
    hasResult &&
    lastSelectionRef?.source === 'page' &&
    Boolean(lastSelectionRef.selectionId);
  replaceResultButton.disabled = !canReplace;
}

async function ensureContentScript(tabId: number): Promise<void> {
  await browser.scripting.executeScript({
    target: { tabId, allFrames: true },
    files: ['content-scripts/content.js']
  });
}

async function findSelectionInFrames(tabId: number): Promise<SelectionRef | null> {
  try {
    await ensureContentScript(tabId);
  } catch (err) {
    console.error('Failed to inject content script', err);
  }

  const frames = await browser.webNavigation.getAllFrames({ tabId });
  for (const frame of frames) {
    try {
      const selection = await browser.tabs.sendMessage(
        tabId,
        { action: 'getEditableSelection' },
        { frameId: frame.frameId }
      );
      if (selection?.selectionId) {
        return {
          tabId,
          frameId: frame.frameId,
          selectionId: selection.selectionId,
          source: 'page'
        };
      }
    } catch (err) {
      if (String((err as Error)?.message || err).includes('Receiving end does not exist')) {
        continue;
      }
      console.error('Failed to read selection', err);
    }
  }

  return null;
}

async function getPlainSelectionText(tabId: number): Promise<{ text: string; frameId?: number } | null> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => (window.getSelection?.()?.toString() ?? '')
    });
    const best = results
      .map((result) => ({
        frameId: result.frameId,
        text: (result.result ?? '').toString()
      }))
      .find((entry) => entry.text.trim().length > 0);
    return best ?? null;
  } catch (err) {
    console.error('Failed to read plain selection', err);
    return null;
  }
}

// Fetch selected text either from direct input or via injected script on the active tab
async function getSelectedText(tab: Browser.tabs.Tab): Promise<string> {
  // Direct input mode
  if (useAsInputCheckbox.checked) {
    const directInput = directInputText.value.trim();
    if (!directInput) {
      throw new Error('Please enter text in the input box when using direct input mode');
    }
    lastSelectionRef = {
      tabId: tab.id!,
      source: 'direct'
    };
    return directInput;
  }

  if (!tab.id) {
    throw new Error('No active tab found');
  }

  const plainSelection = await getPlainSelectionText(tab.id);
  if (plainSelection?.text?.trim()) {
    lastSelectionRef = {
      tabId: tab.id,
      frameId: plainSelection.frameId,
      source: 'page'
    };
    return plainSelection.text;
  }

  const selectionRef = await findSelectionInFrames(tab.id);
  if (!selectionRef) {
    throw new Error('Please select some text or focus an editable field first');
  }

  lastSelectionRef = selectionRef;

  try {
    const selection = await browser.tabs.sendMessage(
      tab.id,
      { action: 'getEditableSelection' },
      { frameId: selectionRef.frameId }
    );
    const text = selection?.text?.toString?.() ?? '';
    if (!text.trim()) {
      throw new Error('Editable field is empty');
    }
    return text;
  } catch (err: any) {
    console.error('Failed to retrieve selected text:', err);
    throw new Error('Unable to access selected text. Please refresh the page and try again.');
  }
}

saveSettingsButton.addEventListener('click', saveSettings);
savePromptButton.addEventListener('click', saveCustomPrompt);

// Load settings on popup open
document.addEventListener('DOMContentLoaded', loadSettings);
