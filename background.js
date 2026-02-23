const SYSTEM_PROMPT = `You are VoiceNav, an AI accessibility assistant. You describe web pages and screens for users who are blind or have low vision.

Rules:
- Keep it to 1-2 sentences maximum.
- Lead with what the page is and its single most important element or action.
- Skip secondary details, navigation, and decorative content entirely.
- Use natural, conversational language.`;

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === 'DESCRIBE') {
    describe(msg)
      .then(text => reply({ ok: true, text }))
      .catch(err => reply({ ok: false, error: err.message }));
    return true;
  }
  if (msg.type === 'FOLLOWUP') {
    followup(msg)
      .then(text => reply({ ok: true, text }))
      .catch(err => reply({ ok: false, error: err.message }));
    return true;
  }
  if (msg.type === 'SPEAK') {
    speakInTab(msg.text);
  }
});

async function describe({ screenshot, pageContext, apiKey }) {
  const base64 = screenshot.split(',')[1];

  const userContent = [
    {
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: base64 }
    },
    {
      type: 'text',
      text: `Describe this screen for a visually impaired user. Context: Page is "${pageContext.title}". Main content preview: ${pageContext.mainText.slice(0, 300)}`
    }
  ];

  return callClaude(apiKey, [{ role: 'user', content: userContent }]);
}

async function followup({ question, history, apiKey }) {
  const messages = [...history, { role: 'user', content: question }];
  return callClaude(apiKey, messages);
}

async function callClaude(apiKey, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'API error');
  }

  const data = await res.json();
  return data.content[0].text;
}

async function speakInTab(text) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: speakText,
    args: [text]
  });
}

function speakText(text) {
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 0.95;
  utt.pitch = 1.0;
  speechSynthesis.speak(utt);
}
