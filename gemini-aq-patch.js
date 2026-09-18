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

  function q(sel) { return document.querySelector(sel); }
  function safeJson(x) {
    try { return JSON.stringify(x, null, 2); }
    catch (e) { return String(x); }
  }
  function unique(arr) {
    var out = [], seen = {};
    for (var i = 0; i < arr.length; i++) {
      var v = String(arr[i] || "").trim();
      if (v && !seen[v]) { seen[v] = 1; out.push(v); }
    }
    return out;
  }
  function validKey(k) {
    k = String(k || "").trim();
    return /^AIza[0-9A-Za-z_-]{20,}$/.test(k) || /^AQ\.[A-Za-z0-9_.-]{20,}$/.test(k);
  }
  function getStoredCfg() {
    try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); }
    catch (e) { return {}; }
  }
  function setStoredCfg(cfg) {
    try { localStorage.setItem(STORAGE, JSON.stringify(cfg)); }
    catch (e) {}
  }
  function getStateProp(prop, fallback) {
    if (typeof S !== "undefined" && S && S[prop] != null) return S[prop];
    return fallback;
  }
  function setStateProp(prop, value) {
    if (typeof S !== "undefined" && S) S[prop] = value;
  }
  function getKey() {
    var input = q("#apiKey");
    var val = input ? String(input.value || "").trim() : "";
    if (validKey(val)) return val;
    var s = getStateProp("key", "");
    if (validKey(s)) return String(s).trim();
    var stored = getStoredCfg();
    if (validKey(stored.key)) return String(stored.key).trim();
    return "";
  }
  function setKey(k) {
    k = String(k || "").trim();
    setStateProp("key", validKey(k) ? k : "");
    var input = q("#apiKey");
    if (input) input.value = validKey(k) ? k : "";
  }
  function getModel() {
    var sel = q("#model");
    var selected = sel ? String(sel.value || "").trim() : "";
    var model = selected || getStateProp("model", "") || getStoredCfg().model || PREFERRED[0];
    if (model === "custom") {
      var custom = q("#customModel");
      var name = custom ? String(custom.value || "").trim() : "";
      if (name) return name;
      model = PREFERRED[0];
    }
    if (!model || model === "gemini-2.0-flash-exp") model = PREFERRED[0];
    return model;
  }
  function setModel(m) {
    var model = String(m || "").trim() || PREFERRED[0];
    setStateProp("model", model);
    var sel = q("#model");
    if (sel) sel.value = model;
    var custom = q("#customModel");
    if (custom) custom.style.display = model === "custom" ? "block" : "none";
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
      opt.textContent = value === "custom" ? "Personalizado…" : (value === PREFERRED[0] ? value + " (recomendado)" : value);
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
        customModel: q("#customModel") ? String(q("#customModel").value || "").trim() : "",
        audience: getStateProp("audience", "doctor"),
        depth: getStateProp("depth", "profunda"),
        tools: getStateProp("tools", { web: true, pdf: true, zip: false, code: false })
      };
      setStoredCfg(payload);
    } catch (e) {}
  }
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
        txt.textContent = (key.indexOf("AQ.") === 0 ? "Key AQ lista" : "Key AIza lista") + " · " + model;
      }
    }
    ensurePanel();
    if (statusEl) {
      statusEl.className = "pfp-status " + (key ? "ok" : "warn");
      statusEl.textContent = key ? ("Key detectada · " + model) : "Pega tu API key de Gemini: AQ... o AIza...";
    }
  }

  function ensurePanel() {
    if (window.__PRAxIS_FIX_PANEL__) return;
    var panel = document.getElementById("praxisFixPanel");
    if (!panel) {
      var style = document.createElement("style");
      style.textContent = "#praxisFixPanel{position:fixed;right:12px;bottom:12px;width:min(430px,calc(100vw - 24px));max-height:min(64vh,650px);background:#0b1220;color:#e5e7eb;border:1px solid #334155;border-radius:14px;box-shadow:0 18px 60px rgba(0,0,0,.55);z-index:2147483647;font:13px system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;display:flex;flex-direction:column;overflow:hidden}#praxisFixPanel.min{max-height:44px}.pfp-head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:#111827;border-bottom:1px solid #334155;cursor:pointer;user-select:none}.pfp-head b{flex:1;font-size:13px}.pfp-body{padding:10px;display:flex;flex-direction:column;gap:8px;min-height:0}#praxisFixPanel.min .pfp-body{display:none}.pfp-row{display:flex;gap:8px;flex-wrap:wrap}.pfp-row button{flex:1;min-width:120px}#praxisFixPanel button{padding:10px 12px;border-radius:10px;border:1px solid #475569;background:#1f2937;color:#e5e7eb;font:inherit;cursor:pointer}#praxisFixPanel button.primary{background:#1a73e8;border-color:#1a73e8;color:#fff;font-weight:800}#praxisFixPanel button.good{background:#14532d;border-color:#166534;color:#fff;font-weight:800}#praxisFixPanel button.danger{background:#7f1d1d;border-color:#991b1b;color:#fff}.pfp-status{padding:10px;border-radius:10px;border:1px solid #334155;background:#111827;font-weight:800;word-break:break-word}.pfp-status.ok{background:#052e16;border-color:#14532d;color:#86efac}.pfp-status.bad{background:#450a0a;border-color:#7f1d1d;color:#fecaca}.pfp-status.warn{background:#422006;border-color:#713f12;color:#fde68a}.pfp-status.run{background:#0c1a3a;border-color:#1d4ed8;color:#bfdbfe}#pfpLog{background:#020617;border:1px solid #1e293b;border-radius:10px;padding:10px;min-height:150px;max-height:34vh;overflow:auto;white-space:pre-wrap;word-break:break-word;font:12px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#d1d5db;margin:0}";
      document.head.appendChild(style);
      panel = document.createElement("div");
      panel.id = "praxisFixPanel";
      panel.innerHTML = '<div class="pfp-head"><b>Praxis Fix · Gemini v6</b><span id="pfpToggle">—</span></div><div class="pfp-body"><div id="pfpStatus" class="pfp-status">Cargando…</div><div class="pfp-row"><button id="pfpListModels" class="good">Listar modelos</button><button id="pfpTest" class="primary">Probar key</button></div><div class="pfp-row"><button id="pfpCopy">Copiar log</button><button id="pfpReload">Recargar</button></div><div class="pfp-row"><button id="pfpClear" class="danger">Borrar key local</button></div><pre id="pfpLog"></pre></div>';
      document.body.appendChild(panel);
      window.__PRAxIS_FIX_PANEL__ = true;
    }
    window.__pfpLog = panel.querySelector("#pfpLog");
    window.__pfpStatus = panel.querySelector("#pfpStatus");
    if (panel.querySelector(".pfp-head")) {
      panel.querySelector(".pfp-head").onclick = function () {
        panel.classList.toggle("min");
        var toggle = panel.querySelector("#pfpToggle");
        if (toggle) toggle.textContent = panel.classList.contains("min") ? "+" : "—";
      };
    }
    if (panel.querySelector("#pfpTest")) panel.querySelector("#pfpTest").onclick = testConnection;
    if (panel.querySelector("#pfpListModels")) panel.querySelector("#pfpListModels").onclick = listModelsAction;
    if (panel.querySelector("#pfpCopy")) panel.querySelector("#pfpCopy").onclick = function () {
      var text = window.__pfpLog ? window.__pfpLog.textContent || "" : "";
      navigator.clipboard.writeText(text).then(function () { setStatus("ok", "Log copiado."); }).catch(function () { setStatus("warn", "No se pudo copiar automáticamente."); });
    };
    if (panel.querySelector("#pfpClear")) panel.querySelector("#pfpClear").onclick = function () {
      try { localStorage.removeItem(STORAGE); } catch (e) {}
      setKey("");
      saveCfgFixed();
      updateConnFixed();
      setStatus("warn", "Clave borrada del almacenamiento local.");
    };
    if (panel.querySelector("#pfpReload")) panel.querySelector("#pfpReload").onclick = function () { location.reload(); };
  }
  function log(msg) {
    ensurePanel();
    var text = typeof msg === "string" ? msg : safeJson(msg);
    if (window.__pfpLog) {
      window.__pfpLog.textContent += "[" + new Date().toLocaleTimeString() + "] " + text + "\n\n";
      window.__pfpLog.scrollTop = window.__pfpLog.scrollHeight;
    }
    console.log("[PraxisFix v6]", msg);
  }
  function setStatus(type, msg) {
    ensurePanel();
    if (window.__pfpStatus) {
      window.__pfpStatus.className = "pfp-status " + type;
      window.__pfpStatus.textContent = msg;
    }
  }

  function rawFetch(url, init) {
    return fetch(url, init).then(async function (res) {
      var text = await res.text();
      var json = null;
      try { json = JSON.parse(text); } catch (e) {}
      if (!res.ok) {
        var msg = (json && json.error && json.error.message) || text.slice(0, 700) || res.statusText;
        var err = new Error("HTTP " + res.status + ": " + msg);
        err.status = res.status;
        err.json = json;
        err.text = text;
        throw err;
      }
      return json || {};
    });
  }
  function friendlyError(e) {
    var msg = String(e && e.message || e || "Error desconocido");
    var status = e && e.status;
    if (/Failed to fetch|NetworkError|Load failed|CORS/i.test(msg)) return "Error de red/CORS. Abre la URL pública del sitio, no github.com/blob ni raw.githubusercontent.com. Detalle: " + msg;
    if (status === 400) return "HTTP 400: petición inválida. Puede ser el modelo o la estructura del JSON. Detalle: " + msg;
    if (status === 401) return "HTTP 401: API key inválida o no autorizada. Crea una nueva key en Google AI Studio. Detalle: " + msg;
    if (status === 403) return "HTTP 403: permiso denegado. Revisa restricciones de la key, cuota y proyecto. Detalle: " + msg;
    if (status === 404) return "HTTP 404: modelo no disponible. Pulsa Listar modelos o usa gemini-2.5-flash. Detalle: " + msg;
    if (status === 429) return "HTTP 429: cuota agotada o rate limit. Espera un momento. Detalle: " + msg;
    return msg;
  }
  function extractTextFromGemini(json) {
    json = json || {};
    var cand = json.candidates && json.candidates[0];
    if (!cand) throw new Error("Gemini no devolvió candidatos válidos: " + safeJson(json).slice(0, 500));
    if (cand.finishReason === "MAX_TOKENS") throw new Error("Respuesta truncada por MAX_TOKENS.");
    var parts = (cand.content && cand.content.parts) || [];
    var text = parts.map(function (p) { return p && p.text ? p.text : ""; }).join("");
    if (!text.trim()) throw new Error("Gemini devolvió un texto vacío.");
    return text;
  }
  function extractJSONFallback(text) {
    if (!text) throw new Error("respuesta vacía");
    var t = String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    var first = t.search(/[{[]/);
    if (first >= 0) {
      var open = t[first];
      var close = open === "{" ? "}" : "]";
      var depth = 0, inStr = false, esc = false, end = -1;
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
            if (depth === 0) { end = i; break; }
          }
        }
      }
      if (end > first) t = t.slice(first, end + 1);
    }
    try { return JSON.parse(t); }
    catch (e) {
      try { return JSON.parse(t.replace(/,\s*([}\]])/g, "$1")); }
      catch (e2) { throw new Error("La IA no devolvió JSON válido. " + String(e2 && e2.message || e2)); }
    }
  }
  async function fetchModels() {
    var key = getKey();
    if (!validKey(key)) throw new Error("Falta una API key válida.");
    var url = API_BASE + "/models?pageSize=200";
    var json = null;
    try {
      json = await rawFetch(url, { method: "GET", mode: "cors", headers: { "x-goog-api-key": key } });
    } catch (e) {
      log("GET /models con header falló: " + String(e && e.message || e));
      json = await rawFetch(url + "?key=" + encodeURIComponent(key), { method: "GET", mode: "cors" });
    }
    var models = Array.isArray(json.models) ? json.models : [];
    var parsed = models.map(function (m) {
      var name = String(m.name || "").replace(/^models\//, "").trim();
      var methods = Array.isArray(m.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
      return { name: name, methods: methods };
    }).filter(function (m) { return !!m.name; });
    var usable = parsed.filter(function (m) {
      return !m.methods.length || m.methods.indexOf("generateContent") >= 0 || m.methods.indexOf("streamGenerateContent") >= 0;
    }).map(function (m) { return m.name; });
    var all = parsed.map(function (m) { return m.name; });
    cachedModels = unique(usable.concat(all));
    cachedModels.sort(function (a, b) {
      var ia = PREFERRED.indexOf(a), ib = PREFERRED.indexOf(b);
      if (ia < 0) ia = 999; if (ib < 0) ib = 999;
      if (ia !== ib) return ia - ib;
      return String(a).localeCompare(String(b));
    });
    if (!cachedModels.length) throw new Error("No se encontraron modelos disponibles.");
    var current = getModel();
    var preferredFound = null;
    for (var i = 0; i < PREFERRED.length; i++) {
      if (cachedModels.indexOf(PREFERRED[i]) >= 0) { preferredFound = PREFERRED[i]; break; }
    }
    var chosen = cachedModels.indexOf(current) >= 0 ? current : (preferredFound || cachedModels[0]);
    setModel(chosen);
    updateModelSelect();
    saveCfgFixed();
    return cachedModels;
  }
  async function callGemini(prompt, opts) {
    opts = opts || {};
    var key = getKey();
    if (!validKey(key)) throw new Error("Falta una API key válida. Debe empezar por AQ... o AIza...");
    var candidates = unique([getModel()].concat(cachedModels.length ? cachedModels : PREFERRED)).slice(0, 6);
    var lastError = null;
    for (var ci = 0; ci < candidates.length; ci++) {
      var model = candidates[ci];
      var base = API_BASE + "/models/" + encodeURIComponent(model) + ":generateContent";
      var authModes = ["header", "query"];
      for (var ai = 0; ai < authModes.length; ai++) {
        var auth = authModes[ai];
        var jsonAttempts = opts.json === false ? [false] : [true, false];
        for (var ji = 0; ji < jsonAttempts.length; ji++) {
          var useJson = jsonAttempts[ji];
          var url = auth === "query" ? base + "?key=" + encodeURIComponent(key) : base;
          var headers = { "Content-Type": "application/json" };
          if (auth === "header") headers["x-goog-api-key"] = key;
          var generationConfig = {
            temperature: opts.temperature != null ? opts.temperature : 0.4,
            topP: opts.topP != null ? opts.topP : 0.95,
            maxOutputTokens: opts.max_tokens != null ? opts.max_tokens : 8192
          };
          if (useJson) generationConfig.responseMimeType = "application/json";
          var body = { contents: [{ parts: [{ text: String(prompt || "") }] }], generationConfig: generationConfig };
          try {
            var json = await rawFetch(url, { method: "POST", mode: "cors", headers: headers, body: JSON.stringify(body) });
            setModel(model); saveCfgFixed(); updateConnFixed();
            return extractTextFromGemini(json);
          } catch (e) {
            lastError = e;
            var msg = String(e && e.message || "");
            if (e && e.status === 404 && /model|NOT_FOUND|no longer available/i.test(msg)) {
              log("Modelo no disponible: " + model + ". Probando siguiente...");
              break;
            }
            if (e && e.status === 400 && useJson && /responseMimeType|JSON/i.test(msg)) {
              log("El modelo " + model + " rechazó JSON mode. Reintentando sin JSON...");
              continue;
            }
            if (e && (e.status === 401 || e.status === 403 || e.status === 429)) throw new Error(friendlyError(e));
            log("Intento fallido: model=" + model + ", auth=" + auth + ", json=" + useJson + ", error=" + msg);
          }
        }
      }
    }
    throw new Error(friendlyError(lastError));
  }
  async function askJSON(prompt, opts) {
    opts = opts || {};
    var raw = await callGemini(prompt, Object.assign({ json: true }, opts));
    return extractJSONFallback(raw);
  }

  async function testConnection() {
    var key = getKey();
    if (!validKey(key)) {
      setStatus("bad", "Key inválida o vacía.");
      log("No hay key válida. Debe empezar por AQ... o AIza...");
      return;
    }
    var btn = q("#testBtn");
    if (btn) {
      var oldText = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Probando…";
    }
    setStatus("run", "Probando Gemini…");
    try {
      var out = await callGemini("Responde exactamente con una palabra: OK", { json: false, temperature: 0, max_tokens: 30 });
      setStatus("ok", "Conexión correcta ✔ " + out.trim().slice(0, 80));
      log("Éxito: " + out.trim());
      if (typeof toast === "function") toast("Conexión correcta ✔");
    } catch (e) {
      var msg = friendlyError(e);
      setStatus("bad", "Fallo: " + msg.slice(0, 180));
      log("ERROR: " + msg);
      if (typeof toast === "function") toast("Fallo: " + msg.slice(0, 140));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText || "Probar conexión";
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
  function debounce(fn, ms) {
    var h;
    return function () {
      var args = arguments;
      clearTimeout(h);
      h = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }
  function initBindings() {
    var input = q("#apiKey");
    if (input) {
      input.addEventListener("input", debounce(function () {
        var raw = String(input.value || "").trim(); setStateProp("key", validKey(raw) ? raw : ""); saveCfgFixed(); updateConnFixed();
      }, 180));
    }
    var modelSel = q("#model");
    if (modelSel) {
      modelSel.addEventListener("change", function () { setModel(modelSel.value); saveCfgFixed(); updateConnFixed(); });
    }
    var custom = q("#customModel");
    if (custom) custom.addEventListener("input", debounce(function () { saveCfgFixed(); updateConnFixed(); }, 220));
    var testBtn = q("#testBtn");
    if (testBtn) testBtn.onclick = testConnection;
    var listBtn = q("#listModelsBtn");
    if (listBtn) listBtn.onclick = listModelsAction;
    var eyeBtn = q("#eyeBtn");
    if (eyeBtn) {
      eyeBtn.onclick = function () {
        var api = q("#apiKey");
        if (api) api.type = api.type === "password" ? "text" : "password";
      };
    }
  }

  function bootstrap() {
    var stored = getStoredCfg();
    if (validKey(stored.key)) setKey(stored.key);
    if (!getStateProp("model", "") && stored.model) setStateProp("model", stored.model);
    if (!getStateProp("model", "")) setStateProp("model", PREFERRED[0]);
    if (q("#apiKey") && q("#apiKey").value.trim() === "" && validKey(getStateProp("key", ""))) q("#apiKey").value = getStateProp("key");
    updateModelSelect();
    initBindings();
    updateConnFixed();
    saveCfgFixed();
  }

  window.callGemini = callGemini;
  window.askJSON = askJSON;
  window.updateConn = updateConnFixed;
  window.saveCfg = saveCfgFixed;
  window.extractJSON = extractJSONFallback;
  window.praxisFix = { test: testConnection, listModels: listModelsAction, validKey: validKey, getKey: getKey, getModel: getModel };

  ensurePanel();
  bootstrap();
  log("Praxis Fix Gemini v6 cargado.");
  log("Modelo recomendado: gemini-2.5-flash");
  if (validKey(getKey())) {
    fetchModels().then(function (models) {
      log("Auto-listado de modelos OK. Seleccionado: " + getModel());
      log("Modelos: " + models.slice(0, 10).join(", "));
    }).catch(function (e) {
      log("Auto-listado falló: " + String(e && e.message || e));
    });
  }
})();
