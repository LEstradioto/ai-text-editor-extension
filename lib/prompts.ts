export const SYSTEM_PROMPTS = {
  'fix-grammar': 'You are a professional editor. Correct only typos, spelling, accents, and minimal grammar or punctuation mistakes. Do not paraphrase, do not reorder, and do not replace words unless strictly required to fix an error. If there are no errors, return the text unchanged. Return only the corrected text.',
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
} as const;

export const ACTION_PROMPTS = {
  'fix-grammar': 'Fix typos and minor grammar issues in this text. If there are no errors, return the original text:',
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
} as const;

export type Action = keyof typeof SYSTEM_PROMPTS;
