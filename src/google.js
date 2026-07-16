// Client-side Google OAuth (Google Identity Services token flow) — no backend,
// no client secret. The user supplies their own OAuth Client ID (created in
// their own Google Cloud project; see README) and grants read-only access to
// Drive (to list docs) and Docs (to read word counts) directly from the browser.

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/documents.readonly',
].join(' ');

let tokenClient = null;
let accessToken = null;

export function isGoogleLibLoaded() {
  return typeof window.google !== 'undefined' && window.google.accounts;
}

export function initTokenClient(clientId, onToken) {
  if (!isGoogleLibLoaded()) {
    throw new Error('Google Identity Services library has not loaded yet.');
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (resp) => {
      if (resp.error) {
        console.error('OVERWATCH: Google auth error', resp);
        return;
      }
      accessToken = resp.access_token;
      onToken(accessToken);
    },
  });
}

export function requestAccessToken() {
  if (!tokenClient) throw new Error('Token client not initialized — set a Client ID in SETTINGS first.');
  tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
}

export function getAccessToken() {
  return accessToken;
}

export async function listGoogleDocs() {
  if (!accessToken) throw new Error('Not connected to Google yet.');
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.document' and trashed=false");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc&pageSize=50`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Drive API error: ${res.status}`);
  const data = await res.json();
  return data.files || [];
}

function extractText(doc) {
  let text = '';
  const content = doc.body?.content || [];
  for (const el of content) {
    const elements = el.paragraph?.elements || [];
    for (const e of elements) {
      if (e.textRun?.content) text += e.textRun.content;
    }
  }
  return text;
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function fetchDoc(docId) {
  if (!accessToken) throw new Error('Not connected to Google yet.');
  const url = `https://docs.googleapis.com/v1/documents/${docId}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Docs API error: ${res.status}`);
  return res.json();
}

export async function getDocSnapshot(docId) {
  const doc = await fetchDoc(docId);
  return {
    title: doc.title,
    wordCount: countWords(extractText(doc)),
  };
}

const MAX_DOC_CHARS = 8000; // keeps a single doc read from blowing up the assistant's context/cost

// Read-only full text of a doc, for JARVIS to actually discuss/analyze — never
// used to write back. Truncated for anything long; the truncation is reported
// so JARVIS can tell the user it only saw part of the document.
export async function getDocFullText(docId) {
  const doc = await fetchDoc(docId);
  const text = extractText(doc);
  const truncated = text.length > MAX_DOC_CHARS;
  return {
    title: doc.title,
    wordCount: countWords(text),
    text: truncated ? text.slice(0, MAX_DOC_CHARS) : text,
    truncated,
  };
}
