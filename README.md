# Praxis · Orquestador Cognitivo de Matemáticas (Gemini v6 Engine)

Suite completa para análisis, formalización e investigación de problemas matemáticos utilizando la API de Google Gemini.

## 📂 Contenido del Proyecto
- **`index.html`**: Aplicación web definitiva y unificada. Integra de forma nativa el motor resiliente v6 (sin scripts externos), con selector dinámico de modelos, fallback de autenticación (Header `x-goog-api-key` y Query `?key=`), soporte para claves `AIza...` y `AQ...`, renderizado LaTeX con MathJax v3, figuras matemáticas en SVG interactivo y exportación a HTML y Markdown para Word.
- **`test.html`**: Utilidad autónoma de diagnóstico para verificar desde el móvil o navegador si tu API Key de Gemini responde correctamente (test de Header vs Query, códigos HTTP 200, 401, 403, 404, 429 y bloqueos CORS).
- **`gemini-aq-patch.js`**: Módulo/parche standalone v6 desacoplado, útil si deseas inyectar este motor de conexión en otras aplicaciones web o pruebas modulares.

## 🚀 Despliegue en GitHub Pages
1. Sube estos archivos a tu repositorio en GitHub.
2. Ve a **Settings > Pages** en tu repositorio.
3. En **Build and deployment > Branch**, selecciona `main` (o la rama donde esté) y carpeta `/ (root)`.
4. Haz clic en **Save**. En un par de minutos tu aplicación estará disponible en `https://<tu-usuario>.github.io/<tu-repo>/`.

## 🔑 Configuración de API Key
- Puedes utilizar tanto claves estándar de [Google AI Studio](https://aistudio.google.com/api-keys) (`AIza...`) como tokens/claves de despliegue (`AQ...`).
- La clave se guarda de manera 100% privada en el `localStorage` de tu navegador; no viaja a ningún servidor intermediario ni queda expuesta en el código fuente.
- En caso de dudas sobre conectividad móvil, abre directamente `test.html` en tu navegador móvil.
