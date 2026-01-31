import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    permissions: ['storage', 'scripting', 'webNavigation'],
    host_permissions: ['<all_urls>'],
    commands: {
      'fix-grammar-inline': {
        suggested_key: {
          default: 'Alt+Shift+G',
          mac: 'Alt+Shift+G'
        },
        description: 'Fix typos in the selected text or focused field'
      }
    }
  },
});
