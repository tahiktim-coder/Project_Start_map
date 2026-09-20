"""Build the itch.io upload: dist/silent-exodus-itch.zip, with index.html at the zip root.

    python tools/package_itch.py

What it does
  - copies only what the game loads at runtime (no docs, design-system, prototypes, legacy or dead files)
  - marks the page as a release build (<html data-release>), which hides the TEST cheat button (theme.css)
  - keeps only the crew portraits the game uses, shrunk to PORTRAIT_PX if Pillow is installed
    (the source art is 1024px and ~1.2 MB each; it is never shown larger than ~64px)

On itch.io: Kind of project = HTML, upload the zip, tick "This file will be played in the browser",
viewport 1280 x 720, enable the fullscreen button.
"""
import io
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
ZIP_PATH = os.path.join(DIST, 'silent-exodus-itch.zip')
PORTRAIT_PX = 256
USED_PORTRAITS = {'F_1.png', 'M_2.png', 'F_3.png', 'M_4.png', 'F_5.png'}  # fixed crew, see CrewGenerator in bundle.js
TOP_LEVEL_FILES = ['style.css', 'dither.css', 'ship.css', 'warp.css', 'log.css', 'theme.css']
DEAD_SOURCES = {'main.js', 'state.js', 'planet.js', 'CrewGenerator.js', 'TutorialSystem.js'}


def runtime_sources():
    """Every src/ file index.html actually loads, so nothing dead ships."""
    html = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    return [m.split('?')[0] for m in re.findall(r'<script src="(src/[^"]+)"', html)]


def release_index():
    html = io.open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    if '<html lang="en">' not in html:
        sys.exit('index.html: expected <html lang="en"> to mark the release build')
    return html.replace('<html lang="en">', '<html lang="en" data-release>', 1)


def portrait_bytes(path):
    try:
        from PIL import Image
    except ImportError:
        return io.open(path, 'rb').read(), False
    image = Image.open(path).convert('RGB')
    image.thumbnail((PORTRAIT_PX, PORTRAIT_PX), Image.LANCZOS)
    out = io.BytesIO()
    image.save(out, format='PNG', optimize=True)
    return out.getvalue(), True


def main():
    os.makedirs(DIST, exist_ok=True)
    sources = runtime_sources()
    missing = [s for s in sources if not os.path.isfile(os.path.join(ROOT, s))]
    if missing:
        sys.exit('index.html references missing files: ' + ', '.join(missing))
    shipped_dead = [s for s in sources if os.path.basename(s) in DEAD_SOURCES]
    if shipped_dead:
        print('note: index.html loads files listed as dead:', shipped_dead)

    was_resized = False
    with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as bundle:
        bundle.writestr('index.html', release_index())
        for name in TOP_LEVEL_FILES + sources:
            bundle.write(os.path.join(ROOT, name), name)
        for name in sorted(USED_PORTRAITS):
            data, resized = portrait_bytes(os.path.join(ROOT, 'assets', 'crew', name))
            was_resized = was_resized or resized
            bundle.writestr('assets/crew/' + name, data)
        for name in sorted(os.listdir(os.path.join(ROOT, 'Music'))):
            if name.lower().endswith(('.mp3', '.ogg')):
                bundle.write(os.path.join(ROOT, 'Music', name), 'Music/' + name)

    size_mb = os.path.getsize(ZIP_PATH) / (1024 * 1024)
    print('wrote %s (%.1f MB, %d scripts, portraits %s)' % (
        os.path.relpath(ZIP_PATH, ROOT), size_mb, len(sources),
        'resized to %dpx' % PORTRAIT_PX if was_resized else 'full size - install Pillow to shrink them'))


if __name__ == '__main__':
    main()
