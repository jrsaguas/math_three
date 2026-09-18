#!/usr/bin/env python3
"""
PRAXIS LOCAL WORKSPACE SERVER
Sirve la aplicación web en http://localhost:8000 y ofrece conversión automática
a Microsoft Word (.docx) usando Pandoc y python-docx instalados en el entorno.
"""

import http.server
import socketserver
import os
import sys
import json
import subprocess
import webbrowser
from urllib.parse import urlparse

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class PraxisRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/export_docx':
            self.handle_export_docx()
        elif parsed_path.path == '/api/save_md':
            self.handle_save_md()
        else:
            self.send_error(404, "Endpoint no encontrado")

    def handle_save_md(self):
        content_len = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_len)
        try:
            data = json.loads(post_body.decode('utf-8'))
            title = data.get('title', 'informe').strip()
            md_content = data.get('markdown', '')
            safe_title = "".join([c if c.isalnum() or c in "._- " else "_" for c in title])[:60].strip()
            filename = f"{safe_title}.md"
            filepath = os.path.join(DIRECTORY, filename)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(md_content)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            resp = json.dumps({"status": "ok", "filename": filename, "filepath": filepath})
            self.wfile.write(resp.encode('utf-8'))
            print(f"[Praxis Server] Guardado exitosamente: {filename}")
        except Exception as e:
            self.send_error(500, f"Error al guardar Markdown: {str(e)}")

    def handle_export_docx(self):
        content_len = int(self.headers.get('Content-Length', 0))
        post_body = self.rfile.read(content_len)
        try:
            data = json.loads(post_body.decode('utf-8'))
            title = data.get('title', 'informe').strip()
            md_content = data.get('markdown', '')
            safe_title = "".join([c if c.isalnum() or c in "._- " else "_" for c in title])[:60].strip()
            
            md_file = os.path.join(DIRECTORY, f"{safe_title}.md")
            docx_file = os.path.join(DIRECTORY, f"{safe_title}.docx")

            with open(md_file, 'w', encoding='utf-8') as f:
                f.write(md_content)

            # 1. Intentar con Pandoc
            pandoc_success = False
            try:
                cmd = ["pandoc", md_file, "-o", docx_file]
                res = subprocess.run(cmd, capture_output=True, text=True)
                if res.returncode == 0 and os.path.exists(docx_file):
                    pandoc_success = True
                    print(f"[Praxis Server] Convertido con Pandoc: {docx_file}")
            except Exception as pe:
                print(f"[Praxis Server] Pandoc no disponible directamente: {pe}")

            # 2. Fallback a convert.py si Pandoc no estuvo disponible
            if not pandoc_success:
                converter_script = os.path.join(DIRECTORY, "convert.py")
                if not os.path.exists(converter_script):
                    converter_script = os.path.join(DIRECTORY, "convert_md_to_docx.py")
                if os.path.exists(converter_script):
                    subprocess.run([sys.executable, converter_script, md_file, docx_file], check=True)
                    print(f"[Praxis Server] Convertido con python-docx: {docx_file}")

            # Enviar el archivo docx como respuesta de descarga
            if os.path.exists(docx_file):
                with open(docx_file, 'rb') as f:
                    docx_bytes = f.read()

                self.send_response(200)
                self.send_header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
                self.send_header('Content-Disposition', f'attachment; filename="{safe_title}.docx"')
                self.send_header('Content-Length', str(len(docx_bytes)))
                self.end_headers()
                self.wfile.write(docx_bytes)
            else:
                self.send_error(500, "No se pudo generar el archivo .docx")

        except Exception as e:
            self.send_error(500, f"Error en la conversión a Word: {str(e)}")

def run_server():
    os.chdir(DIRECTORY)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), PraxisRequestHandler) as httpd:
        url = f"http://localhost:{PORT}"
        print("=" * 60)
        print(" PRAXIS SERVER - ENTORNO LOCAL ACTIVO")
        print(f" URL Local: {url}")
        print(f" Directorio de trabajo: {DIRECTORY}")
        print(" Presione Ctrl+C en la terminal para detener el servidor.")
        print("=" * 60)
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor detenido.")

if __name__ == '__main__':
    run_server()
