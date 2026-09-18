/* ===== PATCH FINAL GEMINI AQ: acepta AIza y AQ, usa x-goog-api-key, muestra errores ===== */
(function () {
  if (window.__PRAXIS_GEMINI_AQ_PATCH__) return;
  window.__PRAXIS_GEMINI_AQ_PATCH__ = true;

  const q = s => document.querySelector(s);
  const qa = s => Array.from(document.querySelectorAll(s));

  function debounce(fn, ms) {
    let h;
    return (...a) => {
      clearTimeout(h);
      h = setTimeout(() => fn(...a), ms);
    };
  }

  function notify(msg) {
    if (typeof toast === "function") toast(msg);
    else console.log(msg);
  }

  function stat(cls, txt) {
    if (typeof setStat === "function") setStat(cls, txt);
  }

  let errBox = q("#jsError");
  if (!errBox) {
    errBox = document.createElement("div");
    errBox.id = "jsError";
    errBox.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:99999;display:none;" +
      "background:#b00020;color:#fff;padding:10px 14px;" +
      "font:12px ui-monospace,monospace;white-space:pre-wrap;" +
      "max-height:35vh;overflow:auto;";
    document.body.insertBefore(errBox, document.body.firstChild);
  }

  function showErr(msg) {
    const text = String(msg || "").slice(0, 3000);
    console.error(text);
    errBox.style.display = "block";
    errBox.textContent += text + "\n";
    errBox.scrollTop = errBox.scrollHeight;
  }

  window.addEventListener("error", e => {
    showErr("JS ERROR: " + e.message + " @ " + (e.filename || "") + ":" + (e.lineno || ""));
  });

  window.addEventListener("unhandledrejection", e => {
    showErr("PROMESA RECHAZADA: " + ((e.reason && e.reason.message) || e.reason));
  });

  function validKey(k) {
    k = String(k || "").trim();
    return /^AIza[0-9A-Za-z_-]{20,}$/.test(k) || /^AQ\.[A-Za-z0-9_.-]{20,}$/.test(k);
  }

  window.validGeminiKey = validKey;

  const keyInput = q("#apiKey");
  const modelSel = q("#model");
  const customInput = q("#customModel");

  const preferredModels = [
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "custom"
  ];

  if (modelSel) {
    const existing = new Set(qa("#model option").map(o => o.value));
    preferredModels.forEach(v => {
      if (!existing.has(v)) {
        const o = document.createElement("option");
        o.value = v;
        o.textContent = v === "gemini-flash-latest" ? "gemini-flash-latest (recomendado)" : v;
        modelSel.appendChild(o);
      }
    });
    if (!modelSel.value || modelSel.value === "gemini-2.0-flash-exp") modelSel.value = "gemini-flash-latest";
    if (customInput) customInput.style.display = modelSel.value === "custom" ? "block" : "none";
  }

  if (typeof S !== "undefined") {
    const inputKey = keyInput && keyInput.value ? keyInput.value.trim() : "";
    if (validKey(inputKey)) S.key = inputKey;
    if (!validKey(S.key)) S.key = "";
    if (modelSel) S.model = modelSel.value;
    if (customInput) S.customModel = customInput.value.trim();
    if (S.model === "custom" && !String(S.customModel || "").trim()) {
      S.model = "gemini-flash-latest";
      if (modelSel) modelSel.value = S.model;
      if (customInput) customInput.style.display = "none";
    }
  }

  function readCfg() {
    try {
      const raw = localStorage.getItem("praxis_gemini.cfg");
      const c = raw ? JSON.parse(raw) : {};
      if (typeof S === "undefined") return;
      if (validKey(c.key)) S.key = c.key;
      if (c.model && preferredModels.includes(c.model)) S.model = c.model;
      if (typeof c.customModel === "string") S.customModel = c.customModel;
      if (c.audience) S.audience = c.audience;
      if (c.depth) S.depth = c.depth;
      if (c.tools) S.tools = c.tools;
    } catch (e) {}
  }

  readCfg();
  if (typeof S !== "undefined" && !validKey(S.key)) S.key = "";
  if (modelSel && typeof S !== "undefined") {
    modelSel.value = S.model;
    if (customInput) customInput.style.display = S.model === "custom" ? "block" : "none";
  }
  if (customInput && typeof S !== "undefined") customInput.value = S.customModel || "";
  if (keyInput && typeof S !== "undefined" && validKey(S.key) && !keyInput.value) keyInput.value = S.key;

  window.saveCfg = function () {
    try {
      localStorage.setItem("praxis_gemini.cfg", JSON.stringify({
        key: validKey(S.key) ? S.key : "",
        model: S.model,
        customModel: S.customModel,
        audience: S.audience,
        depth: S.depth,
        tools: S.tools
      }));
    } catch (e) {}
  };

  window.loadCfg = function () {
    readCfg();
    if (!validKey(S.key)) S.key = "";
    if (!S.model || !preferredModels.includes(S.model)) S.model = "gemini-flash-latest";
    if (S.model === "custom" && !String(S.customModel || "").trim()) S.model = "gemini-flash-latest";
  };

  window.updateConn = function () {
    const pill = q("#connPill");
    const txt = q("#connTxt");
    if (!pill || !txt || typeof S === "undefined") return;
    const k = String(S.key || "").trim();
    const modelName = S.model === "custom" ? (S.customModel || "custom") : S.model;
    if (!k) {
      pill.className = "pill warn";
      txt.textContent = "Falta API key";
    } else if (!validKey(k)) {
      pill.className = "pill bad";
      txt.textContent = "Key no reconocida: usa AIza... o AQ....";
    } else {
      pill.className = "pill ok";
      txt.textContent = (k.startsWith("AQ.") ? "Key AQ lista" : "Key AIza lista") + " · " + modelName;
    }
  };

  function friendlyError(e) {
    if (!e) return "Error desconocido.";
    const msg = String(e.message || e);
    if (e.isNetwork || /Failed to fetch|NetworkError|CORS|load failed/i.test(msg)) {
      return "No se pudo conectar desde el navegador. Sirve el HTML en http://localhost, no lo abras como file://. Detalle: " + msg;
    }
    if (e.status === 400) return "400 Petición inválida. Detalle: " + msg;
    if (e.status === 401) return "401 API key inválida o no permitida. Detalle: " + msg;
    if (e.status === 403) return "403 Permiso denegado. Revisa restricciones, cuota y región. Detalle: " + msg;
    if (e.status === 404) return "404 Modelo no disponible. Usa gemini-flash-latest o gemini-2.5-flash. Detalle: " + msg;
    if (e.status === 429) return "429 Cuota/rate limit agotado. Detalle: " + msg;
    return msg;
  }

  function extractTextFromResponse(j) {
    if (j && j.promptFeedback && j.promptFeedback.blockReason) throw new Error("Contenido bloqueado por Gemini: " + j.promptFeedback.blockReason);
    const cand = (j && j.candidates && j.candidates[0]) || null;
    if (!cand) throw new Error("Gemini no devolvió candidatos: " + JSON.stringify(j).slice(0, 300));
    if (cand.finishReason === "MAX_TOKENS") throw new Error("Gemini truncó la respuesta (MAX_TOKENS).");
    if (cand.finishReason && cand.finishReason !== "STOP") throw new Error("Gemini terminó con finishReason=" + cand.finishReason);
    const text = ((cand.content && cand.content.parts) || []).map(p => (p && p.text) || "").join("");
    if (!text.trim()) throw new Error("Gemini devolvió texto vacío.");
    return text;
  }

  window.callGemini = async function (prompt, opts = {}) {
    const key = String(S.key || "").trim();
    if (!key) throw new Error("Falta la API key de Gemini.");
    if (!validKey(key)) throw new Error("La API key debe empezar por AIza... o AQ....");
    const model = S.model === "custom" ? (String(S.customModel || "").trim() || "gemini-flash-latest") : S.model;
    const base = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent";
    const ctrl = new AbortController();
    S.abort = ctrl;
    const makeConfig = includeJson => {
      const cfg = { temperature: opts.temperature ?? 0.4, topP: opts.topP ?? 0.95, maxOutputTokens: opts.max_tokens ?? 8192 };
      if (includeJson) cfg.responseMimeType = "application/json";
      return cfg;
    };
    async function send(url, headers, cfg) {
      let res, text;
      try {
        res = await fetch(url, { method: "POST", mode: "cors", headers: Object.assign({ "Content-Type": "application/json" }, headers || {}), body: JSON.stringify({ contents: [{ parts: [{ text: String(prompt || "") }] }], generationConfig: cfg }), signal: ctrl.signal });
        text = await res.text();
      } catch (e) {
        if (e && e.name === "AbortError") throw e;
        const err = new Error("No se pudo conectar con Gemini desde el navegador: " + e.message);
        err.isNetwork = true;
        throw err;
      }
      let json = null;
      try { json = JSON.parse(text); } catch (e) {}
      if (!res.ok) {
        const err = new Error("HTTP " + res.status + ": " + ((json && json.error && json.error.message) || text.slice(0, 500) || res.statusText));
        err.status = res.status;
        err.json = json;
        throw err;
      }
      return json || {};
    }
    const jsonAttempts = opts.json === false ? [false] : [true, false];
    const transports = [{ url: base, headers: { "x-goog-api-key": key } }, { url: base + "?key=" + encodeURIComponent(key), headers: {} }];
    let lastError = null;
    for (const useJson of jsonAttempts) {
      for (const tr of transports) {
        try { return extractTextFromResponse(await send(tr.url, tr.headers, makeConfig(useJson))); }
        catch (e) {
          lastError = e;
          if (e && e.name === "AbortError") throw e;
          if (e && (e.status === 403 || e.status === 404 || e.status === 429)) throw new Error(friendlyError(e));
        }
      }
    }
    throw new Error(friendlyError(lastError));
  };

  window.askJSON = async function (prompt, opts = {}) {
    return extractJSON(await callGemini(prompt, Object.assign({ json: true }, opts)));
  };

  const oldRunPipeline = window.runPipeline;
  if (typeof oldRunPipeline === "function") {
    window.runPipeline = async function () {
      if (!validKey(S.key)) {
        if (typeof openModal === "function") openModal("key");
        notify("Pega una API key válida de Gemini: AIza... o AQ....");
        return;
      }
      return oldRunPipeline.apply(this, arguments);
    };
  }

  if (keyInput) keyInput.addEventListener("input", () => { S.key = keyInput.value.trim(); saveCfg(); updateConn(); });
  if (modelSel) modelSel.addEventListener("change", () => { S.model = modelSel.value; if (customInput) customInput.style.display = S.model === "custom" ? "block" : "none"; saveCfg(); updateConn(); });
  if (customInput) customInput.addEventListener("input", debounce(() => { S.customModel = customInput.value.trim(); saveCfg(); updateConn(); }, 250));

  const testBtn = q("#testBtn");
  if (testBtn) testBtn.onclick = async () => {
    const k = (keyInput && keyInput.value ? keyInput.value : "").trim();
    S.key = k; saveCfg(); updateConn();
    if (!validKey(k)) { notify("Key no válida. Debe empezar por AIza... o AQ...."); showErr("Formato de key inválido"); return; }
    const oldText = testBtn.textContent;
    testBtn.disabled = true; testBtn.textContent = "Probando…"; stat("run", "Probando Gemini…");
    try {
      const out = await callGemini("Responde exactamente con una palabra: OK", { json: false, temperature: 0, max_tokens: 20 });
      notify("Conexión correcta ✔ " + out.trim().slice(0, 60)); stat("ok", "Conectado");
    } catch (e) { const msg = String(e && e.message || e); notify("Fallo: " + msg.slice(0, 180)); stat("bad", "Error"); showErr(e && e.stack ? e.stack : msg); }
    finally { testBtn.disabled = false; testBtn.textContent = oldText; }
  };

  updateConn();
  saveCfg();
})();
