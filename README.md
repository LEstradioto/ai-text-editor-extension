![screenshot](./screenshot.png)

- Select text on any webpage and use the Groq API to improve writing, fix grammar, summarize content, and more with just a click
- Direct input to process text without selecting it on a webpage
- Create and save your own prompts
- It automatically fetches the models when API Key is saved (need an update just hit save button again)

I use this every day, besides being a life saver, the Groq free tier is more than enough for my needs.

## Installation

### From Source

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Build the extension:
   ```
   npm run build       # For Chrome
   npm run build:firefox  # For Firefox
   ```
4. Load the extension:
   - **Chrome**: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the `.output/chrome-mv3` directory
   - **Firefox**: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on...", and select any file in the `.output/firefox-mv2` directory

## Usage

1. Sign up for a Groq API key at [groq.com](https://groq.com)
2. Click the extension icon in your browser toolbar
3. Enter your Groq API key in the settings
4. Select text on any webpage
5. Click the extension icon and choose an action:
   - Fix Grammar
   - Improve Writing
   - Make Professional
   - Simplify
   - Summarize
   - Expand
   - To Bullets
   - Better Way of Saying
   - Explain
   - Tweet
   - Generate Variations

Alternatively, you can use the direct input option to process text without selecting it on a webpage.

## Custom Prompts

1. Click "Manage Prompts" in the extension popup
2. Enter a name and text for your custom prompt
3. Choose whether to use it as a system prompt or add as context
4. Click "Save Custom Prompt"
5. Your saved prompts will appear in the dropdown menu

## Development

```
npm run dev       # Start development server for Chrome
npm run dev:firefox  # Start development server for Firefox
```

## Building for Distribution

```
npm run zip       # Create zip for Chrome
npm run zip:firefox  # Create zip for Firefox
```

## License

[MIT License](LICENSE)