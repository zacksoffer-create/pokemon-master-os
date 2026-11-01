"""Build the games into single self-contained pages.

Each app.html pulls shared engine code in with <!--@include path--> lines.
The output in dist/ is one file per game, ready to publish as an artifact
or open straight from disk (test/ wraps it in a document skeleton)."""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
APPS = {
    "hoops/app.html": "basketball-playground.html",
    "school/app.html": "living-school.html",
    "golf/app.html": "fairway.html",
    "pong/app.html": "pong-night.html",
    "bat/app.html": "at-bat.html",
}


def build(src, out):
    text = (SRC / src).read_text()
    def include(m):
        return (SRC / m.group(1).strip()).read_text().rstrip() + "\n"
    text = re.sub(r"<!--@include (.+?)-->\n?", include, text)
    (ROOT / "dist" / out).write_text(text)
    return len(text)


if __name__ == "__main__":
    (ROOT / "dist").mkdir(exist_ok=True)
    for src, out in APPS.items():
        if (SRC / src).exists():
            print(f"{out}: {build(src, out) / 1024:.0f} KB")
