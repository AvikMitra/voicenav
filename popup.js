const $ = id => document.getElementById(id);

let lastDescription = '';
let conversationHistory = [];

async function getKey() {
  const r = await chrome.storage.local.get('apiKey');
  return r.apiKey || '';
}

function setStatus(text, type = '') {
  const el = $('status');
  el.textContent = text;
  el.className = 'status' + (type ? ` ${type}` : '');
}

async function init() {
  const key = await getKey();
  if (key) {
    showMain();
  }

  $('saveKey').addEventListener('click', async () => {
    const key = $('apiKey').value.trim();
    if (!key.startsWith('sk-ant-')) {
      alert('Invalid key — must start with sk-ant-');
      return;
    }
    await chrome.storage.local.set({ apiKey: key });
    showMain();
  });

  $('describeBtn').addEventListener('click', describeScreen);
  $('focusBtn').addEventListener('click', activateFocusMode);
  $('replayBtn').addEventListener('click', () => speak(lastDescription));
  $('clearBtn').addEventListener('click', clearOutput);
  $('followupBtn').addEventListener('click', askFollowup);
  $('followupInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') askFollowup();
  });

  $('autoMode').addEventListener('change', e => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'SET_AUTO_MODE',
        enabled: e.target.checked
      });
    });
  });
}

function showMain() {
  $('apiSetup').style.display = 'none';
  $('controls').style.display = 'flex';
}

async function describeScreen() {
  const key = await getKey();
  if (!key) return;

  setStatus('Capturing...', 'loading');
  $('describeBtn').disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const screenshot = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 85 });
    const pageContext = await getPageContext(tab.id);

    setStatus('Analyzing...', 'loading');

    const res = await chrome.runtime.sendMessage({
      type: 'DESCRIBE',
      screenshot,
      pageContext,
      apiKey: key
    });

    if (!res?.ok) throw new Error(res?.error || 'No response from background');

    showOutput(res.text);
    speak(res.text);
    setStatus('Done', 'active');
    conversationHistory = [
      { role: 'user', content: buildPrompt(pageContext) },
      { role: 'assistant', content: res.text }
    ];
  } catch (err) {
    setStatus(err.message || 'Error', 'error');
    console.error(err);
  } finally {
    $('describeBtn').disabled = false;
  }
}

async function askFollowup() {
  const q = $('followupInput').value.trim();
  if (!q || !conversationHistory.length) return;

  const key = await getKey();
  setStatus('Thinking...', 'loading');
  $('followupInput').value = '';

  try {
    const res = await chrome.runtime.sendMessage({
      type: 'FOLLOWUP',
      question: q,
      history: conversationHistory,
      apiKey: key
    });

    if (!res?.ok) throw new Error(res?.error || 'No response from background');

    conversationHistory.push({ role: 'user', content: q });
    conversationHistory.push({ role: 'assistant', content: res.text });

    showOutput(res.text);
    speak(res.text);
    setStatus('Done', 'active');
  } catch (err) {
    setStatus(err.message || 'Error', 'error');
    console.error(err);
  }
}

async function activateFocusMode() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { type: 'FOCUS_MODE' });
  window.close();
}

function getPageContext(tabId) {
  return chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      title: document.title,
      url: location.href,
      headings: [...document.querySelectorAll('h1,h2,h3')].slice(0, 5).map(h => h.textContent.trim()),
      mainText: document.body.innerText.slice(0, 600)
    })
  }).then(r => r[0].result);
}

function buildPrompt(ctx) {
  return `Page: "${ctx.title}" (${ctx.url})\nHeadings: ${ctx.headings.join(' | ')}\nContent preview: ${ctx.mainText}`;
}

function showOutput(text) {
  lastDescription = text;
  $('outputPanel').style.display = 'flex';
  const el = $('outputText');
  el.className = 'output-text';
  el.textContent = text;
}

function clearOutput() {
  $('outputPanel').style.display = 'none';
  lastDescription = '';
  conversationHistory = [];
  setStatus('Ready');
}

function speak(text) {
  chrome.runtime.sendMessage({ type: 'SPEAK', text });
}

init();
