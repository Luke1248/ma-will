// LLM provider layer. Two wire formats cover everything:
//   'anthropic' — Claude Messages API, called directly from the browser.
//   'openai'    — any OpenAI-compatible /chat/completions endpoint: OpenAI,
//                 OpenRouter, Groq, Together, Gemini's compat endpoint, and
//                 local servers (Ollama, LM Studio, llama.cpp, vLLM).
// Keys are stored only in this device's localStorage and sent only to the
// endpoint the profile names.

export const PRESETS = [
  { id: 'anthropic', label: 'Anthropic (Claude)', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-opus-5-5',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-2'] },
  { id: 'openai', label: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: '' },
  { id: 'openrouter', label: 'OpenRouter (open-weight + hosted models)', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: '' },
  { id: 'groq', label: 'Groq', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: '' },
  { id: 'together', label: 'Together AI', kind: 'openai', baseUrl: 'https://api.together.xyz/v1', model: '' },
  { id: 'gemini', label: 'Google Gemini (OpenAI-compatible)', kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: '' },
  { id: 'ollama', label: 'Ollama (local)', kind: 'openai', baseUrl: 'http://localhost:11434/v1', model: '' },
  { id: 'lmstudio', label: 'LM Studio (local)', kind: 'openai', baseUrl: 'http://localhost:1234/v1', model: '' },
  { id: 'custom', label: 'Custom OpenAI-compatible endpoint', kind: 'openai', baseUrl: '', model: '' },
];

const KEY = 'concordat.profiles';
export function loadProfiles() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
export function saveProfiles(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ } }

const trimUrl = (u) => String(u || '').trim().replace(/\/+$/, '');
const FALLBACK_OK = /^claude-(fable-5-[12]|opus-5(-5)?|sonnet-5-5)$/;

async function postJson(url, headers, body, signal) {
  let res;
  try { res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), signal }); }
  catch (e) {
    const local = /^http:\/\//.test(url) && typeof location !== 'undefined' && location.protocol === 'https:';
    throw new Error(local ? 'Blocked: this app is served over HTTPS and cannot call a plain http:// endpoint. Expose the model server over HTTPS (see README).' : `Network/CORS error reaching ${new URL(url).host}: ${e.message}`);
  }
  let data = null; const text = await res.text();
  try { data = JSON.parse(text); } catch { /* non-JSON body */ }
  if (!res.ok) {
    const msg = (data && data.error && (data.error.message || data.error)) || text.slice(0, 200);
    const err = new Error(`${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`); err.status = res.status; throw err;
  }
  return data;
}

async function anthropicChat(pr, system, user, signal) {
  const headers = { 'x-api-key': pr.apiKey || '', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
  const body = { model: pr.model, max_tokens: 16000, system, messages: [{ role: 'user', content: user }] };
  const url = trimUrl(pr.baseUrl || 'https://api.anthropic.com') + '/v1/messages';
  let data;
  if (FALLBACK_OK.test(pr.model)) {
    // Let the API re-run a declined request on a fallback model.
    try { data = await postJson(url, { ...headers, 'anthropic-beta': 'server-side-fallback-2026-07-01' }, { ...body, fallbacks: 'default' }, signal); }
    catch (e) { if (e.status !== 400) throw e; }
  }
  if (!data) data = await postJson(url, headers, body, signal);
  if (data.stop_reason === 'refusal') throw new Error('The model declined this request.');
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
}

async function openaiChat(pr, system, user, signal) {
  const headers = pr.apiKey ? { authorization: `Bearer ${pr.apiKey}` } : {};
  const body = { model: pr.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  const data = await postJson(trimUrl(pr.baseUrl) + '/chat/completions', headers, body, signal);
  const m = data.choices && data.choices[0] && data.choices[0].message;
  const c = m && m.content;
  return Array.isArray(c) ? c.map((x) => x.text || '').join('') : (c || '');
}

export async function chat(profile, system, user, { timeoutMs = 180000 } = {}) {
  if (!profile || !profile.model) throw new Error('No model selected for this profile.');
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try { return await (profile.kind === 'anthropic' ? anthropicChat : openaiChat)(profile, system, user, ctl.signal); }
  finally { clearTimeout(timer); }
}

// Pull the last balanced JSON object out of a reply (tolerates prose, code
// fences and <think> blocks from reasoning models).
export function extractJson(text) {
  const s = String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  for (let end = s.lastIndexOf('}'); end >= 0; end = s.lastIndexOf('}', end - 1)) {
    let depth = 0, inStr = false;
    for (let i = end; i >= 0; i--) {
      const ch = s[i];
      if (ch === '"' && s[i - 1] !== '\\') inStr = !inStr;
      if (inStr) continue;
      if (ch === '}') depth++;
      if (ch === '{' && --depth === 0) { try { return JSON.parse(s.slice(i, end + 1)); } catch { break; } }
    }
  }
  return null;
}

export async function chatJson(profile, system, user, opts) {
  const text = await chat(profile, system, user, opts);
  const obj = extractJson(text);
  if (!obj) throw new Error('Model reply contained no JSON object.');
  return obj;
}

export async function listModels(pr) {
  const get = async (url, headers) => {
    const res = await fetch(url, { headers }); if (!res.ok) throw new Error(`${res.status}`);
    const d = await res.json(); return (d.data || d.models || []).map((m) => m.id || m.name).filter(Boolean);
  };
  if (pr.kind === 'anthropic') return get(trimUrl(pr.baseUrl || 'https://api.anthropic.com') + '/v1/models?limit=100', { 'x-api-key': pr.apiKey || '', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' });
  return get(trimUrl(pr.baseUrl) + '/models', pr.apiKey ? { authorization: `Bearer ${pr.apiKey}` } : {});
}

export async function testProfile(pr) {
  const t = await chat(pr, 'You are a connection test.', 'Reply with the single word: ready', { timeoutMs: 60000 });
  return t.trim().slice(0, 80);
}
