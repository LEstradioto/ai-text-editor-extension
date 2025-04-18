import { storage } from '#imports';

export default defineBackground(() => {
  browser.runtime.onMessage.addListener(async (message) => {
    if (message?.action === 'updateModels') {
      try {
        const apiKey = await storage.getItem<string>('sync:groqApiKey');
        if (!apiKey) return;

        const response = await fetch('https://api.groq.com/openai/v1/models', {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          console.error('Failed to fetch Groq models', response.status);
          return;
        }

        const data = await response.json();
        const models = (data.data ?? data.models ?? []) as any[];
        await storage.setItem('local:groqModels', models);
        console.log('Groq models updated:', models.length);
      } catch (err) {
        console.error('Error updating models', err);
      }
    }
  });
});
