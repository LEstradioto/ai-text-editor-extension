type EditableSelection = {
  selectionId: string;
  text: string;
};

type StoredSelection = {
  selectionId: string;
  type: 'input' | 'textarea' | 'contenteditable';
  element: HTMLInputElement | HTMLTextAreaElement | HTMLElement;
  selectionStart?: number;
  selectionEnd?: number;
  range?: Range;
};

let lastSelection: StoredSelection | null = null;

function generateSelectionId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message: string, isError = false): void {
  const existing = document.getElementById('ai-text-editor-toast');
  if (existing) {
    existing.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'ai-text-editor-toast';
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.top = '16px';
  toast.style.right = '16px';
  toast.style.padding = '10px 12px';
  toast.style.borderRadius = '8px';
  toast.style.fontSize = '13px';
  toast.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  toast.style.color = '#fff';
  toast.style.background = isError ? 'rgba(184, 33, 33, 0.95)' : 'rgba(40, 120, 80, 0.95)';
  toast.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.25)';
  toast.style.zIndex = '2147483647';

  document.documentElement.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function flashElement(element: HTMLElement | null): void {
  if (!element) return;
  element.classList.add('ai-text-editor-flash');
  setTimeout(() => element.classList.remove('ai-text-editor-flash'), 350);
  setTimeout(() => element.classList.add('ai-text-editor-flash'), 500);
  setTimeout(() => element.classList.remove('ai-text-editor-flash'), 850);
}

function getEditableRoot(node: Node | null): HTMLElement | null {
  let el = node instanceof HTMLElement ? node : node?.parentElement || null;
  while (el) {
    if (el.isContentEditable) {
      return el;
    }
    const root = el.getRootNode?.();
    if (root instanceof ShadowRoot && root.host instanceof HTMLElement) {
      el = root.host;
      continue;
    }
    el = el.parentElement;
  }
  return null;
}

function getDeepActiveElement(root: Document | ShadowRoot = document): Element | null {
  let active = root.activeElement;
  while (active && (active as HTMLElement).shadowRoot?.activeElement) {
    active = (active as HTMLElement).shadowRoot?.activeElement ?? null;
  }
  return active;
}

function getInputSelection(
  element: HTMLInputElement | HTMLTextAreaElement
): EditableSelection {
  const start = element.selectionStart ?? 0;
  const end = element.selectionEnd ?? 0;
  const hasSelection = start !== end;
  const selectionStart = hasSelection ? start : 0;
  const selectionEnd = hasSelection ? end : element.value.length;

  const selectionId = generateSelectionId();
  lastSelection = {
    selectionId,
    type: element instanceof HTMLTextAreaElement ? 'textarea' : 'input',
    element,
    selectionStart,
    selectionEnd
  };

  return {
    selectionId,
    text: element.value.slice(selectionStart, selectionEnd)
  };
}

function getContentEditableSelection(): EditableSelection | null {
  const selection = window.getSelection();
  let range: Range | null = null;

  if (selection && selection.rangeCount > 0) {
    range = selection.getRangeAt(0);
  }

  const activeElement = getDeepActiveElement();
  const editableRoot = getEditableRoot(range?.commonAncestorContainer ?? activeElement ?? null);
  if (!editableRoot) {
    return null;
  }

  let workingRange = range ? range.cloneRange() : document.createRange();
  if (!range) {
    workingRange.selectNodeContents(editableRoot);
  }

  let text = selection?.toString() ?? '';
  if (!text) {
    workingRange = document.createRange();
    workingRange.selectNodeContents(editableRoot);
    text = workingRange.toString();
  }

  const selectionId = generateSelectionId();
  lastSelection = {
    selectionId,
    type: 'contenteditable',
    element: editableRoot,
    range: workingRange
  };

  return {
    selectionId,
    text
  };
}

function applyReplacement(selectionId: string, text: string): void {
  if (!lastSelection || lastSelection.selectionId !== selectionId) {
    showToast('Nothing to replace.', true);
    return;
  }

  if (lastSelection.type === 'contenteditable') {
    const range = lastSelection.range;
    if (!range) {
      showToast('Selection expired.', true);
      return;
    }
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    const inserted = document.execCommand('insertText', false, text);
    if (!inserted) {
      range.deleteContents();
      range.insertNode(document.createTextNode(text));
      lastSelection.element.dispatchEvent(new Event('input', { bubbles: true }));
    }
    flashElement(lastSelection.element);
    showToast('Text updated');
    return;
  }

  const element = lastSelection.element as HTMLInputElement | HTMLTextAreaElement;
  const selectionStart = lastSelection.selectionStart ?? 0;
  const selectionEnd = lastSelection.selectionEnd ?? element.value.length;
  if (typeof element.setRangeText === 'function') {
    element.setRangeText(text, selectionStart, selectionEnd, 'select');
  } else {
    const updatedValue =
      element.value.slice(0, selectionStart) + text + element.value.slice(selectionEnd);
    element.value = updatedValue;
  }
  element.dispatchEvent(new Event('input', { bubbles: true }));
  flashElement(element);
  showToast('Text updated');
}

function selectAllInEditable(): boolean {
  const active = getDeepActiveElement();
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
    active.focus();
    active.select();
    flashElement(active);
    return true;
  }

  const editableRoot = getEditableRoot(active ?? null) ?? (lastSelection?.element ?? null);
  if (editableRoot && editableRoot.isContentEditable) {
    const selection = window.getSelection();
    if (!selection) return false;
    const range = document.createRange();
    range.selectNodeContents(editableRoot);
    selection.removeAllRanges();
    selection.addRange(range);
    flashElement(editableRoot);
    return true;
  }

  return false;
}

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  main() {
    const globalKey = '__aiTextEditorContentScriptLoaded__';
    if ((globalThis as any)[globalKey]) {
      return;
    }
    (globalThis as any)[globalKey] = true;

    const style = document.createElement('style');
    style.textContent = `
      .ai-text-editor-flash {
        outline: 2px solid #4a6bff !important;
        outline-offset: 2px;
        transition: outline-color 120ms ease;
      }
    `;
    document.documentElement.appendChild(style);

    browser.runtime.onMessage.addListener((message) => {
      if (message?.action === 'getEditableSelection') {
        const activeElement = getDeepActiveElement();
        if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
          return getInputSelection(activeElement);
        }

        const selection = getContentEditableSelection();
        if (selection) {
          return selection;
        }

        return null;
      }

      if (message?.action === 'applyReplacement') {
        applyReplacement(message.selectionId, message.text ?? '');
        return null;
      }

      if (message?.action === 'selectAllInEditable') {
        const ok = selectAllInEditable();
        return ok;
      }

      if (message?.action === 'showInlineToast') {
        showToast(message.message ?? '', true);
        return null;
      }

      return null;
    });
  }
});
