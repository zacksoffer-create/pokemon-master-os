"""Turn a built game page into a complete web page that works on its own:
open it from a computer, a phone's files, or a folder in Google Drive, with
no Claude around it. Saves go to the browser's own storage.

  python3 games/standalone.py basketball-playground.html
writes dist/<name>-standalone.html."""
import pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent
HEAD = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#0b0f18">
<style>:root{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
"""
FOOT = "\n</body>\n</html>\n"


def standalone(name):
    page = (ROOT / "dist" / name).read_text()
    out = ROOT / "dist" / name.replace(".html", "-standalone.html")
    out.write_text(HEAD + page + FOOT)
    return out


if __name__ == "__main__":
    for n in sys.argv[1:] or ["basketball-playground.html"]:
        o = standalone(n)
        print(f"{o.name}: {o.stat().st_size / 1024:.0f} KB")
