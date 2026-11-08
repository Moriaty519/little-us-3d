"""Build the standalone Qingdao island HTML (Three.js + GLTFLoader + GLB).

This is intentionally separate from the main app build: the result contains
only the island scene, not the room, map, travel UI or local storage.
"""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
SRC, DIST = ROOT / 'src', ROOT / 'dist'


def without_imports(source):
    return re.sub(r'^import\s+[\s\S]*?\s+from\s+[\'"][^\'"]+[\'"];?\s*', '', source, flags=re.M)


def three_imports(filename):
    source = (DIST / 'assets' / filename).read_text()
    match = re.search(r"import\s*\{([\s\S]*?)\}\s*from\s*'three';", source)
    if not match:
        raise ValueError(f'No three imports found in {filename}')
    return ', '.join(name.strip() for name in match.group(1).split(',') if name.strip())


def wrap_vendor(filename, namespace, imports=''):
    source = (DIST / 'assets' / filename).read_text()
    source = without_imports(source)
    exports = re.search(r'export\s*\{([\s\S]*?)\};?\s*$', source)
    if not exports:
        raise ValueError(f'Missing exports in {filename}')
    names = exports.group(1).strip()
    names = re.sub(r'(\w+)\s+as\s+(\w+)', r'\2: \1', names)
    source = source[:exports.start()]
    preamble = f'const {{{imports}}}=THREE;\n' if imports else ''
    return f'const {namespace}=(()=>{{\n{preamble}{source}\nreturn {{{names}}};\n}})();\n'


def build():
    bundle = wrap_vendor('three.module.js', 'THREE')
    bundle += wrap_vendor('GLTFLoader.js', 'GLTFLoaderModule', three_imports('GLTFLoader.js'))
    bundle += 'const {GLTFLoader}=GLTFLoaderModule;\n'
    for name in ('qingdao-model.js', 'qingdao-island.js'):
        source = without_imports((SRC / name).read_text())
        source = re.sub(r'^export\s+', '', source, flags=re.M)
        bundle += source + '\n'
    bundle += (ROOT / 'tools' / 'qingdao-shell.js').read_text() + '\n'
    bundle = '(()=>{\n"use strict";\n' + bundle + '\n})();\n'

    template = (ROOT / 'tools' / 'qingdao-standalone.template.html').read_text()
    html = template.replace('__BUNDLE__', bundle.replace('</script', '<\\/script'))
    out = ROOT / 'qingdao-island.html'
    out.write_text(html)
    print(f'Built standalone Qingdao island: {out.name} ({out.stat().st_size / 1024 / 1024:.1f} MB)')


if __name__ == '__main__':
    build()
