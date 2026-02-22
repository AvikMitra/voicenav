# VoiceNav

AI-powered screen description for accessibility. Describes what's on your screen in natural language and reads it aloud — built for users who are blind or have low vision.

## What it does

- **Describe Screen** — takes a screenshot, sends it to Claude, reads a meaningful description aloud
- **Focus Mode** — click any element on the page to hear it described
- **Follow-up questions** — ask things like *"what does the red section mean?"* in context
- **Alt+D hotkey** — trigger a description without opening the popup
- **Auto mode** — describes the page automatically on navigation

Unlike traditional screen readers that describe structure, VoiceNav describes *meaning* — charts become trends, images become context, forms become intent.

## Install

1. Clone this repo
2. Go to `chrome://extensions` in Chrome
3. Enable **Developer Mode** (top right)
4. Click **Load unpacked** → select the `voicenav/` folder
5. Pin the extension from the toolbar

## Setup

You need an Anthropic API key:
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key (starts with `sk-ant-`)
3. Paste it into VoiceNav on first launch


## Stack

Chrome Extension (Manifest V3) · Claude Vision API · Web Speech API

No backend or build step.
