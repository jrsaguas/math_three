#!/usr/bin/env python3
"""
CONVERSOR CLI DE MARKDOWN A MICROSOFT WORD (.docx)
Compatible con Pandoc.exe y python-docx en entornos locales (Visual Studio Code).
"""

import sys
import os
import glob
import subprocess
import re

def convert_with_pandoc(input_md, output_docx):
    """Convierte usando el ejecutable de Pandoc."""
    try:
        cmd = ["pandoc", input_md, "-o", output_docx]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode == 0 and os.path.exists(output_docx):
            return True, "Conversión con Pandoc completada exitosamente."
        return False, res.stderr or "Pandoc no pudo generar el archivo."
    except FileNotFoundError:
        return False, "Ejecutable pandoc no encontrado en PATH del sistema."

def convert_with_python_docx(input_md, output_docx):
    """Fallback usando python-docx con soporte OMML para ecuaciones Word."""
    try:
        import docx
        from docx.shared import Inches, Pt, RGBColor
        from docx.enum.text import WD_ALIGN_PARAGRAPH
        from docx.oxml import parse_xml
    except ImportError:
        return False, "python-docx no está instalado en el entorno."

    with open(input_md, "r", encoding="utf-8") as f:
        content = f.read()

    doc = docx.Document()
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

        f_p = section.footer.paragraphs[0]
        f_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r = f_p.add_run("Praxis · Generado desde Visual Studio Code")
        r.font.size = Pt(8.5)
        r.font.color.rgb = RGBColor(140, 150, 160)

    def add_omml(p, latex_str, is_block=False):
        xml_safe = latex_str.strip().replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if is_block:
            xml = f'''<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                <m:oMath><m:r><m:t>{xml_safe}</m:t></m:r></m:oMath>
            </m:oMathPara>'''
            p._p.append(parse_xml(xml))
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(8)
        else:
            xml = f'''<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
                <m:r><m:t>{xml_safe}</m:t></m:r>
            </m:oMath>'''
            p._p.append(parse_xml(xml))

    lines = content.split('\n')
    in_block = False
    block_lines = []

    for line in lines:
        s = line.strip()
        if s.startswith("$$") and s.endswith("$$") and len(s) > 4:
            p = doc.add_paragraph()
            add_omml(p, s[2:-2], is_block=True)
            continue
        elif s == "$$":
            if in_block:
                in_block = False
                p = doc.add_paragraph()
                add_omml(p, " ".join(block_lines), is_block=True)
                block_lines = []
            else:
                in_block = True
                block_lines = []
            continue
        elif in_block:
            block_lines.append(s)
            continue

        if not s:
            continue

        if s.startswith("# "):
            h = doc.add_heading(s[2:], level=1)
            h.paragraph_format.space_before = Pt(18)
            h.paragraph_format.space_after = Pt(8)
            for r in h.runs:
                r.font.name = 'Georgia'
                r.font.size = Pt(20)
                r.font.bold = True
                r.font.color.rgb = RGBColor(26, 115, 232)
        elif s.startswith("## "):
            h = doc.add_heading(s[3:], level=2)
            h.paragraph_format.space_before = Pt(14)
            h.paragraph_format.space_after = Pt(6)
            for r in h.runs:
                r.font.name = 'Georgia'
                r.font.size = Pt(15)
                r.font.bold = True
                r.font.color.rgb = RGBColor(217, 48, 37)
        elif s.startswith("### "):
            h = doc.add_heading(s[4:], level=3)
            h.paragraph_format.space_before = Pt(10)
            h.paragraph_format.space_after = Pt(4)
            for r in h.runs:
                r.font.name = 'Georgia'
                r.font.size = Pt(13)
                r.font.bold = True
                r.font.color.rgb = RGBColor(23, 29, 41)
        elif s.startswith("#### "):
            h = doc.add_heading(s[5:], level=4)
            h.paragraph_format.space_before = Pt(8)
            h.paragraph_format.space_after = Pt(3)
            for r in h.runs:
                r.font.name = 'Georgia'
                r.font.size = Pt(11)
                r.font.bold = True
                r.font.color.rgb = RGBColor(70, 80, 95)
        elif s == "---":
            p = doc.add_paragraph()
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            r = p.add_run("――――――――――――――――――――――――――――――――――――――")
            r.font.color.rgb = RGBColor(200, 205, 215)
        else:
            is_bullet = s.startswith("* ") or s.startswith("- ")
            raw_text = s[2:] if is_bullet else s
            p = doc.add_paragraph(style='List Bullet' if is_bullet else 'Normal')
            p.paragraph_format.line_spacing = 1.25
            p.paragraph_format.space_after = Pt(4)

            parts = re.split(r'(\$[^\$]+?\$)', raw_text)
            for part in parts:
                if not part: continue
                if part.startswith("$") and part.endswith("$") and len(part) >= 2:
                    add_omml(p, part[1:-1], is_block=False)
                else:
                    subparts = re.split(r'(\*\*.*?\*\*|\*.*?\*)', part)
                    for sp in subparts:
                        if not sp: continue
                        if sp.startswith("**") and sp.endswith("**") and len(sp) >= 4:
                            r = p.add_run(sp[2:-2])
                            r.bold = True
                        elif sp.startswith("*") and sp.endswith("*") and len(sp) >= 2:
                            r = p.add_run(sp[1:-1])
                            r.italic = True
                        else:
                            p.add_run(sp)

    doc.save(output_docx)
    return True, "Conversión con python-docx completada exitosamente."

def main():
    args = sys.argv[1:]
    if args:
        target_files = args
    else:
        target_files = glob.glob("*.md")
        target_files = [f for f in target_files if not f.lower().startswith("readme")]

    if not target_files:
        print("No se encontraron archivos .md para convertir.")
        print("Uso: python convert.py <archivo.md>")
        return

    print("=" * 60)
    print(" CONVERSOR PRAXIS: MARKDOWN -> WORD (.docx)")
    print("=" * 60)

    for md_path in target_files:
        base, _ = os.path.splitext(md_path)
        docx_path = f"{base}.docx"
        print(f"\nProcesando: {md_path} -> {docx_path}")

        success, msg = convert_with_pandoc(md_path, docx_path)
        if success:
            print(f"  [OK] {msg}")
        else:
            print(f"  [AVISO] Pandoc no disponible directamente: {msg}")
            print(f"  -> Ejecutando motor de respaldo con python-docx...")
            success_py, msg_py = convert_with_python_docx(md_path, docx_path)
            if success_py:
                print(f"  [OK] {msg_py}")
            else:
                print(f"  [ERROR] {msg_py}")

    print("\nProceso finalizado.")

if __name__ == '__main__':
    main()
