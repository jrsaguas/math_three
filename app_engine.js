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
  key: 'AQ.Ab8RN6JYWyOPLZqiQwAEfVhNHB5l_TRwcaCoel5SIk34y9IGBw', // Clave precargada
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
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
          // Ya escapada: \\
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
            // Comando LaTeX como \frac, \beta, \nabla, \rho, \theta (la siguiente letra es alfabética)
            out += '\\\\' + nextCh;
            i += 2;
          } else if ('nrt'.includes(nextCh)) {
            // Saltos de línea o tabuladores estándar
            out += '\\' + nextCh;
            i += 2;
          } else {
            // Cualquier otro caracter LaTeX como \int, \alpha, \partial, \sum, etc.
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

  const first = t.search(/[{\[]/);
  if (first >= 0) {
    t = t.slice(first);
  }

  // 1. Intento parseo directo
  try { return JSON.parse(t); } catch (e) {}

  // 2. Sanitizar escapes LaTeX (p. ej. \int, \frac, \alpha que rompen JSON.parse)
  const sanitized = sanitizeJsonLatex(t);
  try { return JSON.parse(sanitized); } catch (e) {}
  try { return JSON.parse(sanitized.replace(/,\s*([}\]])/g, '$1')); } catch (e) {}

  // 3. Auto-reparación por truncamiento (MAX_TOKENS): cerrar comillas y corchetes pendientes
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
  try { return JSON.parse(repaired.replace(/,\s*([}\]])/g, '$1')); } catch (e2) {
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

  // Excluir modelos que NO son para chat/texto matemático o solo soportan Interactions API / Media
  const excludeKeywords = [
    'antigravity', 'deep-research', 'banana', 'aqa', 'embedding', 'image',
    'audio', 'tts', 'transcribe', 'live', 'clip', 'veo', 'lyria', 'robotics', 'er-2'
  ];

  const textSuitable = parsed.filter(m => {
    // Debe soportar generateContent explícitamente si methods está poblado
    const supportsGen = m.methods.length ? (m.methods.includes('generateContent') || m.methods.includes('streamGenerateContent')) : true;
    const hasExclude = excludeKeywords.some(kw => m.name.toLowerCase().includes(kw));
    return supportsGen && !hasExclude;
  }).map(m => m.name);

  cachedModels = unique(textSuitable);

  // Ordenar priorizando los modelos más estables y verificados
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

  // Mover modelos con 503 reciente al final
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

        // Ampliamos maxOutputTokens para no cortar respuestas complejas
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

          // Modelo exitoso -> actualizar estado y selector visual
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

          // HTTP 429 (Cuota excedida o Rate Limit de este modelo) -> No colapsar: pausar 2s, marcar cooldown y saltar al siguiente modelo
          if (e && (e.status === 429 || /RESOURCE_EXHAUSTED|quota|rate limit/i.test(msg))) {
            overloadedCooldowns[model] = Date.now() + 60000;
            log('⚠️ ' + model + ' alcanzó su límite de cuota/RPM (HTTP 429). Conmutando automáticamente al siguiente modelo disponible...');
            setStat('run', 'Conmutando por cuota (429)…');
            setPanelStatus('warn', '429 en ' + model + '. Probando alternativo...');
            modelUnavailable = true;
            await new Promise(r => setTimeout(r, 2000));
            break;
          }

          // HTTP 503 / 500 / 502 / 504 o Timeout -> Modelo saturado, marcar cooldown de 60s y saltar al siguiente
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
   CAPA EPISTÉMICA DE MECANISMOS MATEMÁTICOS (KNOWLEDGE LAYER)
   ============================================================ */
const PRAXIS_KNOWLEDGE_BASE = {
  "vector": {
    id: "vector",
    nombre: "Vector y Estructuras Vectoriales",
    dominio: "Álgebra Lineal & Geometría Diferencial",
    icono: "↗",
    definicion_axiomatica: "Elemento de un espacio vectorial (V, +, ·) sobre un cuerpo K que satisface los 8 axiomas de linealidad (conmutatividad, asociatividad, elemento neutro, inverso aditivo, distributividades respecto a suma vectorial y compatibilidad de escalares).",
    representaciones: {
      algebraica: "Tupla euclidiana v = (v₁, v₂, ..., vₙ) ∈ ℝⁿ o vector columna en M_{n×1}(ℝ): v = [v₁, v₂, ..., vₙ]ᵀ.",
      geometrica: "Segmento de recta orientado (flecha) en el espacio afín caracterizado por punto de aplicación, magnitud/norma ||v||, dirección (ángulo polar θ) y sentido.",
      operacional: "Derivación sobre el álgebra de funciones suaves C^∞(M) en un punto p (vector tangente v = ∑ vⁱ ∂/∂xⁱ|ₚ) o generador infinitesimal de traslaciones.",
      fisica: "Magnitud física orientada invariante bajo rotaciones del sistema de coordenadas (ej. velocidad, momento lineal, gradiente de potencial).",
      latex: "\\mathbf{v} = \\begin{pmatrix} v_1 \\\\ v_2 \\end{pmatrix}, \\quad \\|\\mathbf{v}\\| = \\sqrt{\\langle \\mathbf{v}, \\mathbf{v} \\rangle} = \\sqrt{v_1^2 + v_2^2}"
    },
    propiedades_clave: [
      "Independencia lineal y bases: todo vector se expresa de forma única como combinación lineal v = ∑ cᵢ eᵢ.",
      "Producto interno canónico y ortogonalidad: ⟨u, v⟩ = uᵀ v = ||u|| ||v|| cos θ. Si ⟨u, v⟩ = 0, los vectores son ortogonales.",
      "Desigualdad de Cauchy-Schwarz: |⟨u, v⟩| ≤ ||u|| ||v||."
    ]
  },
  "matriz_operador": {
    id: "matriz_operador",
    nombre: "Matriz y Operador Lineal",
    dominio: "Álgebra Lineal & Teoría de Operadores",
    icono: "⊞",
    definicion_axiomatica: "Homomorfismo entre espacios vectoriales T: V → W tal que T(αu + βv) = αT(u) + βT(v), representado unívocamente en bases dadas por una matriz A = (a_{ij}) ∈ M_{m×n}(K).",
    representaciones: {
      algebraica: "Arreglo bidimensional A = [a_{ij}], producto matricial (AB)_{ij} = ∑ a_{ik} b_{kj}.",
      geometrica: "Deformación continua del espacio afín: las columnas de A representan las imágenes de los vectores unitarios de la base canónica T(e₁), ..., T(eₙ). El determinante det(A) representa el factor de dilatación/inversión de volumen orientado.",
      operacional: "Operador diferencial lineal L[u] = A u, generador de flujos en sistemas dinámicos continuos X' = AX.",
      latex: "A = \\begin{pmatrix} a_{11} & a_{12} \\\\ a_{21} & a_{22} \\end{pmatrix} \\in \\mathcal{M}_2(\\mathbb{R}), \\quad \\det(A) = a_{11}a_{22} - a_{12}a_{21}"
    },
    propiedades_clave: [
      "Teorema del rango y nulidad: dim(V) = dim(ker T) + dim(im T).",
      "Invertibilidad: det(A) ≠ 0 ⟺ ker T = {0} ⟺ T es un isomorfismo.",
      "Invariantes canónicos: la traza tr(A) y el determinante det(A) son invariantes bajo transformaciones de semejanza P⁻¹AP."
    ]
  },
  "espectro_eigenvalores": {
    id: "espectro_eigenvalores",
    nombre: "Espectro y Subespacios Invariantes",
    dominio: "Álgebra Lineal & Dinámica Espectral",
    icono: "λ",
    definicion_axiomatica: "El espectro σ(A) es el conjunto de escalares λ ∈ ℂ tales que el operador (A - λI) no es biyectivo, satisfaciendo Av = λv para algún vector propio no nulo v ≠ 0.",
    representaciones: {
      algebraica: "Conjunto de raíces del polinomio característico secular p(λ) = det(λI - A) = 0.",
      geometrica: "Direcciones puramente dilatadas o comprimidas sin rotación espacial (para eigenvalores reales). Para eigenvalores complejos conjugados α ± iβ, generan rotaciones puras (si α=0) o espirales logarítmicas (si α≠0).",
      latex: "A \\mathbf{v} = \\lambda \\mathbf{v}, \\quad p(\\lambda) = \\det(\\lambda I - A) = \\lambda^2 - \\operatorname{tr}(A)\\lambda + \\det(A) = 0"
    },
    propiedades_clave: [
      "Multiplicidad algebraica vs geométrica: mg(λ) ≤ ma(λ).",
      "Diagonalizabilidad: A es diagonalizable sobre K si y solo si la suma de las multiplicidades geométricas iguala n.",
      "Teorema de Cayley-Hamilton: toda matriz cuadrada satisface su propia ecuación característica p(A) = 0."
    ]
  },
  "sistema_dinamico": {
    id: "sistema_dinamico",
    nombre: "Sistema Dinámico Autónomo y Retrato de Fase",
    dominio: "Ecuaciones Diferenciales Ordinarias",
    icono: "∮",
    definicion_axiomatica: "Par (M, φₜ) donde M es una variedad suave y φₜ: M → M es una acción del grupo aditivo (ℝ, +) generada por el campo vectorial suave X' = F(X).",
    representaciones: {
      algebraica: "Sistema de EDOs acopladas dx/dt = f(x, y), dy/dt = g(x, y).",
      geometrica: "Retrato de fase: espacio topológico foliado por curvas integrales tangentes al campo vectorial en cada punto.",
      fisica: "Evolución determinista de un estado físico (mecánico, térmico o cuántico) bajo leyes invariantes ante traslaciones temporales.",
      latex: "X'(t) = A X(t), \\quad X(t) = e^{At} X_0 = \\Phi(t) X_0"
    },
    propiedades_clave: [
      "Teorema de Picard-Lindelöf: Existencia y unicidad global garantizada por Lipschitzianidad.",
      "Invarianza orbital: dos órbitas distintas jamás se intersectan en tiempo finito.",
      "Clasificación topológica de Poincaré: Nodos, sillas, focos y centros según los signos de tr(A), det(A) y el discriminante."
    ]
  },
  "funcion_lyapunov": {
    id: "funcion_lyapunov",
    nombre: "Integral Primera y Estabilidad de Lyapunov",
    dominio: "Teoría Cualitativa de EDOs & Mecánica Hamiltoniana",
    icono: "∇",
    definicion_axiomatica: "Función escalar continua y definida positiva V: U → ℝ que actúa como energía generalizada. Si dV/dt ≤ 0 a lo largo del flujo, el equilibrio es estable; si dV/dt ≡ 0, el sistema es conservativo.",
    representaciones: {
      geometrica: "Curvas o superficies de nivel compactas V(x, y) = C que atrapan las trayectorias orbitales en su interior.",
      fisica: "Hamiltoniano o energía mecánica total del sistema H(q, p) = T(p) + U(q).",
      latex: "V(x, y) = \\frac{1}{2}(x^2 + y^2), \\quad \\dot{V} = \\nabla V \\cdot F = \\frac{\\partial V}{\\partial x}\\dot{x} + \\frac{\\partial V}{\\partial y}\\dot{y} = 0"
    },
    propiedades_clave: [
      "Estabilidad orbital de Lyapunov: confinamiento eterno en una vecindad arbitraria del equilibrio.",
      "Teorema de Liouville: campos de divergencia nula ∇·F = 0 preservan el volumen de Lebesgue en el espacio de fases.",
      "Integrales primeras: toda función invariante dV/dt = 0 reduce en una unidad la dimensión efectiva del sistema dinámico."
    ]
  }
};

function getInjectedMathKnowledge(userPrompt) {
  const p = (userPrompt || '').toLowerCase();
  const selected = [];
  if (p.includes('vector') || p.includes("x'") || p.includes('x(') || p.includes('sistema') || p.includes('campo')) {
    selected.push(PRAXIS_KNOWLEDGE_BASE['vector']);
  }
  if (p.includes('matriz') || p.includes('sistema') || p.includes('operador') || p.includes('lineal') || p.includes('a =')) {
    selected.push(PRAXIS_KNOWLEDGE_BASE['matriz_operador']);
  }
  if (p.includes('espectr') || p.includes('eigen') || p.includes('valor propio') || p.includes('polinomio') || p.includes('lambda')) {
    selected.push(PRAXIS_KNOWLEDGE_BASE['espectro_eigenvalores']);
  }
  if (p.includes('dinamico') || p.includes('flujo') || p.includes('fase') || p.includes('orbita') || p.includes('edo') || p.includes('diferencial')) {
    selected.push(PRAXIS_KNOWLEDGE_BASE['sistema_dinamico']);
  }
  if (p.includes('lyapunov') || p.includes('estabilidad') || p.includes('energia') || p.includes('conservativ') || p.includes('hamilton') || p.includes('primera')) {
    selected.push(PRAXIS_KNOWLEDGE_BASE['funcion_lyapunov']);
  }
  if (!selected.length) {
    selected.push(PRAXIS_KNOWLEDGE_BASE['vector'], PRAXIS_KNOWLEDGE_BASE['matriz_operador'], PRAXIS_KNOWLEDGE_BASE['sistema_dinamico']);
  }
  return selected;
}

/* ============================================================
   PROMPTS DEL ORQUESTADOR MATEMÁTICO
   ============================================================ */
const SYSTEM_CORE = `Eres PRAXIS, un orquestador cognitivo experto en matemáticas avanzadas. Tu misión: convertir UN ejercicio matemático en una investigación profunda y rigurosa.

REGLAS ABSOLUTAS DE FORMATO Y MATEMÁTICAS:
- Responde ÚNICAMENTE con un objeto JSON válido. Sin texto fuera del JSON. Sin cercas \`\`\`.
- SINTAXIS MATEMÁTICA ESTÁNDAR Y ESTRICTA:
  * Para fórmulas en línea (inline), usa SIEMPRE $...$ (ejemplo: $f(x) = x^2$ o $A \\in M_2(\\mathbb{R})$).
  * Para fórmulas en bloque (display), usa SIEMPRE $$...$$ (ejemplo: $$X'(t) = AX(t)$$).
  * NUNCA uses \\( ni \\) para fórmulas en línea.
  * NUNCA uses \\[ ni \\] para fórmulas en bloque.
  * Escribe el LaTeX estándar limpio: \\frac{a}{b}, \\int, \\sum, \\begin{pmatrix}...\\end{pmatrix}.
  * NUNCA agregues barras de escape huérfanas en el texto (como "\\ " o saltos de línea literales rotos).
- No inventes referencias falsas.
- Explica toda la notación y tecnicismos con máximo rigor.`;

function audienceInstr(a) {
  return {
    doctor: `Audiencia: DOCTORES EN MATEMÁTICAS. Máximo rigor: enuncia hipótesis exactas, da demostraciones completas y formales, discute generalizaciones, casos límite, conexiones con estructuras avanzadas (categorías, espacios funcionales, dualidades) y señala dónde el argumento es óptimo o puede refinarse.`,
    maestro: `Audiencia: MAESTROS DE MATEMÁTICAS. Rigor sólido pero orientado a la docencia: explica el PORQUÉ de cada paso, anticipa errores frecuentes de los estudiantes, ofrece interpretaciones intuitivas y sugerencias didácticas junto al formalismo.`,
    licenciatura: `Audiencia: ESTUDIANTES DE LICENCIATURA EN MATEMÁTICAS. Razona cada paso con detalle pedagógico: no omitas justificaciones, define cada concepto nuevo en el momento que aparece, encadena la intuición con la formalización.`,
    publico: `Audiencia: PÚBLICO GENERAL. Comienza con una analogía accesible, define toda la jerga en lenguaje llano, mantén el rigor pero prioriza la claridad y la motivación sobre el tecnicismo.`
  }[a] || '';
}

function depthInstr(d) {
  return {
    breve: `Profundidad BREVE: sé conciso pero completo; agrupa pasos cuando sea natural.`,
    media: `Profundidad MEDIA: desarrollo detallado con la teoría esencial bien cubierta.`,
    profunda: `Profundidad PROFUNDA: exhaustivo. Desglosa cada micro-paso, cubre TODO el marco teórico implicado (definiciones, teoremas, lemas, axiomas, reglas, métodos, herramientas) con sus enunciados y demostraciones cuando aporten.`
  }[d] || '';
}

function promptPlanner(userPrompt, files, aud, dep) {
  const fdesc = files.length ? `\n\nFUENTES ADJUNTAS (usa su contenido como contexto; no las inventes):\n${files.map(f => `• [${f.kind}] ${f.name}${f.text ? '\n' + f.text.slice(0, 4000) : ''}`).join('\n')}` : '';
  return `${SYSTEM_CORE}

FASE 1 — PLANIFICACIÓN. Analiza el ejercicio del usuario y diseña el plan maestro.

EJERCICIO DEL USUARIO:
"""
${userPrompt}
"""${fdesc}

${audienceInstr(aud)}
${depthInstr(dep)}

Devuelve JSON con EXACTAMENTE estas claves:
{
  "titulo": "título descriptivo del problema",
  "area_principal": "rama matemática dominante",
  "ramas": ["rama1","rama2"],
  "objetivo": "qué se quiere demostrar/calcular/resolver",
  "nivel": "introductorio|intermedio|avanzado|investigación",
  "herramientas": ["nombre herramienta","uso"],
  "notacion": [{"symbolo":"\\\\LaTeX","significado":"explicación"}],
  "hipotesis": ["supuesto 1","supuesto 2"],
  "riesgos": ["posibles trampas o sutilezas del problema"],
  "estimacion_pasos": 5,
  "agente_resolucion": "instrucción específica para resolver el ejercicio",
  "agente_teoria": "instrucción sobre temas teóricos a extraer",
  "agente_figuras": "instrucción sobre qué visualizar",
  "agente_investigacion": "instrucción sobre generalizaciones"
}`;
}

function promptResolver(plan, userPrompt, aud, dep) {
  const kb = getInjectedMathKnowledge(userPrompt);
  return `${SYSTEM_CORE}

CAPA DE CONOCIMIENTO MATEMÁTICO INYECTADA:
${JSON.stringify(kb.map(k => ({ nombre: k.nombre, definicion: k.definicion_axiomatica, representaciones: k.representaciones, propiedades: k.propiedades_clave })))}

FASE 2 — RESOLUCIÓN ANALÍTICA ULTRA-DETALLADA Y EXPANDIDA.
Resuelve el ejercicio matemático con MÁXIMO RIGOR y EXPANSIÓN COMPLETA.

REGLAS DE EXHAUSTIVIDAD OBLIGATORIAS:
- Desarrolla TODO el procedimiento analítico paso por paso (mínimo 6 a 10 pasos detallados).
- PROHIBIDO resumir o saltarse cálculos algebraicos intermedios. Muestra cada sustitución, cada operación matricial explícita, cada cálculo de determinantes, derivadas e integrales renglón por renglón.
- Justifica teórica y formalmente cada transformación (qué propiedad, axioma o teorema fundamenta cada igualdad).
- SINTAXIS MATEMÁTICA LIMPIA: Fórmulas en línea con $...$ y fórmulas display en bloque con $$...$$. NUNCA uses \\( ni \\).

PLAN SELECCIONADO: ${JSON.stringify(plan)}
ENUNCIADO: """${userPrompt}"""

${audienceInstr(aud)}
${depthInstr(dep)}

Devuelve JSON:
{
  "estrategia": "explicación detallada de la estrategia analítica general",
  "supuestos": ["supuesto 1", "supuesto 2"],
  "notacion": [
    {"simbolo":"$X(t)$", "significado":"vector de estado en $\\mathbb{R}^2$ dependiente del tiempo"}
  ],
  "riesgos": ["sutileza o error común al resolver"],
  "pasos": [
    {
      "titulo": "Título descriptivo del paso",
      "html": "<p>Explicación rigurosa paso a paso con justificación formal...</p>",
      "latex": "fórmula display clave del paso (ej: $$X'(t) = AX(t)$$)",
      "herramienta": "método o teorema aplicado"
    }
  ],
  "resultado": "resultado final exacto en display math con su interpretación",
  "verificacion": "comprobación analítica paso a paso sustituyendo en el sistema original",
  "observaciones": "comentarios cualitativos y físicos profundos"
}`;
}

function promptTheory(plan, resolver, userPrompt, aud, dep) {
  const kb = getInjectedMathKnowledge(userPrompt);
  return `${SYSTEM_CORE}

CAPA DE CONOCIMIENTO MATEMÁTICO INYECTADA:
${JSON.stringify(kb.map(k => ({ nombre: k.nombre, definicion: k.definicion_axiomatica, representaciones: k.representaciones })))}

FASE 3 — MARCO TEÓRICO FORMAL CON DEMOSTRACIONES EXHAUSTIVAS.
Extrae de la solución y del problema TODA la base teórica necesaria agrupada por ramas temáticas.

REGLAS ESTRICTAS DE DEMOSTRACIÓN:
- Para CADA teorema, lema, corolario y proposición debes proporcionar su DEMOSTRACIÓN MATEMÁTICA FORMAL Y COMPLETA en el campo 'demostracion_html'.
- PROHIBIDO dejar demostraciones vacías o resumidas. Escribe la deducción matemática formal completa: hipótesis, pasos algebraicos/analíticos intermedios y conclusión (Q.E.D. / ■).
- SINTAXIS MATEMÁTICA: Usa exclusivamente $...$ para fórmulas en línea y $$...$$ para display math. El texto explicativo y enunciados deben ser texto en español limpio (NO envuelvas oraciones enteras en $$).

PLAN: ${JSON.stringify(plan)}
RESOLUCIÓN: ${JSON.stringify({ estrategia: resolver.estrategia, resultado: resolver.resultado })}
ENUNCIADO: """${userPrompt}"""

Devuelve JSON:
{
  "ramas": [
    {
      "nombre": "Rama temática (ej. Álgebra Lineal Avanzada)",
      "descripcion": "qué estudia esta rama y su relevancia aquí",
      "items": [
        {
          "tipo": "definicion|teorema|lema|corolario|axioma|proposicion|regla|metodo",
          "nombre": "Nombre del teorema o definición",
          "enunciado": "Enunciado formal en texto con fórmulas $...$ (ej. Sea $A \\in M_2(\\mathbb{R})$...)",
          "explicacion": "Explicación conceptual y significado geométrico/físico detallado",
          "demostracion_html": "Demostración matemática formal paso a paso con deducción y cálculos explícitos"
        }
      ]
    }
  ],
  "herramientas": [{"nombre":"...","uso":"para qué sirve aquí","fuente":"origen histórico o disciplina"}],
  "glosario": [{"termino":"...","definicion":"..."}]
}`;
}

function promptFigures(plan, resolver, theory, userPrompt) {
  return `${SYSTEM_CORE}

FASE 4 — FIGURAS. Diseña las ilustraciones que acompañan el ejercicio y la teoría. Tipos soportados:
- "funcion": y=f(x) (expr, xmin, xmax, ymin, ymax, titulo, descripcion)
- "vector_field": plano (fx, fy, xmin, xmax, ymin, ymax, titulo, descripcion)
- "parametrica": curva paramétrica (fx, fy, tmin, tmax, titulo, descripcion)
- "geometria": dibujo geométrico (shapes[], titulo, descripcion). Shapes: circle, poly, line, arrow, text.
- "diagrama": cajas y flechas (boxes:[{label,x,y}], arrows:[{from,to}], titulo, descripcion).
- "tabla": tabla de valores (headers:[], rows:[[]], titulo, descripcion)
- "prosa": descripción textual (titulo, descripcion)

Usa SOLO funciones estándar de JavaScript en expr/fx/fy (Math.sin, Math.cos, Math.exp, **, etc.).

PLAN: ${JSON.stringify({ titulo: plan.titulo, ramas: plan.ramas })}
RESULTADO: ${JSON.stringify(resolver.resultado)}

Devuelve JSON:
{
  "figuras":[
     {"id":"f1","tipo":"funcion","titulo":"...","descripcion":"...","expr":"Math.sin(x)","xmin":-6.28,"xmax":6.28,"ymin":-1.5,"ymax":1.5}
  ],
  "notas_imagenes":"lista textual de qué imágenes con qué características deben realizarse"
}`;
}


function promptInteractiveSim(plan, resolver, userPrompt) {
  return `${SYSTEM_CORE}

FASE 5 — AGENTE DE LABORATORIO INTERACTIVO (SIMULADOR DINÁMICO).
Tu misión es diseñar los parámetros para un simulador interactivo en HTML5 Canvas que permita al usuario mover deslizadores numéricos (sliders) y ver el comportamiento dinámico o geométrico de la matemática en tiempo real.

DATOS:
Problema: """${userPrompt}"""
Título: ${plan.titulo}
Resultado: ${resolver.resultado}

Define 3 a 5 parámetros dinámicos clave (ej. condiciones iniciales x0, y0, frecuencia angular omega, amortiguamiento gamma, constantes a, b, c) con sus rangos de exploración y valor predeterminado.

Devuelve JSON:
{
  "titulo": "Simulador Interactivo de Órbitas y Espacio Fase",
  "descripcion": "Ajuste las condiciones iniciales y parámetros del sistema para explorar la geometría del flujo y la conservación de la energía.",
  "parametros": [
    {"id": "x0", "nombre": "Posición inicial x₀", "min": -3.0, "max": 3.0, "step": 0.1, "valor": 1.0},
    {"id": "y0", "nombre": "Velocidad / Momento y₀", "min": -3.0, "max": 3.0, "step": 0.1, "valor": 0.0},
    {"id": "omega", "nombre": "Frecuencia angular ω", "min": 0.2, "max": 3.0, "step": 0.1, "valor": 1.0},
    {"id": "gamma", "nombre": "Amortiguamiento γ (0 = Centro conservativo)", "min": -0.5, "max": 0.5, "step": 0.02, "valor": 0.0}
  ],
  "formula_display": "X(t) = e^{-\\gamma t} \\begin{pmatrix} \\cos(\\omega t) & \\sin(\\omega t) \\\\ -\\sin(\\omega t) & \\cos(\\omega t) \\end{pmatrix} X_0",
  "conservada_nombre": "Energía Hamiltoniana H(x, y)",
  "conservada_formula": "H = \\frac{1}{2}(x^2 + y^2)"
}`;
}

function promptResearch(plan, resolver, theory, userPrompt) {
  return `${SYSTEM_CORE}

FASE 5 — INVESTIGACIÓN Y EXTENSIÓN. Convierte el ejercicio en una línea de investigación: generalizaciones, problemas abiertos, aplicaciones, historia y literatura.

PLAN: ${JSON.stringify(plan)}
RESULTADO: ${JSON.stringify(resolver.resultado)}

Devuelve JSON:
{
  "generalizaciones":[{"titulo":"...","desarrollo":"explicación con LaTeX"}],
  "problemas_abiertos":[{"titulo":"...","planteamiento":"..."}],
  "aplicaciones":[{"campo":"...","descripcion":"..."}],
  "historia":[{"epoca":"...","hecho":"..."}],
  "bibliografia":[{"autor":"...","titulo":"...","tipo":"libro|artículo|curso","nota":"relevancia"}],
  "recursos":[{"nombre":"...","tipo":"libro|software|curso","descripcion":"..."}],
  "preguntas_siguientes":["..."]
}`;
}

function promptReport(plan, resolver, theory, figures, research, userPrompt) {
  return `${SYSTEM_CORE}

FASE 6 — AGENTE ESPECIALISTA EN FORMATO HTML / MATHJAX.
Tu misión: Tomar la solución matemática completa y estructurarla en un informe HTML semántico impecable listo para MathJax v3.

REGLAS ESTRICTAS DE FORMATO:
- Delimitadores matemáticos: Usa exclusivamente $...$ para matemáticas en línea y $$...$$ para display math en bloque. NUNCA uses \\( ni \\) ni \\[ ni \\].
- No agregues barras invertidas huérfanas en el texto ni repeticiones.
- Estructura con clases semánticas de Praxis:
  <section class="blk">
    <h3 class="sec"><span class="num">§</span>Título</h3>
    <div class="prose"><p>...</p></div>
    <div class="steps"><div class="step"><div class="idx"></div><div class="body"><div class="ttl">...</div><div class="prose">...</div></div></div></div>
    <div class="callout co-def"><div class="lab">Definición</div>...</div>
    <div class="callout co-thm"><div class="lab">Teorema</div>...</div>
    <div class="tbl-wrap"><table>...</table></div>
  </section>

DATOS A ENSAMBLAR:
Plan: ${JSON.stringify(plan)}
Resolución: ${JSON.stringify(resolver)}
Teoría: ${JSON.stringify(theory)}
Investigación: ${JSON.stringify(research)}

Devuelve JSON:
{"html":"<section class=\"blk\">...todo el informe ensamblado...</section>", "titulo_final":"título descriptivo y pulido"}`;
}

function promptMd(plan, resolver, theory, figures, research) {
  return `${SYSTEM_CORE}

FASE 7 — AGENTE ESPECIALISTA EN FORMATO MARKDOWN / WORD / PANDOC.
Tu misión: Generar un documento Markdown canónico, prístino y estrictamente estructurado para ser procesado por Word o Pandoc.

REGLAS ESTRICTAS DE SINTAXIS:
1. ECUACIONES EN BLOQUE (Display): Escribe SIEMPRE $$ en su propia línea, la fórmula en las líneas siguientes, y $$ de cierre en su propia línea:
   $$
   X(t) = \\begin{pmatrix} \\cos t & \\sin t \\\\ -\\sin t & \\cos t \\end{pmatrix} X_0
   $$
2. ECUACIONES EN LÍNEA (Inline): Usa SIEMPRE $formula$ (ejemplo: $x^2 + y^2 = R^2$ o $A \\in M_2(\\mathbb{R})$).
   NUNCA uses \\( ni \\) ni \\[ ni \\].
3. Estructura: # Título, ## Secciones numeradas (1. Estrategia, 2. Marco Teórico, 3. Investigaciones, 4. Bibliografía), * Viñetas.
4. NO dupliques texto, ni delimitadores, ni agregues barras invertidas huérfanas en el texto.

DATOS:
Plan: ${JSON.stringify({ titulo: plan.titulo, ramas: plan.ramas })}
Resolución: ${JSON.stringify({ estrategia: resolver.estrategia, resultado: resolver.resultado, verificacion: resolver.verificacion })}
Teoría: ${JSON.stringify(theory.ramas)}
Investigación: ${JSON.stringify({ generalizaciones: research.generalizaciones, bibliografia: research.bibliografia })}

Devuelve JSON: {"markdown":"contenido markdown completo y prístino"}`;
}

/* ============================================================
   PIPELINE UI & AGENTES
   ============================================================ */
const ICONS = {
  brain:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5 3 3 0 0 0 2 5 3 3 0 0 0 5 1V4a1 1 0 0 0-1-1z"/><path d="M15 3a3 3 0 0 1 3 3 3 3 0 0 1 1 5 3 3 0 0 1-2 5 3 3 0 0 1-5 1"/></svg>',
  pen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20l4-1 10-10-3-3L5 16z"/><path d="M14 6l3 3"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2z"/><path d="M20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z"/></svg>',
  chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4v16h16"/><path d="M7 14l3-4 3 2 4-6"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4-4"/></svg>',
  doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h6"/></svg>',
  md:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 15v-4l2 2 2-2v4M16 9v4M14 12l2 2 2-2"/></svg>'
};

const STAGES = [
  { id: 'plan', name: 'Planificador Maestro', role: 'Arquitecto del análisis', icon: 'brain' },
  { id: 'resolve', name: 'Agente de Resolución', role: 'Desarrollo paso a paso', icon: 'pen' },
  { id: 'theory', name: 'Agente Teórico', role: 'Marco teórico riguroso', icon: 'book' },
  { id: 'figures', name: 'Agente de Visualización', role: 'Figuras e ilustraciones', icon: 'chart' },
  { id: 'research', name: 'Agente de Investigación', role: 'Extensión y literatura', icon: 'search' },
  { id: 'report', name: 'Ensamblador de Informe', role: 'Documento final', icon: 'doc' },
  { id: 'md', name: 'Agente Markdown', role: 'Exportación editable', icon: 'md' }
];
let stageEls = {};

function renderPipeline() {
  const wrap = $('#stageWrap');
  wrap.innerHTML = `<div class="pipe"><div class="pipe-track"><div class="pipe-fill" id="pipeFill"></div></div>
    ${STAGES.map(s => `
    <div class="stage" id="st-${s.id}">
      <div class="node">${ICONS[s.icon]}</div>
      <div class="meta">
        <div class="name">${s.name} <span class="role">· ${s.role}</span></div>
        <div class="status" id="ss-${s.id}"><span class="st-idle">en espera</span></div>
      </div>
    </div>`).join('')}
  </div>
  <div id="reportHost"></div>`;
  stageEls = {};
  STAGES.forEach(s => stageEls[s.id] = $('#st-' + s.id));
}

function setStage(id, state, msg) {
  const el = stageEls[id]; if (!el) return;
  el.classList.remove('running', 'done', 'error');
  if (state !== 'idle') el.classList.add(state);
  const st = $('#ss-' + id);
  if (state === 'running') st.innerHTML = `<span class="spinner"></span>${esc(msg || 'procesando…')}`;
  else if (state === 'done') st.innerHTML = `<span class="badge">✓ listo</span> ${esc(msg || '')}`;
  else if (state === 'error') st.innerHTML = `<span class="badge" style="background:color-mix(in srgb,var(--bad) 18%,transparent);color:var(--bad)">✕ error</span> ${esc(msg || '')}`;
  else st.innerHTML = `<span class="st-idle">en espera</span>`;
  const done = STAGES.filter(s => stageEls[s.id] && stageEls[s.id].classList.contains('done')).length;
  const pf = $('#pipeFill'); if (pf) pf.style.height = Math.round(done / STAGES.length * 100) + '%';
}

function setStat(cls, txt) {
  const p = $('#statPill');
  p.className = 'pill ' + cls;
  $('#statTxt').textContent = txt;
}

/* ============================================================
   RENDER DEL INFORME
   ============================================================ */
const BRANCH_COLORS = ['#1a73e8','#d93025','#188038','#f9ab00','#9334e6','#12b5cb','#e37400','#5f6368'];

function renderSteps(pasos) {
  if (!pasos || !pasos.length) return '<p class="prose">Sin pasos registrados.</p>';
  return `<div class="steps">${pasos.map(p => `
    <div class="step"><div class="idx"></div><div class="body">
      <div class="ttl">${esc(p.titulo || '')}</div>
      <div class="prose">${p.html || ''}</div>
      ${p.latex ? `<div class="form">\\(${p.latex}\\)</div>` : ''}
      ${p.herramienta ? `<div class="tool">↳ ${esc(p.herramienta)}</div>` : ''}
    </div></div>`).join('')}</div>`;
}

function renderBranches(ramas) {
  if (!ramas || !ramas.length) return '';
  return `<div class="branches">${ramas.map((r, i) => {
    const col = BRANCH_COLORS[i % BRANCH_COLORS.length];
    const items = (r.items || []).map(it => {
      const demo = it.demostracion_html ? `<div class="demo"><b>Demostración.</b> ${it.demostracion_html}</div>` : '';
      const form = it.enunciado ? `<div class="form">$$${it.enunciado}$$</div>` : '';
      return `<div class="item">
        <div class="ih"><span class="tag" style="background:color-mix(in srgb,${col} 16%,transparent);color:${col}">${esc(it.tipo || '')}</span><span class="it">${esc(it.nombre || '')}</span></div>
        <div class="id">${it.explicacion || ''}</div>
        ${form}${demo}
      </div>`;
    }).join('');
    return `<div class="card">
      <div class="ch"><span class="ic" style="background:${col}">${ICONS.book}</span><span class="nm">${esc(r.nombre)}</span><span class="cnt">${(r.items || []).length} ítems</span></div>
      <div class="cb">${r.descripcion ? `<p class="prose" style="font-size:13px;color:var(--muted);margin:6px 0 2px">${esc(r.descripcion)}</p>` : ''}${items}</div>
    </div>`;
  }).join('')}</div>`;
}

function renderTable(headers, rows) {
  if (!headers || !rows) return '';
  return `<div class="tbl-wrap"><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${typeof c === 'string' && /[\\$]/.test(c) ? c : esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderResearch(rs) {
  if (!rs) return '';
  const sec = (title, inner) => inner ? `<div class="rcard"><div class="rh"><span class="ic">◆</span>${title}</div><div class="rb">${inner}</div></div>` : '';
  const cards = [
    sec('Generalizaciones', (rs.generalizaciones || []).map(g => `<h4>${esc(g.titulo)}</h4><div class="prose">${g.desarrollo || ''}</div>`).join('')),
    sec('Problemas abiertos', (rs.problemas_abiertos || []).map(p => `<b>${esc(p.titulo)}</b><br>${p.planteamiento || ''}`).join('<hr style="border:none;border-top:1px dashed var(--line);margin:8px 0">')),
    sec('Aplicaciones', `<ul>${(rs.aplicaciones || []).map(a => `<li><b>${esc(a.campo)}:</b> ${a.descripcion || ''}</li>`).join('')}</ul>`),
    sec('Historia', `<ul>${(rs.historia || []).map(h => `<li><b>${esc(h.epoca)}:</b> ${h.hecho || ''}</li>`).join('')}</ul>`),
    sec('Bibliografía', `<ul>${(rs.bibliografia || []).map(b => `<li>${esc(b.autor || '')} — <i>${esc(b.titulo || '')}</i> <span class="tag">${esc(b.tipo || '')}</span><br><span style="color:var(--muted);font-size:12px">${b.nota || ''}</span></li>`).join('')}</ul>`),
    sec('Recursos', `<ul>${(rs.recursos || []).map(r => `<li><b>${esc(r.nombre)}</b> <span class="tag">${esc(r.tipo || '')}</span><br>${r.descripcion || ''}</li>`).join('')}</ul>`),
    sec('Preguntas siguientes', `<ul>${(rs.preguntas_siguientes || []).map(q => `<li>${q}</li>`).join('')}</ul>`)
  ].filter(Boolean).join('');
  return `<div class="research">${cards}</div>`;
}

/* ============================================================
   GENERADOR DE FIGURAS SVG MATEMÁTICAS
   ============================================================ */
function compileExpr(src) {
  const s = String(src || '').trim();
  if (!s) return null;
  if (/[;{}]|document|window|fetch|eval|Function|require|import|=>/.test(s)) return null;
  try {
    const f = new Function('x', 't', 'Math', 'return (' + s + ');');
    f(0.5, 0.5, Math);
    return (x, t) => { try { const v = f(x, t === undefined ? x : t, Math); return (typeof v === 'number' && isFinite(v)) ? v : null; } catch (e) { return null; } };
  } catch (e) { return null; }
}

function niceTicks(min, max, n = 6) {
  const span = max - min || 1, step0 = span / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const start = Math.ceil(min / step) * step, out = [];
  for (let v = start; v <= max + step * 1e-6; v += step) out.push(+v.toFixed(10));
  return out;
}

function fmtNum(v) {
  if (Math.abs(v) < 1e-9) return '0';
  if (Math.abs(v) >= 1000 || Math.abs(v) < 0.01) return v.toExponential(1);
  return (+v.toFixed(3)).toString();
}

function axesSVG(W, H, pad, xmin, xmax, ymin, ymax) {
  const iw = W - 2 * pad, ih = H - 2 * pad;
  const sx = x => pad + (x - xmin) / (xmax - xmin) * iw;
  const sy = y => pad + (ymax - y) / (ymax - ymin) * ih;
  let g = `<rect x="${pad}" y="${pad}" width="${iw}" height="${ih}" fill="var(--paper-2)" stroke="var(--line)" rx="6"/>`;
  const xt = niceTicks(xmin, xmax), yt = niceTicks(ymin, ymax);
  xt.forEach(x => { g += `<line x1="${sx(x)}" y1="${pad}" x2="${sx(x)}" y2="${pad + ih}" stroke="var(--line-2)" stroke-width="1"/>`; });
  yt.forEach(y => { g += `<line x1="${pad}" y1="${sy(y)}" x2="${pad + iw}" y2="${sy(y)}" stroke="var(--line-2)" stroke-width="1"/>`; });
  if (ymin < 0 && ymax > 0) g += `<line x1="${pad}" y1="${sy(0)}" x2="${pad + iw}" y2="${sy(0)}" stroke="var(--ink-2)" stroke-width="1.4"/>`;
  if (xmin < 0 && xmax > 0) g += `<line x1="${sx(0)}" y1="${pad}" x2="${sx(0)}" y2="${pad + ih}" stroke="var(--ink-2)" stroke-width="1.4"/>`;
  xt.forEach(x => { g += `<text x="${sx(x)}" y="${pad + ih + 14}" font-size="10" fill="var(--muted)" text-anchor="middle" font-family="var(--mono)">${fmtNum(x)}</text>`; });
  yt.forEach(y => { g += `<text x="${pad - 6}" y="${sy(y) + 3}" font-size="10" fill="var(--muted)" text-anchor="end" font-family="var(--mono)">${fmtNum(y)}</text>`; });
  return { g, sx, sy, iw, ih };
}

function figFunction(f) {
  const W = 520, H = 390, pad = 42;
  const xmin = +f.xmin ?? -6, xmax = +f.xmax ?? 6, ymin = +f.ymin ?? -3, ymax = +f.ymax ?? 3;
  const fn = compileExpr(f.expr);
  const { g, sx, sy } = axesSVG(W, H, pad, xmin, xmax, ymin, ymax);
  let path = '', started = false;
  const N = 360;
  if (fn) {
    for (let i = 0; i <= N; i++) {
      const x = xmin + (xmax - xmin) * i / N, y = fn(x);
      if (y == null || y < ymin - (ymax - ymin) || y > ymax + (ymax - ymin)) { started = false; continue; }
      const px = sx(x), py = sy(Math.max(ymin, Math.min(ymax, y)));
      path += (started ? ' L ' : ' M ') + px.toFixed(1) + ' ' + py.toFixed(1);
      started = true;
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${g}<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>${fn ? '' : `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="var(--muted)" font-size="13">expresión no evaluable</text>`}</svg>`;
}

function figVectorField(f) {
  const W = 520, H = 390, pad = 40;
  const xmin = +f.xmin ?? -3, xmax = +f.xmax ?? 3, ymin = +f.ymin ?? -3, ymax = +f.ymax ?? 3;
  const fx = compileExpr(f.fx), fy = compileExpr(f.fy);
  const { g, sx, sy } = axesSVG(W, H, pad, xmin, xmax, ymin, ymax);
  let arr = ''; const cols = 13, rows = 9;
  for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) {
    const x = xmin + (xmax - xmin) * i / cols, y = ymin + (ymax - ymin) * j / rows;
    const ux = fx ? fx(x, y) : null, uy = fy ? fy(x, y) : null;
    if (ux == null || uy == null) continue;
    const m = Math.hypot(ux, uy) || 1e-9, sc = 0.62 / Math.max(1, m);
    const ex = x + ux * sc, ey = y + uy * sc;
    const x1 = sx(x), y1 = sy(y), x2 = sx(ex), y2 = sy(ey);
    const ang = Math.atan2(y2 - y1, x2 - x1), hl = 4;
    arr += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--brand)" stroke-width="1.3"/>`;
    arr += `<polygon points="${x2},${y2} ${x2-hl*Math.cos(ang-0.5)},${y2-hl*Math.sin(ang-0.5)} ${x2-hl*Math.cos(ang+0.5)},${y2-hl*Math.sin(ang+0.5)}" fill="var(--brand)"/>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${g}${arr}</svg>`;
}

function figParametric(f) {
  const W = 520, H = 390, pad = 42;
  const tmin = +f.tmin ?? 0, tmax = +f.tmax ?? (2 * Math.PI);
  const fx = compileExpr(f.fx), fy = compileExpr(f.fy);
  let xs = [], ys = [];
  if (fx && fy) for (let i = 0; i <= 400; i++) {
    const t = tmin + (tmax - tmin) * i / 400;
    const X = fx(t), Y = fy(t);
    if (X != null && Y != null) { xs.push(X); ys.push(Y); }
  }
  const pad2 = v => { const m = Math.max(...v, 1) - Math.min(...v, 0); return [Math.min(...v) - m * .1, Math.max(...v) + m * .1]; };
  const [xmin, xmax] = xs.length ? pad2(xs) : [-3, 3], [ymin, ymax] = ys.length ? pad2(ys) : [-3, 3];
  const { g, sx, sy } = axesSVG(W, H, pad, xmin, xmax, ymin, ymax);
  let path = '', started = false;
  if (fx && fy) for (let i = 0; i <= 600; i++) {
    const t = tmin + (tmax - tmin) * i / 600;
    const X = fx(t), Y = fy(t);
    if (X == null || Y == null) { started = false; continue; }
    const px = sx(X), py = sy(Y);
    path += (started ? ' L ' : ' M ') + px.toFixed(1) + ' ' + py.toFixed(1);
    started = true;
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${g}<path d="${path}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round"/></svg>`;
}

function figGeometry(f) {
  const W = 520, H = 390, pad = 30;
  const shapes = f.shapes || [];
  let pts = [];
  shapes.forEach(s => {
    if (s.kind === 'circle') { pts.push([s.cx - s.r, s.cy - s.r], [s.cx + s.r, s.cy + s.r]); }
    else if (s.kind === 'poly' || s.kind === 'line' || s.kind === 'arrow') {
      (s.pts || [[s.x1, s.y1], [s.x2, s.y2]]).forEach(p => pts.push(p));
      if (s.pts == null && s.x1 != null) pts.push([s.x1, s.y1], [s.x2, s.y2]);
    } else if (s.kind === 'text') { pts.push([s.x, s.y]); }
  });
  if (!pts.length) pts = [[0, 0], [1, 1]];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const mx = (xmax - xmin) || 1, my = (ymax - ymin) || 1;
  xmin -= mx * .12; xmax += mx * .12; ymin -= my * .12; ymax += my * .12;
  const iw = W - 2 * pad, ih = H - 2 * pad;
  const sx = x => pad + (x - xmin) / (xmax - xmin) * iw, sy = y => pad + (ymax - y) / (ymax - ymin) * ih;
  let g = `<rect x="${pad}" y="${pad}" width="${iw}" height="${ih}" fill="var(--paper-2)" stroke="var(--line)" rx="6"/>`;
  shapes.forEach(s => {
    if (s.kind === 'circle') { g += `<circle cx="${sx(s.cx)}" cy="${sy(s.cy)}" r="${(s.r / (xmax - xmin)) * iw}" fill="none" stroke="var(--brand)" stroke-width="2"/>`; }
    else if (s.kind === 'poly') { const p = (s.pts || []).map(q => `${sx(q[0])},${sy(q[1])}`).join(' '); g += `<polygon points="${p}" fill="${s.fill ? 'color-mix(in srgb,var(--accent) 18%,transparent)' : 'none'}" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`; }
    else if (s.kind === 'line') { g += `<line x1="${sx(s.x1)}" y1="${sy(s.y1)}" x2="${sx(s.x2)}" y2="${sy(s.y2)}" stroke="var(--ink-2)" stroke-width="1.8"/>`; }
    else if (s.kind === 'arrow') { const x1 = sx(s.x1), y1 = sy(s.y1), x2 = sx(s.x2), y2 = sy(s.y2), ang = Math.atan2(y2 - y1, x2 - x1), hl = 8; g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--brand)" stroke-width="2"/><polygon points="${x2},${y2} ${x2-hl*Math.cos(ang-.4)},${y2-hl*Math.sin(ang-.4)} ${x2-hl*Math.cos(ang+.4)},${y2-hl*Math.sin(ang+.4)}" fill="var(--brand)"/>`; }
    else if (s.kind === 'text') { g += `<text x="${sx(s.x)}" y="${sy(s.y)}" font-size="13" fill="var(--ink)" font-family="var(--serif)" font-style="italic">${esc(s.label || '')}</text>`; }
  });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}

function figDiagram(f) {
  const W = 520, H = 390, boxes = f.boxes || [], arrows = f.arrows || [];
  const bw = 120, bh = 44, pos = {};
  boxes.forEach((b, i) => { const x = b.x != null ? b.x : (10 + (i % 3) * 32), y = b.y != null ? b.y : (10 + Math.floor(i / 3) * 30); pos[b.label || i] = { x: x / 100 * (W - bw), y: y / 100 * (H - bh) }; });
  let g = '';
  arrows.forEach(a => { const from = pos[a.from] || { x: 0, y: 0 }, to = pos[a.to] || { x: 0, y: 0 }; const x1 = from.x + bw / 2, y1 = from.y + bh / 2, x2 = to.x + bw / 2, y2 = to.y + bh / 2; const ang = Math.atan2(y2 - y1, x2 - x1), hl = 8; g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--brand)" stroke-width="1.6" stroke-dasharray="4 3"/><polygon points="${x2},${y2} ${x2-hl*Math.cos(ang-.4)},${y2-hl*Math.sin(ang-.4)} ${x2-hl*Math.cos(ang+.4)},${y2-hl*Math.sin(ang+.4)}" fill="var(--brand)"/>`; });
  boxes.forEach((b, i) => { const p = pos[b.label || i]; g += `<rect x="${p.x}" y="${p.y}" width="${bw}" height="${bh}" rx="9" fill="var(--card-2)" stroke="var(--brand)" stroke-width="1.6"/><text x="${p.x + bw / 2}" y="${p.y + bh / 2 + 4}" text-anchor="middle" font-size="12" fill="var(--ink)" font-family="var(--sans)">${esc(String(b.label || '').slice(0, 20))}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}

function renderFigure(f) {
  try {
    switch (f.tipo) {
      case 'funcion': return figFunction(f);
      case 'vector_field': return figVectorField(f);
      case 'parametrica': return figParametric(f);
      case 'geometria': return figGeometry(f);
      case 'diagrama': return figDiagram(f);
      case 'tabla': return renderTable(f.headers, f.rows) || '<div class="prose">tabla vacía</div>';
      default: return '';
    }
  } catch (e) { return `<div class="prose" style="color:var(--bad)">Error al generar figura: ${esc(e.message)}</div>`; }
}

function renderFiguresBlock(figData) {
  const figs = (figData && figData.figuras) || [];
  if (!figs.length) return '';
  const cards = figs.map(f => {
    const art = f.tipo === 'tabla' ? renderTable(f.headers, f.rows) : (f.tipo === 'prosa' ? '<div class="prose" style="padding:14px">' + (f.descripcion || '') + '</div>' : renderFigure(f));
    return `<figure><div class="art">${art}</div><figcaption><div class="ft">Fig. · ${esc(f.titulo || f.tipo)}</div><div class="fd">${f.descripcion || ''}</div></figcaption></figure>`;
  }).join('');
  return `<div class="figures">${cards}</div>`;
}

/* ============================================================
   ENSAMBLADO FINAL DEL REPORTE
   ============================================================ */
function assembleReport(run) {
  const { plan, resolver, theory, figures, research, report } = run;
  const host = $('#reportHost');
  const num = (n) => `<span class="num">§ ${n}</span>`;
  const mdBlock = run.markdown ? `<div class="mdview"><div class="mh"><span>Markdown editable (Word)</span><span class="grow"></span><button class="btn sm ghost" onclick="copyMd()">Copiar</button><button class="btn sm ghost" onclick="downloadMd()">Descargar .md</button></div><pre id="mdPre">${esc(run.markdown)}</pre></div>` : '';

  const html = `
  <article class="doc report">
    <div class="doc-head">
      <div class="kicker">${esc(plan.area_principal || 'Matemáticas')} · ${esc(AUD_LABEL[plan._aud || S.audience])} · profundidad ${esc(DEPTH_LABEL[plan._dep || S.depth])}</div>
      <h2>${esc(report.titulo_final || plan.titulo || 'Análisis')}</h2>
      <div class="prob"><b>Enunciado.</b> ${resolver.enunciado_formal || esc(plan.objetivo || '')}</div>
    </div>
    <div class="doc-body">

      <section class="blk">
        <h3 class="sec">${num(1)}Estrategia y planificación</h3>
        <p class="sec-sub">Cómo se abordará el problema y con qué herramientas.</p>
        <div class="prose"><p>${resolver.estrategia || ''}</p></div>
        ${plan.hipotesis && plan.hipotesis.length ? `<div class="callout co-note"><div class="lab">Hipótesis y supuestos</div><ul>${plan.hipotesis.map(h => `<li>${h}</li>`).join('')}</ul></div>` : ''}
        ${plan.notacion && plan.notacion.length ? `<div class="tbl-wrap"><table><thead><tr><th>Símbolo</th><th>Significado</th></tr></thead><tbody>${plan.notacion.map(n => `<tr><td class="mono">\\(${n.symbolo}\\)</td><td>${n.significado || ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${plan.riesgos && plan.riesgos.length ? `<div class="callout co-warn"><div class="lab">Sutilezas / riesgos</div><ul>${plan.riesgos.map(r => `<li>${r}</li>`).join('')}</ul></div>` : ''}
      </section>

      <section class="blk">
        <h3 class="sec">${num(2)}Desarrollo paso a paso</h3>
        <p class="sec-sub">Procedimiento completo, sin omitir ni resumir ningún paso.</p>
        ${renderSteps(resolver.pasos)}
        ${resolver.resultado ? `<div class="callout co-ok"><div class="lab">Resultado</div><div class="prose">$$${resolver.resultado}$$</div></div>` : ''}
        ${resolver.verificacion ? `<div class="callout co-note"><div class="lab">Verificación</div><div class="prose">${resolver.verificacion}</div></div>` : ''}
        ${resolver.observaciones ? `<div class="callout co-thm"><div class="lab">Observaciones</div><div class="prose">${resolver.observaciones}</div></div>` : ''}
      </section>

      <section class="blk">
        <h3 class="sec">${num(3)}Marco teórico</h3>
        <p class="sec-sub">Definiciones, teoremas, lemas, axiomas, métodos y herramientas que sustentan la solución, por ramas.</p>
        ${renderBranches(theory.ramas)}
        ${theory.herramientas && theory.herramientas.length ? `<h4 style="font-family:var(--serif);margin:18px 0 6px">Herramientas</h4><div class="tbl-wrap"><table><thead><tr><th>Herramienta</th><th>Uso aquí</th><th>Fuente</th></tr></thead><tbody>${theory.herramientas.map(h => `<tr><td>${esc(h.nombre)}</td><td>${h.uso || ''}</td><td>${h.fuente || ''}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${theory.glosario && theory.glosario.length ? `<h4 style="font-family:var(--serif);margin:18px 0 6px">Glosario de términos y notación</h4><dl class="gloss">${theory.glosario.map(g => `<div class="gl"><dt>${esc(g.termino)}</dt><dd>${g.def || ''}</dd></div>`).join('')}</dl>` : ''}
      </section>

      <section class="blk">
        <h3 class="sec">${num(4)}Visualizaciones</h3>
        <p class="sec-sub">Figuras generadas para ilustrar el ejercicio y la teoría.</p>
        ${renderFiguresBlock(figures)}
        ${figures && figures.notas_imagenes ? `<div class="callout co-note"><div class="lab">Guía de imágenes</div><div class="prose">${Array.isArray(figures.notas_imagenes) ? '<ul>' + figures.notas_imagenes.map(n => `<li>${n}</li>`).join('') + '</ul>' : figures.notas_imagenes}</div></div>` : ''}
      </section>

      <section class="blk">
        <h3 class="sec">${num(5)}Investigación y extensión</h3>
        <p class="sec-sub">De un ejercicio a una línea de investigación: generalizaciones, aplicaciones, historia y literatura.</p>
        ${renderResearch(research)}
      </section>

      ${report && report.html ? `<section class="blk"><h3 class="sec">${num(6)}Informe integrado</h3><p class="sec-sub">Redacción continua que une todos los hilos del análisis.</p>${report.html}</section>` : ''}

      <section class="blk">
        <h3 class="sec">${num(7)}Exportación editable</h3>
        <p class="sec-sub">Markdown con el formato correspondiente listo para Word con ecuaciones editables.</p>
        ${mdBlock || '<p class="prose">Markdown no generado.</p>'}
      </section>
    </div>
  </article>
  <div class="toolbar">
    <button class="btn ghost sm" onclick="openKnowledgeModal()">📚 Mecanismos Matemáticos</button>
    <span class="grow"></span>
    <button class="btn ghost sm" onclick="toggleTheme()">◐ Tema</button>
    <button class="btn ghost sm" onclick="downloadMd()">⬇ Markdown (.md)</button>
    <button class="btn ghost sm" onclick="exportWordDoc()">⬇ Word (.doc / Ecuaciones 2D)</button>
    <button class="btn ghost sm" onclick="exportWordDocx()">⬇ Word (.docx)</button>
    <button class="btn primary sm" onclick="exportHTML()">⬇ Exportar informe .html</button>
  </div>`;
  host.innerHTML = html;
  typeset(host);
}

/* ============================================================
   ORQUESTACIÓN PRINCIPAL DEL PIPELINE
   ============================================================ */
async function runPipeline() {
  const userPrompt = $('#prompt').value.trim();
  if (!userPrompt) { toast('Escribe o pega el ejercicio primero.'); $('#prompt').focus(); return; }
  if (!validKey(S.key)) { openModal('key'); return; }
  if (S.running) { if (S.abort) S.abort.abort(); return; }

  S.running = true;
  $('#runBtn').innerHTML = '■ Detener';
  setStat('run', 'Analizando con Gemini v6…');
  renderPipeline();

  const files = S.files, aud = S.audience, dep = S.depth;
  const run = { plan: null, resolver: null, theory: null, figures: null, research: null, report: null, markdown: '' };

  try {
    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // 1. Plan
    setStage('plan', 'running', 'analizando ejercicio y trazando plan maestro…');
    run.plan = await askJSON(promptPlanner(userPrompt, files, aud, dep), { temperature: 0.4 });
    run.plan._aud = aud; run.plan._dep = dep;
    setStage('plan', 'done', (run.plan.ramas || []).length + ' ramas detectadas');
    await sleep(800); // Pequeña pausa para no saturar RPM

    // 2. Resolver
    setStage('resolve', 'running', 'desarrollando resolución paso a paso…');
    run.resolver = await askJSON(promptResolver(run.plan, userPrompt, aud, dep), { temperature: 0.3 });
    setStage('resolve', 'done', (run.resolver.pasos || []).length + ' pasos formalizados');
    await sleep(800);

    // 3. Teoría
    setStage('theory', 'running', 'extrayendo marco teórico detallado…');
    run.theory = await askJSON(promptTheory(run.plan, run.resolver, userPrompt, aud, dep), { temperature: 0.35 });
    setStage('theory', 'done', (run.theory.ramas || []).reduce((a, r) => a + ((r.items || []).length), 0) + ' ítems teóricos');
    await sleep(800);

    // 4 & 5. Figuras e Investigación con ligera separación para evitar picos TPM
    setStage('figures', 'running', 'diseñando visualizaciones…');
    const figs = await askJSON(promptFigures(run.plan, run.resolver, run.theory, userPrompt), { temperature: 0.4 }).catch(e => ({ figuras: [], notas_imagenes: 'Error figuras: ' + e.message }));
    setStage('figures', 'done', (figs.figuras || []).length + ' figuras SVG');
    await sleep(600);

    setStage('research', 'running', 'investigando generalizaciones y literatura…');
    const rs = await askJSON(promptResearch(run.plan, run.resolver, run.theory, userPrompt), { temperature: 0.5 }).catch(e => ({ generalizaciones: [], problemas_abiertos: [], aplicaciones: [], historia: [], bibliografia: [], recursos: [], preguntas_siguientes: ['Error: ' + e.message] }));
    setStage('research', 'done', (rs.bibliografia || []).length + ' referencias');
    await sleep(600);
    run.figures = figs; run.research = rs;
    setStage('figures', 'done', (figs.figuras || []).length + ' figuras SVG');
    setStage('research', 'done', (rs.bibliografia || []).length + ' referencias');

    run.report = { html: '', titulo_final: run.plan.titulo };
    assembleReport(run);

    // 6. Reporte integrado
    setStage('report', 'running', 'ensamblando informe final integrado…');
    run.report = await askJSON(promptReport(run.plan, run.resolver, run.theory, figs, rs, userPrompt), { temperature: 0.3 });
    setStage('report', 'done', 'informe listo');

    // 7. Markdown editable
    setStage('md', 'running', 'convirtiendo a Markdown para Word…');
    try {
      const md = await askJSON(promptMd(run.plan, run.resolver, run.theory, figs, rs), { temperature: 0.25 });
      run.markdown = md.markdown || '';
      setStage('md', 'done', 'markdown listo');
    } catch (e) {
      run.markdown = '*No se pudo generar el markdown: ' + e.message + '*';
      setStage('md', 'error', e.message);
    }

    assembleReport(run);
    S.lastRun = run;
    setStat('ok', 'Análisis completo');
    toast('✓ Análisis terminado exitosamente.');
    log('Pipeline completado con éxito.');
  } catch (err) {
    const cur = STAGES.find(s => stageEls[s.id] && stageEls[s.id].classList.contains('running'));
    if (cur) setStage(cur.id, 'error', String(err.message || err).slice(0, 160));
    setStat('bad', 'Error');
    const msg = String(err && err.message || err);
    if (msg.includes('abort')) toast('Análisis detenido.');
    else toast('Error: ' + msg.slice(0, 140), 4500);
    log('ERROR PIPELINE: ' + msg);
  } finally {
    S.running = false;
    $('#runBtn').innerHTML = '▶ Analizar';
    if ($('#statPill').classList.contains('run')) setStat('', 'Listo');
  }
}

/* ============================================================
   EXPORTACIONES
   ============================================================ */
function collectReportHTML() {
  const doc = $('#reportHost .doc'); if (!doc) return '';
  const clone = doc.cloneNode(true);
  clone.querySelectorAll('button').forEach(b => b.remove());
  return clone.outerHTML;
}

function exportHTML() {
  const body = collectReportHTML();
  if (!body) { toast('Primero genera un análisis.'); return; }
  const css = document.querySelector('style').textContent;
  const title = (S.lastRun && S.lastRun.plan && S.lastRun.plan.titulo) || 'Informe matemático';
  const endScript = '<' + '/script>';
  const mathJaxScript = '<script>\n' +
    'window.MathJax = {\n' +
    '  tex: {\n' +
    '    inlineMath: [["$", "$"]],\n' +
    '    displayMath: [["$$", "$$"]],\n' +
    '    processEscapes: true\n' +
    '  },\n' +
    '  options: { skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"] },\n' +
    '  startup: { typeset: true }\n' +
    '};\n' +
    endScript + '\n<script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js">' + endScript;

  const docHtml = '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(title) + '</title>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,900;1,9..144,500&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">\n' +
    mathJaxScript + '\n' +
    '<style>:root{--paper:#e7e6df;--paper-2:#f2f1ea;--card:#fbfaf5;--card-2:#fff;--ink:#171d29;--ink-2:#39424f;--muted:#6d7482;--line:#d7d6cc;--line-2:#e6e5dc;--brand:#1a73e8;--brand-2:#1557b0;--brand-tint:#e8f0fe;--accent:#d93025;--gold:#f9ab00;--ok:#188038;--warn:#f9ab00;--bad:#d93025;--sans:\'IBM Plex Sans\',sans-serif;--serif:\'Fraunces\',serif;--mono:\'IBM Plex Mono\',monospace;--sh1:0 1px 2px rgba(20,30,40,.06),0 3px 10px rgba(20,30,40,.05);--sh2:0 10px 30px rgba(20,30,40,.1)}' +
    'body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.55;padding:32px 16px}\n' +
    '.wrap{max-width:960px;margin:0 auto}' + css.replace(/:root\{[^}]*\}/, '').replace(/\[data-theme="dark"\]\{[^}]*\}/, '').replace(/\.app\{[^}]*\}/, '').replace(/body\{[^}]*overflow:hidden[^}]*\}/, '') + '</style>\n' +
    '</head><body><div class="wrap">' + body + '</div></body></html>';

  download((title || 'informe').replace(/[^\w\-]+/g, '_').slice(0, 50) + '.html', docHtml, 'text/html');
  toast('Informe exportado con MathJax autónomo.');
}

function downloadMd() {
  if (!S.lastRun || !S.lastRun.markdown) { toast('Aún no hay markdown disponible.'); return; }
  download(((S.lastRun.plan.titulo) || 'informe').replace(/[^\w\-]+/g, '_').slice(0, 50) + '.md', S.lastRun.markdown, 'text/markdown');
  toast('Markdown descargado.');
}

function copyMd() {
  if (!S.lastRun || !S.lastRun.markdown) { toast('Aún no hay markdown para copiar.'); return; }
  navigator.clipboard.writeText(S.lastRun.markdown).then(() => toast('Markdown copiado al portapapeles.'));
}

/* ============================================================
   ARCHIVOS Y ADJUNTOS
   ============================================================ */
function fileKind(f) {
  const n = f.name.toLowerCase();
  if (n.endsWith('.pdf')) return 'pdf'; if (n.endsWith('.zip')) return 'zip';
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(n)) return 'image';
  if (/\.(txt|md|csv|json|tex|xml|html)$/.test(n)) return 'text';
  if (/\.(py|js|ts|m|c|cpp|java|ipynb)$/.test(n)) return 'code';
  return 'other';
}

async function readFiles(list) {
  for (const f of list) {
    const kind = fileKind(f);
    const rec = { id: uid(), name: f.name, kind, size: f.size, text: '', url: '' };
    if (kind === 'text' || kind === 'code') { rec.text = await f.text(); }
    else if (kind === 'pdf') { rec.text = '[PDF adjunto: ' + f.name + '. Extrae el contexto relevante.]'; }
    else if (kind === 'zip') { rec.text = '[Archivo ZIP: ' + f.name + '.]'; }
    else if (kind === 'image') { rec.url = URL.createObjectURL(f); }
    S.files.push(rec);
  }
  renderAtts();
}

function renderAtts() {
  $('#atts').innerHTML = S.files.map(f => `<span class="att">${f.kind === 'image' ? '🖼' : f.kind === 'pdf' ? '📄' : f.kind === 'zip' ? '🗜' : f.kind === 'code' ? '⌨️' : '📃'} ${esc(f.name)} <span style="color:var(--muted)">${(f.size / 1024).toFixed(0)}KB</span><span class="x" data-id="${f.id}">✕</span></span>`).join('');
  $$('#atts .x').forEach(x => x.onclick = () => { S.files = S.files.filter(f => f.id !== x.dataset.id); renderAtts(); });
}

/* ============================================================
   UI, MODELOS, TEMAS Y EVENTOS
   ============================================================ */
function updateModelSelect() {
  const sel = $('#model');
  if (!sel) return;
  const current = S.model;
  const values = unique([current].concat(PREFERRED_MODELS).concat(cachedModels).concat(['custom']));

  sel.innerHTML = '';
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    if (v === 'custom') opt.textContent = 'Personalizado…';
    else if (v === PREFERRED_MODELS[0]) opt.textContent = v + ' (recomendado)';
    else opt.textContent = v;
    sel.appendChild(opt);
  });

  sel.value = values.includes(current) ? current : PREFERRED_MODELS[0];
  $('#customModel').style.display = sel.value === 'custom' ? 'block' : 'none';
}

function updateConn() {
  const p = $('#connPill');
  const has = validKey(S.key);
  p.className = 'pill ' + (has ? 'ok' : 'warn');
  const modelName = S.model === 'custom' ? (S.customModel || 'personalizado') : S.model;
  $('#connTxt').textContent = has ? ((S.key.startsWith('AQ.') ? 'Key AQ' : 'Key AIza') + ' · ' + modelName) : 'Falta API key';

  if (has) setPanelStatus('ok', 'Clave detectada · ' + modelName);
  else setPanelStatus('warn', 'Pega tu clave Gemini: AQ... o AIza...');
}

function updateAudHint() {
  const m = {
    doctor: 'Rigor máximo: demostraciones completas, generalizaciones y conexiones avanzadas.',
    maestro: 'Rigor + enfoque docente: porqués, errores comunes e intuición didáctica.',
    licenciatura: 'Detalle pedagógico: cada paso justificado, conceptos definidos al aparecer.',
    publico: 'Analogías accesibles, define toda la jerga, prioriza intuición y claridad.'
  };
  $('#audHint').textContent = m[S.audience] || '';
}

function toggleTheme() {
  const b = document.body;
  b.dataset.theme = b.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('praxis.theme', b.dataset.theme); } catch (e) {}
}

function loadTheme() {
  try {
    const t = localStorage.getItem('praxis.theme');
    if (t) document.body.dataset.theme = t;
  } catch (e) {}
}

const EXAMPLES = [
  { n: '01', t: 'Lema de Itô', d: 'Demostrar la fórmula de Itô para f(B_t) con Browniano.', p: 'Demuestra la fórmula de Itô: para un movimiento browniano B_t y f∈C², df(B_t)=f\'(B_t)dB_t + ½f\'\'(B_t)dt.' },
  { n: '02', t: 'Teorema de Cayley–Hamilton', d: 'Demostrar que toda matriz satisface su polinomio característico.', p: 'Enuncia y demuestra el teorema de Cayley–Hamilton: toda matriz cuadrada A sobre un cuerpo anula su polinomio característico p_A(A)=0.' },
  { n: '03', t: 'Serie armónica divergente', d: 'Probar que Σ 1/n diverge y estimar su crecimiento.', p: 'Demuestra que la serie armónica Σ_{n=1}^∞ 1/n diverge, y obtén la estimación asintótica Σ_{k≤n}1/k = ln n + γ + o(1).' },
  { n: '04', t: 'Flujo de un campo vectorial', d: 'Resolver el sistema dx/dt=y, dy/dt=-x y clasificar el origen.', p: 'Resuelve el sistema de EDO lineal x\'=y, y\'=-x, halla las trayectorias y clasifica el punto crítico en el origen usando el plano fase.' },
  { n: '05', t: 'Integral de Gauss', d: 'Calcular ∫_{-∞}^{∞} e^{-x²} dx.', p: 'Calcula la integral gaussiana I=∫_{-∞}^{∞} e^{-x^2}dx usando coordenadas polares, y comenta su relación con la función error.' },
  { n: '06', t: 'Teorema de Bolzano–Weierstrass', d: 'Toda sucesión acotada en ℝⁿ tiene subsucesión convergente.', p: 'Enuncia y demuestra el teorema de Bolzano–Weierstrass en ℝⁿ, discutiendo la relación con compacidad y completez.' }
];

function showExamples() {
  $('#stageWrap').innerHTML = `<div class="empty"><div class="big">De un ejercicio<br>a una <em>investigación</em>.</div>
  <p class="lead">Praxis orquesta siete agentes especializados con el motor nativo de <b>Gemini v6</b>: planifica, resuelve paso a paso, extrae el marco teórico, genera visualizaciones SVG, investiga extensiones y ensambla un informe exportable con MathJax y Markdown para Word.</p>
  <div class="sect-label" style="margin-top:0">Prueba con uno de estos</div>
  <div class="exlist">${EXAMPLES.map(e => `<button class="ex" data-p="${encodeURIComponent(e.p)}"><span class="n">${e.n}</span><span><span class="t">${esc(e.t)}</span><span class="d">${esc(e.d)}</span></span></button>`).join('')}</div>
  </div>`;
  $$('.ex').forEach(b => b.onclick = () => {
    $('#prompt').value = decodeURIComponent(b.dataset.p);
    $('#prompt').focus();
    $('#stageWrap').innerHTML = '';
    toast('Ejercicio cargado. Pulsa Analizar.');
  });
}

function openModal(which) {
  const m = $('#modal');
  if (which === 'key') {
    $('#modalTitle').textContent = 'API Key de Google Gemini';
    $('#modalBody').innerHTML = `<p>Praxis es compatible tanto con claves de <b>Google AI Studio</b> (<code>AIza...</code>) como con tokens/claves de despliegue (<code>AQ...</code>):</p>
    <ol class="steps-list">
      <li>Accede a <a href="https://aistudio.google.com/api-keys" target="_blank" style="color:var(--brand)">Google AI Studio - API Keys</a>.</li>
      <li>Inicia sesión con tu cuenta de Google.</li>
      <li>Crea tu API Key y pégala en el campo de conexión.</li>
      <li>Si estás en celular o GitHub Pages, usa el botón <b>"Probar conexión"</b> o la herramienta <b>"🛠"</b> de la barra superior.</li>
    </ol>
    <div class="warnbox"><b>Seguridad:</b> La clave se almacena exclusivamente en el almacenamiento local de tu navegador (localStorage) y se envía de forma cifrada mediante encabezados HTTPS oficiales.</div>`;
  } else {
    $('#modalTitle').textContent = 'Praxis · Guía de Orquestación';
    $('#modalBody').innerHTML = `<p><b>Arquitectura Multi-Agente:</b> Convierte cualquier ejercicio matemático en un estudio exhaustivo sin omisiones:</p>
    <h4>Flujo de las 7 fases</h4>
    <ol class="steps-list">
      <li><b>Planificador Maestro:</b> Clasificación, notación, riesgos e hipótesis.</li>
      <li><b>Agente de Resolución:</b> Demostración formal y pasos sin saltos.</li>
      <li><b>Agente Teórico:</b> Desglose de axiomas, teoremas y definiciones por ramas.</li>
      <li><b>Agente de Visualización:</b> Generación matemática nativa en SVG.</li>
      <li><b>Agente de Investigación:</b> Generalizaciones, historia, problemas abiertos y fuentes.</li>
      <li><b>Ensamblador de Informe:</b> Unificación en HTML legible con MathJax.</li>
      <li><b>Agente Markdown:</b> Exportación compatible con ecuaciones para Microsoft Word.</li>
    </ol>`;
  }
  m.classList.add('open');
}

function closeModal() { $('#modal').classList.remove('open'); }

/* Red geométrica de fondo */
function buildNet() {
  const svg = $('#net'); if (!svg) return;
  const w = innerWidth, h = innerHeight;
  const N = Math.min(46, Math.floor(w * h / 26000));
  const pts = [];
  for (let i = 0; i < N; i++) pts.push({ x: Math.random() * w, y: Math.random() * h, d: Math.random() * 6 });
  let lines = '';
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dist = Math.hypot(dx, dy);
    if (dist < 150) lines += `<line x1="${pts[i].x}" y1="${pts[i].y}" x2="${pts[j].x}" y2="${pts[j].y}" stroke-dasharray="2 6" style="animation-delay:${(dist / 150 * 8).toFixed(1)}s"/>`;
  }
  let dots = '';
  pts.forEach(p => dots += `<circle cx="${p.x}" cy="${p.y}" r="2" style="animation-delay:${p.d}s"/>`);
  svg.innerHTML = lines + dots;
}

/* Pruebas y diagnósticos */
async function testConnection() {
  if (!validKey(S.key)) {
    setPanelStatus('bad', 'Clave vacía o formato inválido');
    toast('Ingresa una API Key válida (AIza... o AQ...)');
    openModal('key');
    return;
  }
  const btn = $('#testBtn');
  btn.disabled = true; btn.textContent = 'Probando…';
  setPanelStatus('run', 'Probando conexión con Gemini…');
  setStat('run', 'Verificando…');
  try {
    const res = await callGemini('Responde exactamente con la palabra: OK', { temperature: 0, max_tokens: 20, json: false, isTest: true, timeout: 12000 });
    toast('Conexión correcta ✔ ' + res.trim().slice(0, 30));
    setStat('ok', 'Conectado');
    setPanelStatus('ok', 'Conexión verificada: ' + res.trim());
    log('Prueba exitosa con modelo ' + S.model + ': ' + res.trim());
  } catch (e) {
    const msg = friendlyError(e);
    toast('Fallo de conexión: ' + msg.slice(0, 100), 4500);
    setStat('bad', 'Error de conexión');
    setPanelStatus('bad', 'Fallo: ' + msg);
    log('ERROR TEST: ' + msg);
  } finally {
    btn.disabled = false; btn.textContent = 'Probar conexión';
  }
}

async function listModelsAction() {
  setPanelStatus('run', 'Consultando modelos disponibles en Google...');
  try {
    const models = await fetchModels();
    setPanelStatus('ok', 'Modelos detectados: ' + models.length);
    toast('Modelos cargados (' + models.length + ')');
    log('Modelos detectados: ' + models.join(', '));
  } catch (e) {
    const msg = friendlyError(e);
    setPanelStatus('bad', 'Error listando: ' + msg);
    toast('Error: ' + msg.slice(0, 100));
    log('ERROR LISTAR: ' + msg);
  }
}

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
function init() {
  loadCfg();
  loadTheme();

  $('#apiKey').value = S.key || '';
  updateModelSelect();
  syncChips();

  // Enlace chips audiencia
  $$('#audChips .chip').forEach(c => c.onclick = () => {
    $$('#audChips .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on');
    S.audience = c.dataset.aud;
    saveCfg();
    updateAudHint();
  });

  // Enlace chips profundidad
  $$('#depthChips .chip').forEach(c => c.onclick = () => {
    $$('#depthChips .chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on');
    S.depth = c.dataset.depth;
    saveCfg();
  });

  // Enlace chips herramientas
  $$('#toolChips .chip').forEach(c => c.onclick = () => {
    const t = c.dataset.tool;
    S.tools[t] = !S.tools[t];
    c.classList.toggle('on', S.tools[t]);
    saveCfg();
  });

  // Eventos de entrada
  $('#apiKey').addEventListener('input', debounce(() => {
    const val = $('#apiKey').value.trim();
    S.key = val;
    saveCfg();
    updateConn();
  }, 250));

  $('#eyeBtn').onclick = () => {
    const inp = $('#apiKey');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  };

  $('#model').onchange = () => {
    S.model = $('#model').value;
    $('#customModel').style.display = S.model === 'custom' ? 'block' : 'none';
    saveCfg();
    updateConn();
  };

  $('#customModel').addEventListener('input', debounce(() => {
    S.customModel = $('#customModel').value.trim();
    saveCfg();
    updateConn();
  }, 250));

  $('#testBtn').onclick = testConnection;
  $('#listModelsBtn').onclick = listModelsAction;
  $('#helpKey').onclick = e => { e.preventDefault(); openModal('key'); };
  $('#aboutBtn').onclick = () => openModal('about');
  $('#modalClose').onclick = closeModal;
  $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
  $('#themeBtn').onclick = toggleTheme;

  $('#clearBtn').onclick = () => {
    if (confirm('¿Deseas limpiar el ejercicio y los resultados actuales?')) {
      $('#stageWrap').innerHTML = '';
      $('#prompt').value = '';
      S.files = [];
      renderAtts();
      showExamples();
    }
  };

  $('#exampleBtn').onclick = showExamples;
  $('#runBtn').onclick = runPipeline;

  $('#prompt').addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runPipeline();
    }
  });

  $('#prompt').addEventListener('input', () => {
    const el = $('#prompt');
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 220) + 'px';
    const n = el.value.length;
    $('#tokEst').textContent = n ? ('~' + Math.round(n / 3.5) + ' tokens aprox.') : '';
  });

  $('#fileInput').onchange = e => {
    readFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  // Controles del Panel de Diagnostico
  const pfp = $('#praxisFixPanel');
  const pfpHead = $('.pfp-head');
  const pfpToggle = $('#pfpToggle');
  const togglePanel = () => {
    pfp.classList.toggle('min');
    pfpToggle.textContent = pfp.classList.contains('min') ? '+' : '—';
  };
  if (pfpHead) pfpHead.onclick = togglePanel;
  $('#toggleDiagBtn').onclick = togglePanel;

  $('#pfpTest').onclick = testConnection;
  $('#pfpListModels').onclick = listModelsAction;
  $('#pfpReload').onclick = () => location.reload();
  $('#pfpClear').onclick = () => {
    localStorage.removeItem(STORAGE_KEY);
    S.key = '';
    $('#apiKey').value = '';
    saveCfg();
    updateConn();
    setPanelStatus('warn', 'Clave local borrada.');
    log('Clave borrada del almacenamiento local.');
  };
  $('#pfpCopy').onclick = () => {
    const txt = $('#pfpLog').textContent || '';
    navigator.clipboard.writeText(txt).then(() => toast('Log copiado.')).catch(() => toast('No se pudo copiar.'));
  };

  // Listeners globales para capturar errores de JavaScript y promesas en pantalla
  window.addEventListener('error', e => {
    const m = 'ERROR JS: ' + (e.message || '') + ' @ ' + (e.filename || '') + ':' + (e.lineno || '');
    log(m);
    setPanelStatus('bad', 'Error JS detectado');
  });
  window.addEventListener('unhandledrejection', e => {
    const reason = e && e.reason;
    const m = 'PROMESA RECHAZADA: ' + ((reason && reason.message) || reason);
    log(m);
    setPanelStatus('bad', 'Promesa rechazada');
  });

  window.addEventListener('resize', debounce(buildNet, 300));
  buildNet();
  updateConn();
  showExamples();

  log('Praxis v6 listo.');
  if (validKey(S.key)) {
    fetchModels().then(m => log('Auto-detección de modelos exitosa: ' + m.slice(0, 5).join(', '))).catch(e => log('Nota al inicio: ' + e.message));
  }
}

function syncChips() {
  $$('#audChips .chip').forEach(c => c.classList.toggle('on', c.dataset.aud === S.audience));
  $$('#depthChips .chip').forEach(c => c.classList.toggle('on', c.dataset.depth === S.depth));
  $$('#toolChips .chip').forEach(c => c.classList.toggle('on', !!S.tools[c.dataset.tool]));
  updateAudHint();
}

window.addEventListener('DOMContentLoaded', init);
