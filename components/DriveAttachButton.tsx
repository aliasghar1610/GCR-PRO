"use client";

import { useState } from "react";
import Script from "next/script";
import { extractPdfTextInBrowser } from "@/lib/pdfClient";

// Minimal shape of the globals the Google Identity Services + Picker scripts
// attach to `window` — there's no official TS package worth pulling in for
// this small a surface, so this is deliberately loose.
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken: () => void };
        };
      };
      picker: unknown;
    };
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
  }
}

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SLIDES_MIME = "application/vnd.google-apps.presentation";
const PDF_MIME = "application/pdf";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";

type Props = {
  onAttached: (text: string, fileName: string) => void;
  onClear: () => void;
  attachedFileName: string | null;
  /**
   * Notified when an attach attempt fails or is retried (null to clear).
   * Without this the failure stayed inside this component, so the parent
   * still believed nothing had been attached — indistinguishable from the
   * user never picking a file — and generated from whatever else it had.
   */
  onError?: (message: string | null) => void;
};

export function DriveAttachButton({ onAttached, onClear, attachedFileName, onError }: Props) {
  const [scriptsReady, setScriptsReady] = useState({ gis: false, gapi: false });
  const [status, setStatus] = useState<"idle" | "authorizing" | "picking" | "reading">("idle");
  const [error, setError] = useState<string | null>(null);
  // Set when the page cap in lib/pdfLimits.ts trimmed the document —
  // a partial read that stayed silent would look like the AI ignoring content.
  const [notice, setNotice] = useState<string | null>(null);

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const ready = scriptsReady.gis && scriptsReady.gapi;

  async function driveErrorMessage(res: Response, token: string): Promise<string> {
    const body = await res.text().catch(() => "");
    let detail = body;
    try {
      detail = JSON.parse(body)?.error?.message ?? body;
    } catch {
      // response wasn't JSON — fall back to the raw body text
    }

    // Temporary diagnostic (6.4-adjacent debugging, not a permanent call) —
    // confirms what scope the token actually carries, since a JIT grant that
    // silently didn't register looks identical to a wrong-scope token from
    // the outside.
    let scopeInfo = "";
    try {
      const tokenInfoRes = await fetch(
        `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(token)}`
      );
      const tokenInfo = await tokenInfoRes.json().catch(() => null);
      scopeInfo = tokenInfo?.scope ? ` [token scope: ${tokenInfo.scope}]` : ` [tokeninfo: ${tokenInfoRes.status}]`;
    } catch {
      scopeInfo = " [tokeninfo lookup failed]";
    }

    return `Could not read that file from Drive (HTTP ${res.status}${detail ? `: ${detail}` : ""})${scopeInfo}`;
  }

  async function extractFromDoc(fileId: string, mimeType: string, token: string): Promise<string> {
    // supportsAllDrives is required for files that live in a Shared Drive —
    // common for school Workspace accounts — and is harmless for regular
    // My Drive files.
    if (mimeType === GOOGLE_DOC_MIME || mimeType === GOOGLE_SLIDES_MIME) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(await driveErrorMessage(res, token));
      return await res.text();
    }

    if (mimeType === PDF_MIME) {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(await driveErrorMessage(res, token));
      const bytes = await res.arrayBuffer();

      setStatus("reading");
      // Parsed here rather than POSTed to a route: a serverless request body
      // caps at a few megabytes, so sending the bytes meant the platform
      // rejected anything larger with a bare 413 before our own size check
      // could produce a sensible message. The browser already has the file.
      const parsed = await extractPdfTextInBrowser(bytes);

      if (!parsed.hasText) {
        throw new Error(
          "That PDF has no selectable text — it looks scanned. Try a text-based PDF."
        );
      }
      if (
        parsed.pageCount !== null &&
        parsed.pagesRead !== null &&
        parsed.pagesRead < parsed.pageCount
      ) {
        setNotice(`Read the first ${parsed.pagesRead} of ${parsed.pageCount} pages.`);
      }
      return parsed.text;
    }

    throw new Error("Unsupported file type — pick a Google Doc, Slides, or PDF");
  }

  function openPicker(token: string) {
    window.gapi!.load("picker", () => {
      // The Picker JS API is loaded as a side effect onto window.google.picker;
      // there's no typed entry point, so this stays untyped at the boundary.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const picker = (window.google as any).picker;
      const view = new picker.DocsView()
        .setIncludeFolders(false)
        .setMimeTypes([GOOGLE_DOC_MIME, GOOGLE_SLIDES_MIME, PDF_MIME].join(","));

      // The Google Cloud project number that the just-in-time drive.file
      // access grant is registered against — it's the numeric prefix of the
      // OAuth Client ID (e.g. "821896810739" in
      // "821896810739-xxxx.apps.googleusercontent.com"), so no separate
      // config value is needed for it.
      const appId = clientId?.split("-")[0];

      const built = new picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setOrigin(window.location.origin)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .setCallback(async (data: any) => {
          if (data.action !== picker.Action.PICKED) {
            if (data.action === picker.Action.CANCEL) setStatus("idle");
            return;
          }
          const doc = data.docs[0];
          try {
            setStatus("reading");
            const text = await extractFromDoc(doc.id, doc.mimeType, token);
            onError?.(null);
            onAttached(text, doc.name);
            setStatus("idle");
          } catch (err) {
            const message = err instanceof Error ? err.message : "Could not read that file";
            setNotice(null);
            setError(message);
            onError?.(message);
            setStatus("idle");
          }
        })
        .build();

      setStatus("picking");
      built.setVisible(true);
    });
  }

  function handleClick() {
    setError(null);
    setNotice(null);
    onError?.(null);
    if (!ready || !clientId || !apiKey) {
      setError("Drive attach isn't configured yet.");
      return;
    }

    setStatus("authorizing");
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          setError("Drive access was not granted");
          setStatus("idle");
          return;
        }
        openPicker(resp.access_token);
      },
    });
    tokenClient.requestAccessToken();
  }

  return (
    <div className="flex flex-col gap-1">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setScriptsReady((s) => ({ ...s, gis: true }))}
      />
      <Script
        src="https://apis.google.com/js/api.js"
        strategy="afterInteractive"
        onReady={() => setScriptsReady((s) => ({ ...s, gapi: true }))}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={handleClick}
          disabled={!ready || status !== "idle"}
          className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-text-body hover:bg-bg-subtle transition-colors disabled:opacity-50"
        >
          {status === "idle" && (attachedFileName ? "Change attached file" : "Attach a file from Drive")}
          {status === "authorizing" && "Waiting for Google..."}
          {status === "picking" && "Choose a file..."}
          {status === "reading" && "Reading file..."}
        </button>
        {attachedFileName && (
          <button type="button" onClick={onClear} className="text-sm text-text-muted hover:text-danger underline">
            Remove
          </button>
        )}
      </div>
      {error && <p className="text-danger text-sm">{error}</p>}
      {!error && notice && <p className="text-text-muted text-sm">{notice}</p>}
    </div>
  );
}
