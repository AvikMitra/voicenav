let focusModeActive = false;
let autoModeInterval = null;
let overlay = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'FOCUS_MODE') startFocusMode();
  if (msg.type === 'SET_AUTO_MODE') msg.enabled ? startAutoMode() : stopAutoMode();
});

// Focus mode: click any element to describe it
function startFocusMode() {
  if (focusModeActive) return;
  focusModeActive = true;

  showToast('Click any element to describe it. Press Esc to exit.');

  document.addEventListener('click', onFocusClick, true);
  document.addEventListener('keydown', exitFocusOnEsc);
  document.body.style.cursor = 'crosshair';
}

function stopFocusMode() {
  focusModeActive = false;
  document.removeEventListener('click', onFocusClick, true);
  document.removeEventListener('keydown', exitFocusOnEsc);
  document.body.style.cursor = '';
  removeOverlay();
}

async function onFocusClick(e) {
  e.preventDefault();
  e.stopPropagation();

  const el = e.target;
  highlightElement(el);

  const context = extractElementContext(el);
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) return;

  showToast('Analyzing...');

  const description = await chrome.runtime.sendMessage({
    type: 'FOLLOWUP',
    question: `Describe this specific element for a visually impaired user: ${context}`,
    history: [],
    apiKey
  });

  showPanel(description);
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(description);
  utt.rate = 0.95;
  speechSynthesis.speak(utt);
}

function exitFocusOnEsc(e) {
  if (e.key === 'Escape') stopFocusMode();
}

function extractElementContext(el) {
  const tag = el.tagName.toLowerCase();
  const text = el.innerText?.slice(0, 200) || '';
  const alt = el.getAttribute('alt') || '';
  const role = el.getAttribute('role') || '';
  const label = el.getAttribute('aria-label') || '';
  const src = el.src || el.href || '';

  return `Tag: ${tag}, Text: "${text}", Alt: "${alt}", Role: "${role}", Label: "${label}", Src: "${src.slice(0, 100)}"`;
}

function highlightElement(el) {
  removeOverlay();
  const rect = el.getBoundingClientRect();
  overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: ${rect.top}px;
    left: ${rect.left}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    border: 2px solid #6d6dff;
    background: rgba(109,109,255,0.08);
    pointer-events: none;
    z-index: 999999;
    border-radius: 4px;
    transition: all 0.15s;
  `;
  document.body.appendChild(overlay);
}

function removeOverlay() {
  overlay?.remove();
  overlay = null;
}

// Auto mode: describe page on load / navigation
function startAutoMode() {
  stopAutoMode();
  autoModeInterval = setInterval(checkAndDescribe, 5000);
  checkAndDescribe();
}

function stopAutoMode() {
  clearInterval(autoModeInterval);
  autoModeInterval = null;
}

let lastUrl = '';
async function checkAndDescribe() {
  if (location.href === lastUrl) return;
  lastUrl = location.href;

  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) return;

  // Send message to trigger description from background
  chrome.runtime.sendMessage({ type: 'AUTO_DESCRIBE', url: location.href });
}

// Toast notification
function showToast(text) {
  document.getElementById('vn-toast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'vn-toast';
  toast.textContent = text;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: #1a1a2e;
    color: #e8e8f0;
    padding: 10px 20px;
    border-radius: 24px;
    font-size: 14px;
    z-index: 9999999;
    border: 1px solid #2a2a4a;
    box-shadow: 0 4px 24px rgba(0,0,0,0.5);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    pointer-events: none;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// Inline description panel
function showPanel(text) {
  document.getElementById('vn-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'vn-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 70px;
    left: 50%;
    transform: translateX(-50%);
    max-width: 480px;
    width: 90vw;
    background: #0f0f18;
    color: #d8d8f0;
    padding: 16px 20px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.6;
    z-index: 9999999;
    border: 1px solid #2a2a4a;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  const close = document.createElement('button');
  close.textContent = '✕';
  close.style.cssText = `
    position: absolute;
    top: 10px;
    right: 14px;
    background: none;
    border: none;
    color: #6060a0;
    font-size: 16px;
    cursor: pointer;
  `;
  close.onclick = () => { panel.remove(); stopFocusMode(); };

  panel.appendChild(close);
  panel.appendChild(document.createTextNode(text));
  document.body.appendChild(panel);
}

// Keyboard shortcut: Alt+D to describe
document.addEventListener('keydown', async e => {
  if (e.altKey && e.key === 'd') {
    const { apiKey } = await chrome.storage.local.get('apiKey');
    if (apiKey) {
      chrome.runtime.sendMessage({ type: 'HOTKEY_DESCRIBE' });
    }
  }
});
