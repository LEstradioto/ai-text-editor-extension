import './style.css';
import { storage } from '#imports';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <h1>Groq Text Editor</h1>
    <div class="config-section">
      <details>
        <summary>API & Model Settings</summary>
        <input type="password" id="apiKey" placeholder="Groq API Key">
        <select id="model">
          <option value="deepseek-r1-distill-llama-70b">DeepSeek R1 Distill LLaMA 70B</option>
          <option value="distil-whisper-large-v3-en">Distil Whisper Large v3 EN</option>
          <option value="gemma2-9b-it">Gemma2 9B</option>
          <option value="llama-3.3-70b-versatile">LLaMA 3.3 70B Versatile</option>
          <option value="llama-3.3-70b-specdec">LLaMA 3.3 70B SpecDec</option>
          <option value="llama-3.2-1b-preview">LLaMA 3.2 1B Preview</option>
          <option value="llama-3.2-3b-preview">LLaMA 3.2 3B Preview</option>
          <option value="llama-3.1-8b-instant">LLaMA 3.1 8B Instant</option>
          <option value="llama-guard-3-8b">LLaMA Guard 3 8B</option>
          <option value="llama3-70b-8192">LLaMA3 70B</option>
          <option value="llama3-8b-8192">LLaMA3 8B</option>
          <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
          <option value="whisper-large-v3">Whisper Large v3</option>
          <option value="whisper-large-v3-turbo">Whisper Large v3 Turbo</option>
        </select>
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
      <button id="fix-grammar">Fix Grammar</button>
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

const API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// System prompts for different actions
const SYSTEM_PROMPTS = {
  'fix-grammar': 'You are a professional editor. Fix grammar, spelling, and punctuation errors while preserving the original meaning. Return only the corrected text without explanations or formatting.',
  'improve': 'You are a writing enhancement assistant. Improve clarity, flow, and overall writing quality while maintaining the original message. Return only the improved text without explanations or formatting.',
  'professional': 'You are a professional writing expert. Make text more formal and suitable for business communication. Return only the modified text without explanations or formatting.',
  'simplify': 'You are a clarity expert. Make complex text easier to understand while preserving key information. Return only the simplified text without explanations or formatting.',
  'summarize': 'You are a summarization expert. Condense text while retaining important information. Return only the summary without explanations or formatting.',
  'expand': 'You are a content development expert. Expand text with relevant details while maintaining consistency. Return only the expanded text without explanations or formatting.',
  'bullets': 'You are a formatting specialist. Convert text into clear bullet points while preserving information. Return only the bullet points without explanations or additional formatting.',
  'variations': 'You are a creative writing expert. Generate three distinct variations of the text, maintaining the core message. Return only the variations labeled as 1, 2, and 3, without explanations.',
  'better-way': 'Is there a better way of saying this?',
  'explain': 'Explain this please, what user would like to mean with this sentence?',
  'tweet': 'Make it like a professional tweet, not too formal, not too nice'
};

// Action descriptions for generating prompts
const ACTION_PROMPTS = {
  'fix-grammar': 'Fix errors in this text and return only the corrected version:',
  'improve': 'Improve this text and return only the enhanced version:',
  'professional': 'Make this text more professional and return only the modified version:',
  'simplify': 'Simplify this text and return only the simplified version:',
  'summarize': 'Summarize this text and return only the summary:',
  'expand': 'Expand this text and return only the expanded version:',
  'bullets': 'Convert this text to bullet points and return only the bullet points:',
  'variations': 'Generate three variations of this text, labeled 1, 2, and 3:',
  'better-way': 'Suggest a better way of saying this:',
  'explain': 'Explain what this means:',
  'tweet': 'Format this as a professional tweet:'
};

// ---------------------------------------------
//            TypeScript type helpers
// ---------------------------------------------
type Action = keyof typeof SYSTEM_PROMPTS;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqModel {
  id: string;
  owner: string;
}

interface CustomPrompt {
  text: string;
  type: 'system' | 'context';
}

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
const apiKeyInput         = $("#apiKey")     as HTMLInputElement;
const modelSelect         = $("#model")      as HTMLSelectElement;
const saveSettingsButton  = $("#saveSettings") as HTMLButtonElement;

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
  const [groqApiKey, selectedModel, customPrompts, groqModels] = await Promise.all([
    storage.getItem<string>('sync:groqApiKey'),
    storage.getItem<string>('sync:selectedModel'),
    storage.getItem<Record<string, CustomPrompt>>('sync:customPrompts'),
    storage.getItem<GroqModel[]>('local:groqModels')
  ]);

  if (groqApiKey) {
    apiKeyInput.value = groqApiKey;
  }

  await updateModelSelect(groqModels ?? undefined);

  if (selectedModel) {
    modelSelect.value = selectedModel;
  }

  if (customPrompts) {
    displaySavedPrompts(customPrompts);
    updateSavedPromptsDropdown(customPrompts);
  }
}

// Update model select options
async function updateModelSelect(models?: GroqModel[]): Promise<void> {
  // Keep the current selection
  const currentSelection = modelSelect.value;

  // Clear existing options
  modelSelect.innerHTML = '';

  if (!models || models.length === 0) {
    const option = document.createElement('option');
    option.value = 'meta-llama/llama-4-maverick-17b-128e-instruct';
    option.textContent = 'Meta Llama/llama 4 Maverick 17b 128e Instruct';
    modelSelect.appendChild(option);
    return;
  }

  models.forEach((model: GroqModel) => {
    const option = document.createElement('option');
    option.value = model.id;
    const displayName = model.id
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .replace(/([0-9]+[a-z])/gi, ' $1 ')
      .trim();
    option.textContent = `${displayName}`;
    modelSelect.appendChild(option);
  });

  if (currentSelection && Array.from(modelSelect.options).some(opt => (opt as HTMLOptionElement).value === currentSelection)) {
    modelSelect.value = currentSelection;
  }
}

// Listen for model updates via storage watcher
storage.watch<GroqModel[]>('local:groqModels', (newModels) => {
  updateModelSelect(newModels ?? []);
});

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
  console.log('selectedPrompt', selectedPrompt);
  if (selectedPrompt) {
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

        const result = await callGroqAPI(messages);
        resultDiv.innerText = result;
      } catch (error: any) {
        showError(error.message);
      } finally {
        setLoading(false);
      }
    }
  }
});

// Modified API call function with better error handling
async function callGroqAPI(messages: ChatMessage[]): Promise<string> {
  const groqApiKey = await storage.getItem<string>('sync:groqApiKey');
  const selectedModel = await storage.getItem<string>('sync:selectedModel');

  if (!groqApiKey) {
    throw new Error('Please set your Groq API key in the settings');
  }

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: selectedModel || 'deepseek-r1-distill-llama-70b',
        messages: messages,
        temperature: 0.7,
        max_tokens: 2048
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed (${response.status})`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error('API call error:', error);
    if (error.message.includes('authentication')) {
      throw new Error('Invalid API key. Please check your settings.');
    }
    throw new Error(`Failed to process text: ${error.message}`);
  }
}

// Modified button click handler
async function handleButtonClick(action: Action): Promise<void> {
  const handleClick = async (): Promise<void> => {
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

      const result = await callGroqAPI(messages);
      resultDiv.innerText = result;
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
  const apiKey = apiKeyInput.value.trim();
  const model = modelSelect.value;

  if (!apiKey) {
    showError('API key is required');
    return;
  }

  setLoading(true);
  try {
    // Validate API key by making a test request
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Invalid API key');
    }

    await storage.setItems([
      { key: 'sync:groqApiKey', value: apiKey },
      { key: 'sync:selectedModel', value: model }
    ]);

    // Explicitly request a model update
    await browser.runtime.sendMessage({ action: 'updateModels' });

    showMessage('Settings saved successfully!');
  } catch (error: any) {
    showError(`Failed to save settings: ${error.message}`);
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
  }
}

// Helper function to show error
function showError(message: string): void {
  resultDiv.innerHTML = `<div class="error">${message}</div>`;
}

// Fetch selected text either from direct input or via injected script on the active tab
async function getSelectedText(tab: Browser.tabs.Tab): Promise<string> {
  // Direct input mode
  if (useAsInputCheckbox.checked) {
    const directInput = directInputText.value.trim();
    if (!directInput) {
      throw new Error('Please enter text in the input box when using direct input mode');
    }
    return directInput;
  }

  // Execute script in the page context to obtain the selection
  try {
    const [{ result: selected }] = await browser.scripting.executeScript({
      target: { tabId: tab.id! },
      func: () => (window.getSelection?.()?.toString() ?? '')
    });

    if (!selected) {
      throw new Error('Please select some text first');
    }
    return selected;
  } catch (err: any) {
    console.error('Failed to retrieve selected text:', err);
    throw new Error('Unable to access selected text. Please refresh the page and try again.');
  }
}

saveSettingsButton.addEventListener('click', saveSettings);
savePromptButton.addEventListener('click', saveCustomPrompt);

// Load settings on popup open
document.addEventListener('DOMContentLoaded', loadSettings);