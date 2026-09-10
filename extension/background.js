// GCR PRO background service worker.
//
// This file, and everything else under extension/, is untrusted client code —
// readable by anyone who installs it. It holds no API keys, no DB
// credentials, and no Google token. Its only credential is the short-lived
// extension bearer token handed over by the web app (see 5.5), stored in
// chrome.storage.local and sent as `Authorization: Bearer <token>` on every
// backend call.

// Phase 7 (deployment) must update this to the production origin.
const API_BASE = "http://localhost:3000";

// --- Auth handoff from the web app (externally_connectable, spec 5.5) -----
chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "GCR_TOKEN" || !message.token) return;

  chrome.storage.local.set(
    { token: message.token, theme: message.theme ?? "system" },
    () => sendResponse({ ok: true })
  );
  return true; // keep the message channel open for the async sendResponse
});

// --- Requests from the content script / side panel -------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "OPEN_PANEL") {
    const windowId = sender.tab?.windowId;
    if (windowId !== undefined) chrome.sidePanel.open({ windowId });
    return;
  }

  if (message?.type === "API_FETCH") {
    apiFetch(message.path).then(sendResponse);
    return true; // async response
  }
});

chrome.action.onClicked.addListener((tab) => {
  if (tab.windowId !== undefined) chrome.sidePanel.open({ windowId: tab.windowId });
});

async function apiFetch(path) {
  try {
    const { token } = await chrome.storage.local.get("token");
    if (!token) return { ok: false, status: 401, error: "Not connected" };

    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: String(err) };
  }
}
