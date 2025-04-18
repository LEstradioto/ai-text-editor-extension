import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    permissions: ['storage', 'scripting'],
    host_permissions: ['<all_urls>'],
  },
});
