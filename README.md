# Praxis V7 Suite · Guía de Ejecución Local en Visual Studio Code

Suite completa de orquestación cognitiva matemática y exportación a Microsoft Word (.docx y .doc con ecuaciones nativas 2D).

## Seguridad importante

- No se incluye ninguna API key ni secreto en este repositorio.
- La aplicación debe utilizar tu propia clave de Google Gemini y pegarla manualmente en la interfaz.
- La clave se almacena solo en el navegador del usuario (localStorage) y se recomienda borrarla al terminar la sesión.
- Si se detecta una clave antigua, se elimina al iniciar la app para evitar conservar credenciales en el equipo.

## 1. Requisitos y Entorno Virtual (.venv)
Ya tienes instalado en tu entorno:
- Python 3
- `pandoc.exe` (Windows)
- `python-docx`, `pypandoc`, `lxml`

## 2. Cómo ejecutar desde Visual Studio Code

### Paso A: Abrir la carpeta en VS Code
1. Abre **Visual Studio Code**.
2. Ve a `File` -> `Open Folder...` y selecciona la carpeta de tu repositorio:
   `C:\Users\EL JEFE\Documents\praxis_v7_suite`

### Paso B: Abrir la Terminal Integrada de PowerShell
1. Abre la terminal en VS Code: `Terminal` -> `New Terminal` (o presiona `Ctrl + \``).
2. Asegúrate de que el entorno virtual esté activo:
   `(.venv) PS C:\Users\EL JEFE\Documents\praxis_v7_suite>`
   *(Si no está activo, actívalo con: `.\.venv\Scripts\Activate.ps1`)*

### Paso C: Iniciar el Servidor Local
Ejecuta en la terminal:
```powershell
python server.py
```
Esto iniciará el servidor en `http://localhost:8000` y abrirá automáticamente tu navegador.
- Al correr bajo el servidor local HTTP, se eliminan todas las restricciones de descarga de archivos del navegador.
- Cuando pulses el botón **`⬇ Word (.docx)`** en la aplicación web, el servidor invocará automáticamente tu `pandoc.exe` local y te descargará el Word con ecuaciones 100% nativas OMML de Microsoft Word.

## 3. Conversión Directa de Archivos Markdown desde la Terminal
Si ya tienes un archivo Markdown (como `Investigaci_n_rigurosa_del_sistema_din_mico_lineal.md`), puedes compilarlo directamente a Word con Pandoc:

```powershell
python convert.py
```
O especificando el archivo:
```powershell
python convert.py "Investigaci_n_rigurosa_del_sistema_din_mico_lineal.md"
```
O directamente con el comando de Pandoc:
```powershell
pandoc "Investigaci_n_rigurosa_del_sistema_din_mico_lineal.md" -o "Resultado.docx"
```

## 4. Archivos Incluidos
- `index.html`: Aplicación web con Laboratorio Interactivo, MathJax v3 y Capa de Conocimiento Matemático.
- `server.py`: Servidor local con API de compilación a Word vía Pandoc.
- `convert.py`: Conversor CLI para terminal.
- `app_engine.js`: Motor cognitivo modular de agentes.
- `Investigaci_n_rigurosa_del_sistema_din_mico_lineal.docx`: Word nativo con ecuaciones OMML sin duplicaciones.
- `Investigaci_n_rigurosa_del_sistema_din_mico_lineal_MathML.doc`: Word con MathML editable 2D.
- `Investigaci_n_rigurosa_del_sistema_din_mico_lineal.md`: Markdown canónico estándar.

## 5. Uso de la API key de Gemini

1. Genera tu clave en Google AI Studio.
2. Pégala en el campo de la interfaz de la aplicación.
3. Si quieres borrarla, usa el botón de limpiar o limpia el almacenamiento local del navegador.
4. Nunca compartas la clave en el repositorio ni en archivos de texto visibles.
