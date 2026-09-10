// GCR PRO background service worker.
//
// This file, and everything else under extension/, is untrusted client code —
// readable by anyone who installs it. It holds no API keys, no DB
// credentials, and no Google token. Its only credential is the short-lived
// extension bearer token handed over by the web app (see 5.5), stored in
// chrome.storage.local and sent as `Authorization: Bearer <token>` on every
// backend call.

// The single source of truth for which backend this build talks to. Must match
// the origins in manifest.json (host_permissions + externally_connectable) and
// be an https:// production origin before the extension is published.
const API_BASE = "http://localhost:3000";

// Only these origins may hand this extension a bearer token. Chrome already
// gates onMessageExternal by manifest externally_connectable, but that list is
// easy to widen by accident, so the check is repeated here against the one
// origin we actually trust.
const TRUSTED_ORIGINS = [API_BASE];

// --- Auth handoff from the web app (externally_connectable, spec 5.5) -----
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!TRUSTED_ORIGINS.includes(sender.origin)) {
    sendResponse({ ok: false, error: "Untrusted origin" });
    return; // never accept a token from a page we don't control
  }
  if (message?.type !== "GCR_TOKEN" || typeof message.token !== "string") return;

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
