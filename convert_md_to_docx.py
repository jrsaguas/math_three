import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import parse_xml

def convert_markdown_to_word_docx(md_path, docx_path):
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()

    doc = docx.Document()

    # Set page margins: 1 inch (2.54 cm)
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)
        
        # Header / Footer
        footer = section.footer
        f_p = footer.paragraphs[0]
        f_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        f_run = f_p.add_run("Praxis · Orquestador Cognitivo de Matemáticas")
        f_run.font.size = Pt(8.5)
        f_run.font.color.rgb = RGBColor(140, 150, 160)

    # Style defaults
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(11)
    normal_style.font.color.rgb = RGBColor(23, 29, 41)
    normal_style.paragraph_format.line_spacing = 1.25
    normal_style.paragraph_format.space_after = Pt(6)

    def add_omml(p, latex_str, is_block=False):
        # Escape XML
        clean = latex_str.strip()
        xml_safe = clean.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        if is_block:
            xml = f'''<m:oMathPara xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
                <m:oMath>
                    <m:r><m:t>{xml_safe}</m:t></m:r>
                </m:oMath>
            </m:oMathPara>'''
            p._p.append(parse_xml(xml))
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(8)
        else:
            xml = f'''<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
                <m:r><m:t>{xml_safe}</m:t></m:r>
            </m:oMath>'''
            p._p.append(parse_xml(xml))

    lines = content.split('\n')
    in_block_eq = False
    block_lines = []

    for line in lines:
        s = line.strip()

        # Check for block equation $$ ... $$
        if s.startswith("$$") and s.endswith("$$") and len(s) > 4:
            eq = s[2:-2].strip()
            p = doc.add_paragraph()
            add_omml(p, eq, is_block=True)
            continue
        elif s == "$$":
            if in_block_eq:
                in_block_eq = False
                eq = " ".join(block_lines).strip()
                p = doc.add_paragraph()
                add_omml(p, eq, is_block=True)
                block_lines = []
            else:
                in_block_eq = True
                block_lines = []
            continue
        elif in_block_eq:
            block_lines.append(s)
            continue

        if not s:
            continue

        # Headings
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
            # Paragraph or list item
            is_bullet = s.startswith("* ") or s.startswith("- ")
            raw_text = s[2:] if is_bullet else s

            p = doc.add_paragraph(style='List Bullet' if is_bullet else 'Normal')
            if is_bullet:
                p.paragraph_format.space_after = Pt(3)

            # Split strictly by inline math $...$
            # Note: non-capturing lookahead/behind to match $formula$
            parts = re.split(r'(\$[^\$]+?\$)', raw_text)
            for part in parts:
                if not part:
                    continue
                if part.startswith("$") and part.endswith("$") and len(part) >= 2:
                    # Inline math
                    eq_inline = part[1:-1].strip()
                    add_omml(p, eq_inline, is_block=False)
                else:
                    # Text with bold/italic
                    subparts = re.split(r'(\*\*.*?\*\*|\*.*?\*)', part)
                    for sp in subparts:
                        if not sp:
                            continue
                        if sp.startswith("**") and sp.endswith("**") and len(sp) >= 4:
                            r = p.add_run(sp[2:-2])
                            r.bold = True
                        elif sp.startswith("*") and sp.endswith("*") and len(sp) >= 2:
                            r = p.add_run(sp[1:-1])
                            r.italic = True
                        else:
                            p.add_run(sp)

    doc.save(docx_path)
    print("Converted successfully to:", docx_path)

convert_markdown_to_word_docx("An_lisis_Espectral_rbita_y_Estabilidad_del_Sistema.md", "An_lisis_Espectral_rbita_y_Estabilidad_del_Sistema.docx")
