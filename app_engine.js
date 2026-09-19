"use strict";
/* ============================================================
   PRAXIS V6 — MOTOR NATIVO UNIFICADO PARA GEMINI
   ============================================================ */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const STORAGE_KEY = 'praxis_gemini.cfg';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const PREFERRED_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-pro-latest'
];

const overloadedCooldowns = {};

let cachedModels = [];

/* Estado global de la aplicación */
const S = {
  key: '',
  model: 'gemini-3.5-flash-lite',
  customModel: '',
  audience: 'doctor',
  depth: 'profunda',
  tools: { web: true, pdf: true, zip: false, code: false },
  files: [],
  running: false,
  abort: null,
  lastRun: null
};

const AUD_LABEL = {
  doctor: 'Doctores en Matemáticas',
  maestro: 'Maestros de Matemáticas',
  licenciatura: 'Estudiantes de Licenciatura en Matemáticas',
  publico: 'Público en General'
};
const DEPTH_LABEL = { breve: 'Breve', media: 'Media', profunda: 'Profunda' };

/* Utilidades básicas */
const esc = s => String(s == null ? '' : s).replace(/[&<>\"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => 'id' + Math.random().toString(36).slice(2, 9);
function now() { return new Date().toLocaleTimeString(); }

function toast(msg, ms = 2800) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), ms);
}

function debounce(fn, ms) {
  let h;
  return (...a) => { clearTimeout(h); h = setTimeout(() => fn(...a), ms); };
}

async function typeset(el) {
  if (window.MathJax && MathJax.typesetPromise) {
    try { await MathJax.typesetPromise(el ? [el] : undefined); } catch (e) {}
  }
}

function download(name, text, mime = 'text/plain') {
  try {
    const b = new Blob([text], { type: mime + ';charset=utf-8' });
    const u = URL.createObjectURL(b);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = u;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
      URL.revokeObjectURL(u);
    }, 60000);
  } catch (err) {
    console.error('Error al descargar:', err);
    toast('Error en descarga: ' + err.message);
  }
}

function unique(arr) {
  const out = [], seen = {};
  for (let i = 0; i < arr.length; i++) {
    const v = String(arr[i] || '').trim();
    if (v && !seen[v]) { seen[v] = 1; out.push(v); }
  }
  return out;
}

function validKey(k) {
  k = String(k || '').trim();
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(k) || /^AQ\.[A-Za-z0-9_.-]{20,}$/.test(k);
}

/* Diagnóstico en panel y consola */
function log(msg) {
  const text = typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2);
  const logEl = $('#pfpLog');
  if (logEl) {
    logEl.textContent += '[' + now() + '] ' + text + '\n\n';
    logEl.scrollTop = logEl.scrollHeight;
  }
  console.log('[Praxis v6]', msg);
}

function setPanelStatus(type, msg) {
  const el = $('#pfpStatus');
  if (!el) return;
  el.className = 'pfp-status ' + type;
  el.textContent = msg;
}

function friendlyError(e) {
  const msg = String(e && e.message || e || 'Error desconocido');
  const status = e && e.status;
  if (/Failed to fetch|NetworkError|Load failed|CORS/i.test(msg)) {
    return 'Error de red o CORS. Abre la URL en GitHub Pages o servidor web, no directo desde visor local restringido. Detalle: ' + msg;
  }
  if (status === 400) return 'HTTP 400: Petición inválida (revisar JSON o modelo). Detalle: ' + msg;
  if (status === 401) return 'HTTP 401: API Key inválida o no autorizada. Crea una nueva en Google AI Studio. Detalle: ' + msg;
  if (status === 403) return 'HTTP 403: Permiso denegado (revisa restricciones de clave, proyecto o cuota). Detalle: ' + msg;
  if (status === 404) return 'HTTP 404: El modelo solicitado no está disponible. Usa el botón "Listar modelos". Detalle: ' + msg;
  if (status === 429) return 'HTTP 429: Cuota excedida o rate limit alcanzado. Espera un momento o cambia de modelo.';
  if (status === 503 || /high demand/i.test(msg)) return 'HTTP 503: El modelo está saturado temporalmente por alta demanda. Cambia a gemini-2.5-flash o gemini-flash-latest.';
  if (status >= 500) return 'HTTP ' + status + ': Error temporal en los servidores de Google. Reintenta con otro modelo.';
  return msg;
}

/* Persistencia y sincronización de configuración */
function saveCfg() {
  try {
    const payload = {
      key: validKey(S.key) ? S.key : '',
      model: S.model,
      customModel: S.customModel,
      audience: S.audience,
      depth: S.depth,
      tools: S.tools
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {}
}

function loadCfg() {
  try {
    const c = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (validKey(c.key)) S.key = c.key;
    if (c.model && c.model !== 'gemini-2.0-flash-exp') S.model = c.model;
    if (typeof c.customModel === 'string') S.customModel = c.customModel;
    if (c.audience) S.audience = c.audience;
    if (c.depth) S.depth = c.depth;
    if (c.tools) S.tools = c.tools;
  } catch (e) {}
}

/* Parseo robusto de respuestas JSON */
function sanitizeJsonLatex(raw) {
  let out = '';
  let inStr = false;
  let i = 0;
  const len = raw.length;

  while (i < len) {
    const ch = raw[i];
    if (inStr) {
      if (ch === '"') {
        inStr = false;
        out += ch;
        i++;
      } else if (ch === '\\') {
        if (i + 1 < len) {
          const nextCh = raw[i + 1];
          if (nextCh === '\\') {
            out += '\\\\';
            i += 2;
          } else if (nextCh === '"') {
            out += '\\"';
            i += 2;
          } else if (nextCh === 'u' && i + 5 < len && /^[0-9a-fA-F]{4}$/.test(raw.slice(i + 2, i + 6))) {
            out += raw.slice(i, i + 6);
            i += 6;
          } else if ('bfnrt'.includes(nextCh) && (i + 2 < len && /[a-zA-Z]/.test(raw[i + 2]))) {
            out += '\\\\' + nextCh;
            i += 2;
          } else if ('nrt'.includes(nextCh)) {
            out += '\\' + nextCh;
            i += 2;
          } else {
            out += '\\\\' + nextCh;
            i += 2;
          }
        } else {
          out += '\\\\';
          i++;
        }
      } else {
        out += ch;
        i++;
      }
    } else {
      if (ch === '"') inStr = true;
      out += ch;
      i++;
    }
  }
  return out;
}

function extractJSON(text) {
  if (!text) throw new Error('Respuesta vacía');
  let t = String(text).trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const first = t.search(/[\[{]/);
  if (first >= 0) {
    t = t.slice(first);
  }

  try { return JSON.parse(t); } catch (e) {}

  const sanitized = sanitizeJsonLatex(t);
  try { return JSON.parse(sanitized); } catch (e) {}
  try { return JSON.parse(sanitized.replace(/,\s*([\]}])/g, '$1')); } catch (e) {}

  let inStr = false, escCh = false;
  const stack = [];
  for (let i = 0; i < sanitized.length; i++) {
    const ch = sanitized[i];
    if (inStr) {
      if (escCh) escCh = false;
      else if (ch === '\\') escCh = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === '{') stack.push('}');
      else if (ch === '[') stack.push(']');
      else if (ch === '}' || ch === ']') {
        if (stack.length && stack[stack.length - 1] === ch) stack.pop();
      }
    }
  }

  let repaired = sanitized;
  if (inStr) repaired += '"';
  while (stack.length) repaired += stack.pop();

  try { return JSON.parse(repaired); } catch (e) {}
  try { return JSON.parse(repaired.replace(/,\s*([\]}])/g, '$1')); } catch (e2) {
    throw new Error('La IA no devolvió JSON válido (revisar formato LaTeX): ' + String(e2.message || e2).slice(0, 140));
  }
}

/* ============================================================
   CLIENTE NATIVO DE GEMINI V6 (Dual Auth + Auto Fallback)
   ============================================================ */
async function rawFetch(url, init, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => {
    try { ctrl.abort(); } catch (e) {}
  }, timeoutMs);

  if (init && init.signal) {
    init.signal.addEventListener('abort', () => {
      try { ctrl.abort(); } catch (e) {}
    });
  }

  try {
    const fetchInit = Object.assign({}, init, { signal: ctrl.signal });
    const res = await fetch(url, fetchInit);
    clearTimeout(timer);
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (e) {}
    if (!res.ok) {
      const msg = (json && json.error && json.error.message) || text.slice(0, 600) || res.statusText;
      const err = new Error('HTTP ' + res.status + ': ' + msg);
      err.status = res.status;
      err.json = json;
      err.text = text;
      throw err;
    }
    return json || {};
  } catch (e) {
    clearTimeout(timer);
    if (e && e.name === 'AbortError') {
      if (init && init.signal && init.signal.aborted) throw e;
      const toErr = new Error('Tiempo de espera agotado (' + Math.round(timeoutMs / 1000) + 's). El servidor no respondió a tiempo.');
      toErr.status = 504;
      toErr.isTimeout = true;
      throw toErr;
    }
    throw e;
  }
}

async function fetchModels() {
  const key = (S.key || '').trim();
  if (!validKey(key)) throw new Error('Falta una API key válida para listar modelos (AIza... o AQ...).');
  const baseUrl = API_BASE + '/models?pageSize=200';
  let json = null;

  try {
    json = await rawFetch(baseUrl, { method: 'GET', mode: 'cors', headers: { 'x-goog-api-key': key } }, 12000);
  } catch (e) {
    const sep = baseUrl.includes('?') ? '&' : '?';
    const queryUrl = baseUrl + sep + 'key=' + encodeURIComponent(key);
    log('GET /models vía header falló, intentando con parámetro key...');
    json = await rawFetch(queryUrl, { method: 'GET', mode: 'cors' }, 12000);
  }

  const models = Array.isArray(json.models) ? json.models : [];
  const parsed = models.map(m => {
    const name = String(m.name || '').replace(/^models\//, '').trim();
    const methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
    return { name, methods };
  }).filter(m => !!m.name);

  const excludeKeywords = [
    'antigravity', 'deep-research', 'banana', 'aqa', 'embedding', 'image',
    'audio', 'tts', 'transcribe', 'live', 'clip', 'veo', 'lyria', 'robotics', 'er-2'
  ];

  const textSuitable = parsed.filter(m => {
    const supportsGen = m.methods.length ? (m.methods.includes('generateContent') || m.methods.includes('streamGenerateContent')) : true;
    const hasExclude = excludeKeywords.some(kw => m.name.toLowerCase().includes(kw));
    return supportsGen && !hasExclude;
  }).map(m => m.name);

  cachedModels = unique(textSuitable);

  cachedModels.sort((a, b) => {
    let ia = PREFERRED_MODELS.indexOf(a), ib = PREFERRED_MODELS.indexOf(b);
    if (ia < 0) ia = 999;
    if (ib < 0) ib = 999;
    if (ia !== ib) return ia - ib;
    return String(a).localeCompare(String(b));
  });

  if (!cachedModels.length) {
    cachedModels = PREFERRED_MODELS.slice();
  }

  let preferredFound = PREFERRED_MODELS.find(pm => cachedModels.includes(pm));
  if (!cachedModels.includes(S.model)) {
    S.model = preferredFound || cachedModels[0];
  }

  updateModelSelect();
  saveCfg();
  updateConn();
  return cachedModels;
}

async function callGemini(prompt, opts = {}) {
  const key = (S.key || '').trim();
  if (!validKey(key)) throw new Error('Falta una API key válida. Debe comenzar con AIza... o AQ...');

  const nowMs = Date.now();
  for (const m in overloadedCooldowns) {
    if (overloadedCooldowns[m] <= nowMs) delete overloadedCooldowns[m];
  }

  const activeModel = S.model === 'custom' ? (S.customModel || PREFERRED_MODELS[0]) : S.model;
  let candidates = unique([activeModel].concat(cachedModels.length ? cachedModels : PREFERRED_MODELS));

  candidates.sort((a, b) => {
    const aOver = overloadedCooldowns[a] ? 1 : 0;
    const bOver = overloadedCooldowns[b] ? 1 : 0;
    return aOver - bOver;
  });
  candidates = candidates.slice(0, 8);

  const ctrl = new AbortController();
  S.abort = ctrl;
  let lastError = null;

  for (let ci = 0; ci < candidates.length; ci++) {
    const model = candidates[ci];
    const base = API_BASE + '/models/' + encodeURIComponent(model) + ':generateContent';
    let modelUnavailable = false;
    const authModes = ['header', 'query'];

    for (let ai = 0; ai < authModes.length; ai++) {
      if (modelUnavailable) break;
      const auth = authModes[ai];
      const jsonAttempts = opts.json === false ? [false] : [true, false];

      for (let ji = 0; ji < jsonAttempts.length; ji++) {
        const useJson = jsonAttempts[ji];
        const url = auth === 'query' ? base + '?key=' + encodeURIComponent(key) : base;
        const headers = { 'Content-Type': 'application/json' };
        if (auth === 'header') headers['x-goog-api-key'] = key;

        const maxTokens = opts.max_tokens != null ? opts.max_tokens : (opts.isTest ? 50 : 16384);
        const generationConfig = {
          temperature: opts.temperature != null ? opts.temperature : 0.4,
          topP: opts.topP != null ? opts.topP : 0.95,
          maxOutputTokens: maxTokens
        };
        if (useJson) generationConfig.responseMimeType = 'application/json';

        const body = {
          contents: [{ parts: [{ text: String(prompt || '') }] }],
          generationConfig
        };

        try {
          const timeoutMs = opts.timeout != null ? opts.timeout : (opts.isTest ? 12000 : 35000);
          const json = await rawFetch(url, {
            method: 'POST',
            mode: 'cors',
            headers,
            body: JSON.stringify(body),
            signal: ctrl.signal
          }, timeoutMs);

          if (S.model !== 'custom') {
            S.model = model;
            const sel = $('#model');
            if (sel && sel.value !== model) sel.value = model;
          }
          saveCfg();
          updateConn();

          const cand = json.candidates && json.candidates[0];
          if (!cand) throw new Error('Gemini no devolvió candidatos válidos.');

          if (cand.finishReason === 'MAX_TOKENS') {
            log('⚠️ Aviso: ' + model + ' alcanzó el límite de tokens. Auto-reparando JSON...');
          }

          const parts = cand.content && cand.content.parts ? cand.content.parts : [];
          const text = parts.map(p => (p && p.text) ? p.text : '').join('');
          if (!text.trim()) throw new Error('Gemini devolvió texto vacío.');
          return text;
        } catch (e) {
          lastError = e;
          if (e && e.name === 'AbortError' && ctrl.signal.aborted) throw e;
          const msg = String(e && e.message || '');

          if (e && (e.status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg))) {
            overloadedCooldowns[model] = Date.now() + 60000;
            log('⚠️ ' + model + ' alcanzó su límite de cuota/RPM (HTTP 429). Conmutando automáticamente al siguiente modelo disponible...');
            setStat('run', 'Conmutando por cuota (429)…');
            setPanelStatus('warn', '429 en ' + model + '. Probando alternativo...');
            modelUnavailable = true;
            await new Promise(r => setTimeout(r, 2000));
            break;
          }

          if (e && (e.status === 503 || e.status === 502 || e.status === 504 || e.status === 500 || e.isTimeout || /high demand|temporarily unavailable|overloaded/i.test(msg))) {
            overloadedCooldowns[model] = Date.now() + 60000;
            log('⚠️ ' + model + ' con saturación (HTTP 503/Timeout). Pasando de inmediato al siguiente modelo...');
            setStat('run', 'Probando modelo alternativo…');
            setPanelStatus('run', '503 en ' + model + '. Saltando...');
            modelUnavailable = true;
            break;
          }

          if (e && e.status === 404 && /model|NOT_FOUND|no longer available/i.test(msg)) {
            log('⚠️ ' + model + ' no disponible (HTTP 404). Pasando al siguiente candidato...');
            modelUnavailable = true;
            break;
          }

          if (e && e.status === 400 && useJson && /responseMimeType|JSON/i.test(msg)) {
            log(model + ' rechazó responseMimeType JSON. Reintentando en modo texto...');
            continue;
          }

          if (auth === 'header' && e.status) {
            if (e.status === 401 || e.status === 403) {
              throw new Error(friendlyError(e));
            }
            break;
          }

          log('Reintento: model=' + model + ', auth=' + auth + ', json=' + useJson + ', err=' + msg);
        }
      }
    }
  }
  throw new Error(friendlyError(lastError));
}

async function askJSON(prompt, opts = {}) {
  const raw = await callGemini(prompt, Object.assign({ json: true }, opts));
  return extractJSON(raw);
}

/* ============================================================
    ... resto del archivo tras la eliminación de secretos ...
   ============================================================ */

// El resto del archivo queda intacto, sin ninguna clave precargada ni valores sensibles

