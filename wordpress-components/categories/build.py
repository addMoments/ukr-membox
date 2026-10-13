#!/usr/bin/env python3
"""Kategori sayfasinin Elementor HTML bloklarini uretir.

sections/*.html sablonlari + copy.json metinleri -> dist/<dil>/<bolum>.html
Her dist dosyasi Elementor'da bir HTML widget'ina oldugu gibi yapistirilir.

Kullanim:
  python3 build.py                                    # dist/ uretir
  python3 build.py --shell en=home.html --shell uk=home-ua.html
                                                      # ayrica dist/preview-<dil>.html

--shell icin o dildeki canli bir sayfanin kaydedilmis HTML'i verilir (orn. ana sayfa);
sayfanin wp-page govdesi bu bloklarla degistirilir, header/footer oldugu gibi kalir.
"""
import argparse
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SECTION_RE = re.compile(r"\{\{([#^])([\w.]+)\}\}(.*?)\{\{/\2\}\}", re.S)
TAG_RE = re.compile(r"\{\{(\{)?\s*([\w.]+)\s*\}?\}\}")
CSS_RE = re.compile(r"/\*@css:([\w-]+)(?:\(([^)]+)\))?\*/")


def lookup(stack, name):
    if name == ".":
        return stack[-1]
    for ctx in reversed(stack):
        value = ctx
        for part in name.split("."):
            if isinstance(value, dict) and part in value:
                value = value[part]
            else:
                value = None
                break
        if value is not None:
            return value
    raise KeyError(f"copy.json'da yok: {name}")


def lookup_optional(stack, name):
    try:
        return lookup(stack, name)
    except KeyError:
        return None


# Kucuk bir mustache alt kumesi: {{x}} kacisli, {{{x}}} ham, {{#x}}..{{/x}} dongu/kosul,
# {{^x}}..{{/x}} ters kosul. Ayni adla ic ice bolum desteklenmez (gerek yok).
def render(tpl, stack):
    def section(m):
        kind, name, body = m.groups()
        value = lookup_optional(stack, name)
        if kind == "^":
            return render(body, stack) if not value else ""
        if not value:
            return ""
        if isinstance(value, list):
            return "".join(
                render(body, stack + [dict(item, _index=i + 1) if isinstance(item, dict) else item])
                for i, item in enumerate(value)
            )
        return render(body, stack + [value] if isinstance(value, dict) else stack)

    tpl = SECTION_RE.sub(section, tpl)

    def tag(m):
        raw, name = m.group(1), m.group(2)
        value = lookup(stack, name)
        return str(value) if raw else html.escape(str(value), quote=True)

    return TAG_RE.sub(tag, tpl)


def inline_css(tpl):
    def include(m):
        css = (ROOT / "css" / f"{m.group(1)}.css").read_text(encoding="utf-8")
        return css.replace("__ROOT__", m.group(2)) if m.group(2) else css

    return CSS_RE.sub(include, tpl)


def build():
    copy = json.loads((ROOT / "copy.json").read_text(encoding="utf-8"))
    out = {}
    for lang, ctx in copy.items():
        target = ROOT / "dist" / lang
        target.mkdir(parents=True, exist_ok=True)
        blocks = []
        for tpl_path in sorted((ROOT / "sections").glob("*.html")):
            result = render(inline_css(tpl_path.read_text(encoding="utf-8")), [ctx])
            leftover = re.search(r"\{\{[^}]*\}\}", result)
            if leftover:
                raise SystemExit(f"{tpl_path.name}/{lang}: islenmemis etiket {leftover.group(0)}")
            (target / tpl_path.name).write_text(result.strip() + "\n", encoding="utf-8")
            blocks.append(result)
        out[lang] = blocks
        print(f"{lang}: {len(blocks)} blok -> {target.relative_to(ROOT)}")
    return out


def preview(blocks_by_lang, shells):
    for spec in shells:
        lang, _, shell_path = spec.partition("=")
        blocks = blocks_by_lang[lang]
        shell = Path(shell_path).read_text(encoding="utf-8")
        # hello-elementor: <main><div class="page-content">[sayfa]</div></main>, footer main'den sonra.
        start = shell.find('<div class="page-content">')
        end = shell.find("</main>", start)
        if start < 0 or end < 0:
            raise SystemExit(f"{shell_path}: page-content / </main> bulunamadi")
        body = '<div class="page-content"><div class="elementor amc-preview">' + "\n".join(blocks) + "</div></div>\n"
        page = shell[:start] + body + shell[end:]
        path = ROOT / "dist" / f"preview-{lang}.html"
        path.write_text(page, encoding="utf-8")
        print(f"onizleme: {path.relative_to(ROOT)}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--shell", action="append", default=[], metavar="DIL=SAYFA.html")
    args = parser.parse_args()
    blocks = build()
    if args.shell:
        preview(blocks, args.shell)
