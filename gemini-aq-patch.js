/* ============================================================
   PRAXIS FIX · GEMINI v6
   Archivo: gemini-aq-patch.js
   Función:
   - Acepta API keys AIza... y AQ...
   - Usa x-goog-api-key con fallback ?key=
   - Cambia automáticamente a gemini-3.6-flash / gemini-2.5-flash
   - Permite listar modelos disponibles
   - Muestra errores visibles desde celular
   - Sobrescribe callGemini / askJSON / updateConn / saveCfg
   ============================================================ */
(function () {
  "use strict";

  if (window.__PRAXIS_FIX_GEMINI_V6__) return;
  window.__PRAXIS_FIX_GEMINI_V6__ = true;

  var STORAGE = "praxis_gemini.cfg";
  var API_BASE = "https://generativelanguage.googleapis.com/v1beta";

  var PREFERRED = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-flash-latest"
  ];

  var cachedModels = [];
  var panel = null;
  var logEl = null;
  var statusEl = null;

  function q(sel) {
    return document.querySelector(sel);
  }

  function qa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function now() {
    return new Date().toLocaleTimeString();
  }

  function safeJson(x) {
    try {
      return JSON.stringify(x, null, 2);
    } catch (e) {
      return String(x);
    }
  }

  function unique(arr) {
    var out = [];
    var seen = {};
    for (var i = 0; i < arr.length; i++) {
      var v = String(arr[i] || "").trim();
      if (v && !seen[v]) {
        seen[v] = 1;
        out.push(v);
      }
    }
    return out;
  }

  function elValue(sel) {
    var el = q(sel);
    return el ? String(el.value || "").trim() : "";
  }

  function hasState() {
    return typeof S !== "undefined" && S;
  }

  function setStateProp(prop, value) {
    if (hasState()) {
      S[prop] = value;
    }
  }

  function getStateProp(prop, fallback) {
    if (hasState() && S[prop] != null) {
      return S[prop];
    }
    return fallback;
  }

  function ensurePanel() {
    if (panel) return;

    panel = document.getElementById("praxisFixPanel");

    if (!panel) {
      var style = document.createElement("style");
      style.textContent = `
        #praxisFixPanel{
          position:fixed;
          right:12px;
          bottom:12px;
          width:min(430px, calc(100vw - 24px));
          max-height:min(64vh, 650px);
          background:#0b1220;
          color:#e5e7eb;
          border:1px solid #334155;
          border-radius:14px;
          box-shadow:0 18px 60px rgba(0,0,0,.55);
          z-index:2147483647;
          font:13px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
          display:flex;
          flex-direction:column;
          overflow:hidden;
        }
        #praxisFixPanel.min{
          max-height:44px;
        }
        .pfp-head{
          display:flex;
          align-items:center;
          gap:8px;
          padding:10px 12px;
          background:#111827;
          border-bottom:1px solid #334155;
          cursor:pointer;
          user-select:none;
        }
        .pfp-head b{
          flex:1;
          font-size:13px;
        }
        .pfp-body{
          padding:10px;
          display:flex;
          flex-direction:column;
          gap:8px;
          min-height:0;
        }
        #praxisFixPanel.min .pfp-body{
          display:none;
        }
        .pfp-row{
          display:flex;
          gap:8px;
          flex-wrap:wrap;
        }
        .pfp-row button{
          flex:1;
          min-width:120px;
        }
        #praxisFixPanel button{
          padding:10px 12px;
          border-radius:10px;
          border:1px solid #475569;
          background:#1f2937;
          color:#e5e7eb;
          font:inherit;
          cursor:pointer;
        }
        #praxisFixPanel button.primary{
          background:#1a73e8;
          border-color:#1a73e8;
          color:#fff;
          font-weight:800;
        }
        #praxisFixPanel button.good{
          background:#14532d;
          border-color:#166534;
          color:#fff;
          font-weight:800;
        }
        #praxisFixPanel button.danger{
          background:#7f1d1d;
          border-color:#991b1b;
          color:#fff;
        }
        .pfp-status{
          padding:10px;
          border-radius:10px;
          border:1px solid #334155;
          background:#111827;
          font-weight:800;
          word-break:break-word;
        }
        .pfp-status.ok{
          background:#052e16;
          border-color:#14532d;
          color:#86efac;
        }
        .pfp-status.bad{
          background:#450a0a;
          border-color:#7f1d1d;
          color:#fecaca;
        }
        .pfp-status.warn{
          background:#422006;
          border-color:#713f12;
          color:#fde68a;
        }
        .pfp-status.run{
          background:#0c1a3a;
          border-color:#1d4ed8;
          color:#bfdbfe;
        }
        #pfpLog{
          background:#020617;
          border:1px solid #1e293b;
          border-radius:10px;
          padding:10px;
          min-height:150px;
          max-height:34vh;
          overflow:auto;
          white-space:pre-wrap;
          word-break:break-word;
          font:12px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
          color:#d1d5db;
          margin:0;
        }
      `;
      document.head.appendChild(style);

      panel = document.createElement("div");
      panel.id = "praxisFixPanel";
      panel.innerHTML = `
        <div class="pfp-head">
          <b>Praxis Fix · Gemini v6</b>
          <span id="pfpToggle">—</span>
        </div>
        <div class="pfp-body">
          <div id="pfpStatus" class="pfp-status">Cargando…</div>

          <div class="pfp-row">
            <button id="pfpListModels" class="good">Listar modelos</button>
            <button id="pfpTest" class="primary">Probar key</button>
          </div>

          <div class="pfp-row">
            <button id="pfpCopy">Copiar log</button>
            <button id="pfpReload">Recargar</button>
          </div>

          <div class="pfp-row">
            <button id="pfpClear" class="danger">Borrar key local</button>
          </div>

          <pre id="pfpLog"></pre>
        </div>
      `;

      document.body.appendChild(panel);
    }

    logEl = panel.querySelector("#pfpLog");
    statusEl = panel.querySelector("#pfpStatus");

    var head = panel.querySelector(".pfp-head");
    var toggle = panel.querySelector("#pfpToggle");

    if (head && toggle) {
      head.onclick = function () {
        panel.classList.toggle("min");
        toggle.textContent = panel.classList.contains("min") ? "+" : "—";
      };
    }

    var btnTest = panel.querySelector("#pfpTest");
    var btnList = panel.querySelector("#pfpListModels");
    var btnCopy = panel.querySelector("#pfpCopy");
    var btnClear = panel.querySelector("#pfpClear");
    var btnReload = panel.querySelector("#pfpReload");

    if (btnTest) btnTest.onclick = function () { testConnection(); };
    if (btnList) btnList.onclick = function () { listModelsAction(); };

    if (btnCopy) {
      btnCopy.onclick = function () {
        if (!logEl) return;
        var text = logEl.textContent || "";
        try {
          navigator.clipboard.writeText(text).then(function () {
            setStatus("ok", "Log copiado.");
          }).catch(function () {
            fallbackCopy(text);
          });
        } catch (e) {
          fallbackCopy(text);
        }
      };
    }

    if (btnClear) {
      btnClear.onclick = function () {
        try {
          localStorage.removeItem(STORAGE);
        } catch (e) {}
        setStateProp("key", "");
        var input = q("#apiKey");
        if (input) input.value = "";
        saveCfgFixed();
        updateConnFixed();
        setStatus("warn", "Key local borrada.");
        log("Key local borrada. Recarga y pega una nueva API key.");
      };
    }

    if (btnReload) {
      btnReload.onclick = function () {
        location.reload();
      };
    }
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setStatus("ok", "Log copiado con fallback.");
    } catch (e) {
      setStatus("bad", "No se pudo copiar. Selecciona manualmente el log.");
    }
  }

  function log(msg) {
    ensurePanel();
    var text = typeof msg === "string" ? msg : safeJson(msg);
    if (logEl) {
      logEl.textContent += "[" + now() + "] " + text + "\n\n";
      logEl.scrollTop = logEl.scrollHeight;
    }
    console.log("[PraxisFix v6]", msg);
  }

  function setStatus(type, msg) {
    ensurePanel();
    if (!statusEl) return;
    statusEl.className = "pfp-status " + type;
    statusEl.textContent = msg;
  }

  function validKey(k) {
    k = String(k || "").trim();
    return (
      /^AIza[0-9A-Za-z_-]{20,}$/.test(k) ||
      /^AQ\.[A-Za-z0-9_.-]{20,}$/.test(k)
    );
  }

  function getStoredCfg() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE) || "{}");
    } catch (e) {
      return {};
    }
  }

  function setStoredCfg(cfg) {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(cfg));
    } catch (e) {}
  }

  function sanitizeStorage() {
    var c = getStoredCfg();
    var changed = false;

    if (c.key && !validKey(c.key)) {
      delete c.key;
      changed = true;
    }

    if (!c.model || c.model === "gemini-2.0-flash-exp") {
      c.model = PREFERRED[0];
      changed = true;
    }

    if (changed) setStoredCfg(c);
  }

  function getKey() {
    var inputKey = elValue("#apiKey");
    if (validKey(inputKey)) return inputKey;

    var sKey = getStateProp("key", "");
    if (validKey(sKey)) return String(sKey).trim();

    var stored = getStoredCfg();
    if (validKey(stored.key)) return String(stored.key).trim();

    return "";
  }

  function setKey(k) {
    k = String(k || "").trim();
    var ok = validKey(k);
    setStateProp("key", ok ? k : "");

    var input = q("#apiKey");
    if (input) input.value = ok ? k : "";
  }

  function bootstrapKey() {
    sanitizeStorage();

    var stored = getStoredCfg();
    var inputKey = elValue("#apiKey");
    var chosen = "";

    if (validKey(inputKey)) chosen = inputKey;
    else if (validKey(stored.key)) chosen = String(stored.key).trim();
    else chosen = "";

    setKey(chosen);
  }

  function getModel() {
    var selValue = elValue("#model");
    var sModel = getStateProp("model", "");
    var stored = getStoredCfg();
    var m = selValue || sModel || stored.model || "";

    if (m === "custom") {
      var cv = elValue("#customModel");
      if (cv) return cv;
      m = PREFERRED[0];
    }

    if (!m || m === "gemini-2.0-flash-exp") {
      m = PREFERRED[0];
    }

    return m;
  }

  function setModel(m) {
    m = String(m || "").trim() || PREFERRED[0];
    setStateProp("model", m);

    var sel = q("#model");
    if (sel) sel.value = m;

    var custom = q("#customModel");
    if (custom) custom.style.display = m === "custom" ? "block" : "none";
  }

  function updateModelSelect() {
    var sel = q("#model");
    if (!sel) return;

    var current = getModel();

    var values = unique([current].concat(PREFERRED).concat(cachedModels).concat(["custom"]));

    sel.innerHTML = "";

    values.forEach(function (value) {
      var opt = document.createElement("option");
      opt.value = value;
      if (value === "custom") {
        opt.textContent = "Personalizado…";
      } else if (value === PREFERRED[0]) {
        opt.textContent = value + " (recomendado)";
      } else {
        opt.textContent = value;
      }
      sel.appendChild(opt);
    });

    sel.value = values.indexOf(current) >= 0 ? current : PREFERRED[0];

    var custom = q("#customModel");
    if (custom) custom.style.display = sel.value === "custom" ? "block" : "none";
  }

  function saveCfgFixed() {
    try {
      var payload = {
        key: validKey(getKey()) ? getKey() : "",
        model: getModel(),
        customModel: elValue("#customModel"),
        audience: getStateProp("audience", "doctor"),
        depth: getStateProp("depth", "profunda"),
        tools: getStateProp("tools", { web: true, pdf: true, zip: false, code: false })
      };
      localStorage.setItem(STORAGE, JSON.stringify(payload));
    } catch (e) {}
  }

  function loadCfgFixed() {
    if (!hasState()) return;

    try {
      var c = getStoredCfg();

      if (validKey(c.key)) S.key = c.key;
      else S.key = "";

      if (c.model && c.model !== "gemini-2.0-flash-exp") {
        S.model = c.model;
      } else {
        S.model = PREFERRED[0];
      }

      if (typeof c.customModel === "string") S.customModel = c.customModel;
      if (c.audience) S.audience = c.audience;
      if (c.depth) S.depth = c.depth;
      if (c.tools) S.tools = c.tools;
    } catch (e) {
      S.key = "";
      S.model = PREFERRED[0];
    }
  }

  async function rawFetch(url, init) {
    var res = await fetch(url, init);
    var text = await res.text();

    var json = null;
    try {
      json = JSON.parse(text);
    } catch (e) {}

    if (!res.ok) {
      var msg =
        (json && json.error && json.error.message) ||
        text.slice(0, 700) ||
        res.statusText;

      var err = new Error("HTTP " + res.status + ": " + msg);
      err.status = res.status;
      err.json = json;
      err.text = text;
      throw err;
    }

    return json || {};
  }

  async function fetchModels() {
    var key = getKey();

    if (!validKey(key)) {
      throw new Error("Falta una API key válida para listar modelos.");
    }

    var url = API_BASE + "/models?pageSize=200";
    var json = null;

    try {
      json = await rawFetch(url, {
        method: "GET",
        mode: "cors",
        headers: {
          "x-goog-api-key": key
        }
      });
    } catch (e) {
      log("GET /models con header falló: " + String(e && e.message || e));
      json = await rawFetch(url + "?key=" + encodeURIComponent(key), {
        method: "GET",
        mode: "cors"
      });
    }

    var models = Array.isArray(json.models) ? json.models : [];

    var parsed = models.map(function (m) {
      var name = String(m.name || "").replace(/^models\//, "").trim();
      var methods = Array.isArray(m.supportedGenerationMethods)
        ? m.supportedGenerationMethods
        : [];
      return { name: name, methods: methods };
    }).filter(function (m) {
      return !!m.name;
    });

    var usable = parsed.filter(function (m) {
      return (
        !m.methods.length ||
        m.methods.indexOf("generateContent") >= 0 ||
        m.methods.indexOf("streamGenerateContent") >= 0
      );
    }).map(function (m) {
      return m.name;
    });

    var all = parsed.map(function (m) {
      return m.name;
    });

    cachedModels = unique(usable.concat(all));

    cachedModels.sort(function (a, b) {
      var ia = PREFERRED.indexOf(a);
      var ib = PREFERRED.indexOf(b);
      if (ia < 0) ia = 999;
      if (ib < 0) ib = 999;
      if (ia !== ib) return ia - ib;
      return String(a).localeCompare(String(b));
    });

    if (!cachedModels.length) {
      throw new Error("No se encontraron modelos disponibles.");
    }

    var current = getModel();
    var preferredFound = null;

    for (var i = 0; i < PREFERRED.length; i++) {
      if (cachedModels.indexOf(PREFERRED[i]) >= 0) {
        preferredFound = PREFERRED[i];
        break;
      }
    }

    var chosen = cachedModels.indexOf(current) >= 0
      ? current
      : (preferredFound || cachedModels[0]);

    setModel(chosen);
    updateModelSelect();
    saveCfgFixed();

    return cachedModels;
  }

  function friendlyError(e) {
    var msg = String(e && e.message || e || "Error desconocido.");
    var status = e && e.status;

    if (/Failed to fetch|NetworkError|Load failed|CORS/i.test(msg)) {
      return "Error de red/CORS. Abre la URL de GitHub Pages, no github.com/blob ni raw.githubusercontent.com. Detalle: " + msg;
    }

    if (status === 400) {
      return "HTTP 400: petición inválida. Puede ser modelo, key o modo JSON. Detalle: " + msg;
    }

    if (status === 401) {
      return "HTTP 401: API key inválida o no permitida. Crea una key nueva en Google AI Studio. Detalle: " + msg;
    }

    if (status === 403) {
      return "HTTP 403: permiso denegado. Revisa restricciones de key, cuota, proyecto y API habilitada. Detalle: " + msg;
    }

    if (status === 404) {
      if (/no longer available|not available to new users|models\/.* is no longer|NOT_FOUND/i.test(msg)) {
        return "HTTP 404: ese modelo ya no está disponible para tu cuenta. Pulsa 'Listar modelos' o usa gemini-2.5-flash. Detalle: " + msg;
      }
      return "HTTP 404: modelo no disponible. Pulsa 'Listar modelos'. Detalle: " + msg;
    }

    if (status === 429) {
      return "HTTP 429: rate limit o cuota agotada. Espera o cambia de modelo/proyecto. Detalle: " + msg;
    }

    return msg;
  }

  function extractTextFromGemini(j) {
    j = j || {};

    if (j.promptFeedback && j.promptFeedback.blockReason) {
      throw new Error("Contenido bloqueado por Gemini: " + j.promptFeedback.blockReason);
    }

    var cand = (j.candidates && j.candidates[0]) || null;

    if (!cand) {
      throw new Error("Gemini no devolvió candidatos: " + safeJson(j).slice(0, 500));
    }

    if (cand.finishReason === "MAX_TOKENS") {
      throw new Error("Gemini truncó la respuesta por MAX_TOKENS. Reduce profundidad o divide la tarea.");
    }

    if (cand.finishReason && cand.finishReason !== "STOP") {
      throw new Error("Gemini terminó con finishReason=" + cand.finishReason + ": " + safeJson(cand).slice(0, 350));
    }

    var parts = (cand.content && cand.content.parts) || [];
    var text = parts.map(function (p) {
      return (p && p.text) ? p.text : "";
    }).join("");

    if (!text.trim()) {
      throw new Error("Gemini devolvió texto vacío.");
    }

    return text;
  }

  function extractJSONFallback(text) {
    if (!text) throw new Error("respuesta vacía");

    var t = String(text).trim()
      .replace(/^\s*```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();

    var first = t.search(/[{[]/);

    if (first >= 0) {
      var open = t[first];
      var close = open === "{" ? "}" : "]";
      var depth = 0;
      var inStr = false;
      var esc = false;
      var end = -1;

      for (var i = first; i < t.length; i++) {
        var ch = t[i];

        if (inStr) {
          if (esc) esc = false;
          else if (ch === "\\") esc = true;
          else if (ch === '"') inStr = false;
        } else {
          if (ch === '"') inStr = true;
          else if (ch === open) depth++;
          else if (ch === close) {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
      }

      if (end > first) t = t.slice(first, end + 1);
    }

    try {
      return JSON.parse(t);
    } catch (e) {}

    try {
      return JSON.parse(t.replace(/,\s*([}\]])/g, "$1"));
    } catch (e2) {
      throw new Error("La IA no devolvió JSON válido. " + String(e2 && e2.message || e2));
    }
  }

  window.callGemini = async function (prompt, opts) {
    opts = opts || {};

    var key = getKey();

    if (!validKey(key)) {
      throw new Error("Falta una API key válida. Debe empezar por AQ... o AIza...");
    }

    var candidates = unique(
      [getModel()].concat(cachedModels.length ? cachedModels : PREFERRED)
    ).slice(0, 6);

    var ctrl = new AbortController();
    setStateProp("abort", ctrl);

    var lastError = null;

    for (var ci = 0; ci < candidates.length; ci++) {
      var model = candidates[ci];
      var base = API_BASE + "/models/" + encodeURIComponent(model) + ":generateContent";
      var modelUnavailable = false;

      var authModes = ["header", "query"];

      for (var ai = 0; ai < authModes.length; ai++) {
        if (modelUnavailable) break;

        var auth = authModes[ai];

        var jsonAttempts = opts.json === false ? [false] : [true, false];

        for (var ji = 0; ji < jsonAttempts.length; ji++) {
          var useJson = jsonAttempts[ji];

          var url = auth === "query"
            ? base + "?key=" + encodeURIComponent(key)
            : base;

          var headers = {
            "Content-Type": "application/json"
          };

          if (auth === "header") {
            headers["x-goog-api-key"] = key;
          }

          var generationConfig = {
            temperature: opts.temperature != null ? opts.temperature : 0.4,
            topP: opts.topP != null ? opts.topP : 0.95,
            maxOutputTokens: opts.max_tokens != null ? opts.max_tokens : 8192
          };

          if (useJson) {
            generationConfig.responseMimeType = "application/json";
          }

          var body = {
            contents: [
              {
                parts: [
                  {
                    text: String(prompt || "")
                  }
                ]
              }
            ],
            generationConfig: generationConfig
          };

          try {
            var json = await rawFetch(url, {
              method: "POST",
              mode: "cors",
              headers: headers,
              body: JSON.stringify(body),
              signal: ctrl.signal
            });

            setModel(model);
            saveCfgFixed();
            updateConnFixed();

            return extractTextFromGemini(json);
          } catch (e) {
            lastError = e;

            if (e && e.name === "AbortError") throw e;

            var msg = String(e && e.message || "");

            if (e && e.status === 404 && /model|NOT_FOUND|no longer available|not available/i.test(msg)) {
              log("Modelo no disponible: " + model + ". Probando siguiente...");
              modelUnavailable = true;
              break;
            }

            if (e && e.status === 400 && useJson && /responseMimeType|JSON/i.test(msg)) {
              log("El modelo " + model + " rechazó responseMimeType JSON. Reintentando sin JSON mode...");
              continue;
            }

            if (e && (e.status === 401 || e.status === 403 || e.status === 429)) {
              throw new Error(friendlyError(e));
            }

            log("Intento fallido: model=" + model + ", auth=" + auth + ", json=" + useJson + ", error=" + msg);
          }
        }
      }
    }

    throw new Error(friendlyError(lastError));
  };

  window.askJSON = async function (prompt, opts) {
    opts = opts || {};
    var raw = await window.callGemini(prompt, Object.assign({ json: true }, opts));

    if (typeof extractJSON === "function") {
      try {
        return extractJSON(raw);
      } catch (e) {
        log("extractJSON original falló: " + String(e && e.message || e));
      }
    }

    return extractJSONFallback(raw);
  };

  function updateConnFixed() {
    var pill = q("#connPill");
    var txt = q("#connTxt");
    var key = getKey();
    var model = getModel();

    if (pill && txt) {
      if (!key) {
        pill.className = "pill warn";
        txt.textContent = "Falta API key";
      } else if (!validKey(key)) {
        pill.className = "pill bad";
        txt.textContent = "Key no reconocida";
      } else {
        pill.className = "pill ok";
        txt.textContent =
          (key.indexOf("AQ.") === 0 ? "Key AQ lista" : "Key AIza lista") +
          " · " +
          model;
      }
    }

    if (key) {
      setStatus("ok", "Key detectada · " + model);
    } else {
      setStatus("warn", "Pega tu API key de Gemini: AQ... o AIza...");
    }
  }

  function debounce(fn, ms) {
    var h;
    return function () {
      var args = arguments;
      clearTimeout(h);
      h = setTimeout(function () {
        fn.apply(null, args);
      }, ms);
    };
  }

  async function testConnection() {
    var key = getKey();

    if (!validKey(key)) {
      setStatus("bad", "Key inválida o vacía.");
      log("No hay una key válida. Debe empezar por AQ... o AIza...");
      return;
    }

    var btn = q("#testBtn");
    var oldText = btn ? btn.textContent : "Probar conexión";

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Probando…";
    }

    setStatus("run", "Probando Gemini…");

    try {
      var out = await window.callGemini(
        "Responde exactamente con una palabra: OK",
        {
          json: false,
          temperature: 0,
          max_tokens: 30
        }
      );

      setStatus("ok", "Conexión correcta ✔ " + out.trim().slice(0, 80));
      log("Éxito: " + out.trim());

      if (typeof toast === "function") toast("Conexión correcta ✔");
      if (typeof setStat === "function") setStat("ok", "Conectado");
    } catch (e) {
      var msg = friendlyError(e);
      setStatus("bad", "Fallo: " + msg.slice(0, 180));
      log("ERROR: " + msg);
      if (e && e.stack) log(e.stack);

      if (typeof toast === "function") toast("Fallo: " + msg.slice(0, 140));
      if (typeof setStat === "function") setStat("bad", "Error");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  async function listModelsAction() {
    setStatus("run", "Consultando modelos disponibles…");

    try {
      var models = await fetchModels();
      setStatus("ok", "Modelos disponibles: " + models.length);
      log("Modelos cargados: " + models.join(", "));
      updateConnFixed();
    } catch (e) {
      var msg = friendlyError(e);
      setStatus("bad", "No se pudieron listar modelos: " + msg.slice(0, 160));
      log("ERROR LISTANDO MODELOS: " + msg);
    }
  }

  function bindUI() {
    updateModelSelect();

    var keyInput = q("#apiKey");
    if (keyInput) {
      keyInput.placeholder = "AQ... o AIza...";

      keyInput.addEventListener("input", debounce(function () {
        var raw = String(keyInput.value || "").trim();

        if (validKey(raw)) {
          setStateProp("key", raw);
        } else {
          setStateProp("key", "");
        }

        saveCfgFixed();
        updateConnFixed();
      }, 180));
    }

    var modelSel = q("#model");
    if (modelSel) {
      modelSel.addEventListener("change", function () {
        setModel(modelSel.value);
        saveCfgFixed();
        updateConnFixed();
      });
    }

    var customModel = q("#customModel");
    if (customModel) {
      customModel.addEventListener("input", debounce(function () {
        saveCfgFixed();
        updateConnFixed();
      }, 250));
    }

    var testBtn = q("#testBtn");
    if (testBtn) {
      testBtn.onclick = function () {
        testConnection();
      };
    }

    var runBtn = q("#runBtn");
    if (runBtn) {
      runBtn.onclick = function () {
        if (typeof runPipeline === "function") {
          runPipeline();
        } else {
          ensurePanel();
          setStatus("bad", "runPipeline no cargó.");
          log("El script principal de Praxis no definió runPipeline. Probablemente hay un error de JavaScript anterior.");
        }
      };
    }

    var eyeBtn = q("#eyeBtn");
    if (eyeBtn) {
      eyeBtn.onclick = function () {
        var input = q("#apiKey");
        if (input) input.type = input.type === "password" ? "text" : "password";
      };
    }
  }

  window.addEventListener("error", function (e) {
    ensurePanel();
    var msg = "JS ERROR: " + (e.message || "") + " @ " + (e.filename || "") + ":" + (e.lineno || "");
    log(msg);
    setStatus("bad", "Error JS: revisa el log del panel.");
  });

  window.addEventListener("unhandledrejection", function (e) {
    ensurePanel();
    var reason = e && e.reason;
    var msg = "PROMESA RECHAZADA: " + ((reason && reason.message) || reason);
    log(msg);
    setStatus("bad", "Promesa rechazada: revisa el log del panel.");
  });

  window.praxisFix = {
    test: testConnection,
    listModels: listModelsAction,
    log: log,
    getKey: getKey,
    getModel: getModel,
    validKey: validKey
  };

  window.updateConn = updateConnFixed;
  window.saveCfg = saveCfgFixed;

  if (typeof window.extractJSON !== "function") {
    window.extractJSON = extractJSONFallback;
  }

  ensurePanel();
  sanitizeStorage();
  loadCfgFixed();
  bootstrapKey();
  updateModelSelect();
  bindUI();
  updateConnFixed();
  saveCfgFixed();

  log("Praxis Fix Gemini v6 cargado.");
  log("Modelo recomendado: gemini-2.5-flash");
  log("Si ves 404 otra vez, pulsa Listar modelos.");

  if (validKey(getKey())) {
    fetchModels().then(function (models) {
      log("Auto-listado de modelos OK. Modelo seleccionado: " + getModel());
      log("Primeros modelos: " + models.slice(0, 12).join(", "));
      updateConnFixed();
    }).catch(function (e) {
      log("Auto-listado de modelos falló: " + String(e && e.message || e));
    });
  }
})();
