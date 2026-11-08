"""Reproducible offline build, with only Python's standard library.

The three vendored ES modules are wrapped, then the small application modules
are concatenated in dependency order. This is intentionally limited to this
project's module graph, not a general JavaScript bundler.
"""
from pathlib import Path
import re
import shutil
import hashlib

ROOT = Path(__file__).resolve().parents[1]
SRC, DIST = ROOT / 'src', ROOT / 'dist'
DIST.mkdir(exist_ok=True)

def without_imports(source):
    return re.sub(r'^import\s+[\s\S]*?\s+from\s+[\'"][^\'"]+[\'"];?\s*', '', source, flags=re.M)

def wrap_vendor(filename, namespace, imports=None):
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

bundle = wrap_vendor('three.module.js', 'THREE')
bundle += wrap_vendor('OrbitControls.js', 'ControlsModule', 'EventDispatcher,MOUSE,Quaternion,Spherical,TOUCH,Vector2,Vector3,Plane,Ray,MathUtils')
bundle += 'const {OrbitControls}=ControlsModule;\n'
bundle += wrap_vendor('RoundedBoxGeometry.js', 'GeometryModule', 'BoxGeometry,Vector3')
bundle += 'const {RoundedBoxGeometry}=GeometryModule;\n'
bundle += wrap_vendor('GLTFLoader.js', 'GLTFLoaderModule', 'AnimationClip,Bone,Box3,BufferAttribute,BufferGeometry,ClampToEdgeWrapping,Color,ColorManagement,DirectionalLight,DoubleSide,FileLoader,FrontSide,Group,ImageBitmapLoader,InstancedMesh,InterleavedBuffer,InterleavedBufferAttribute,Interpolant,InterpolateDiscrete,InterpolateLinear,Line,LineBasicMaterial,LineLoop,LineSegments,LinearFilter,LinearMipmapLinearFilter,LinearMipmapNearestFilter,LinearSRGBColorSpace,Loader,LoaderUtils,Material,MathUtils,Matrix4,Mesh,MeshBasicMaterial,MeshPhysicalMaterial,MeshStandardMaterial,MirroredRepeatWrapping,NearestFilter,NearestMipmapLinearFilter,NearestMipmapNearestFilter,NumberKeyframeTrack,Object3D,OrthographicCamera,PerspectiveCamera,PointLight,Points,PointsMaterial,PropertyBinding,Quaternion,QuaternionKeyframeTrack,RepeatWrapping,Skeleton,SkinnedMesh,Sphere,SpotLight,Texture,TextureLoader,TriangleFanDrawMode,TrianglesDrawMode,TriangleStripDrawMode,Vector2,Vector3,VectorKeyframeTrack,SRGBColorSpace,InstancedBufferAttribute')
bundle += 'const {GLTFLoader}=GLTFLoaderModule;\n'
for name in ('ui.js', 'china-map-data.js', 'cities.js', 'china-map.js', 'wall-layout.js', 'wall-decor.js', 'storage.js', 'album-storage.js', 'cinema-storage.js', 'ktv-storage.js', 'travel-storage.js', 'album-pages.js', 'album-fold.js', 'photo-wall-art.js', 'pegboard-album.js', 'album-isolation.js', 'room-frame.js', 'feature-frame.js', 'pop-up.js', 'room-details.js', 'screen-art.js', 'cinema-frame.js', 'projection-art.js', 'bird-character.js', 'room-life.js', 'guitar-model.js', 'bird-tour-flight.js', 'scene.js', 'travel-labels.js', 'qingdao-model.js', 'qingdao-island.js', 'travel-scene.js', 'travel-app.js', 'album-scene.js', 'album-app.js', 'cinema-sort.js', 'cinema-scene.js', 'cinema-app.js', 'ktv-video.js', 'ktv-scene.js', 'ktv-chords.js', 'ktv-app.js', 'opening.js', 'page-transition.js', 'bird-tour.js', 'app.js'):
    source = without_imports((SRC / name).read_text())
    source = re.sub(r'^export\s+', '', source, flags=re.M)
    bundle += source + '\n'
bundle = '(()=>{\n"use strict";\n' + bundle + '\n})();\n'
(DIST / 'bundle.js').write_text(bundle)
html = (SRC / 'index.html').read_text()
html = re.sub(r'\s*<script type="importmap">.*?</script>', '', html)
script_tag='<script src="./bundle.js?v='+hashlib.sha256(bundle.encode()).hexdigest()[:12]+'"></script>'
css=(SRC / 'style.css').read_text()
style_tag='<link rel="stylesheet" href="./style.css?v='+hashlib.sha256(css.encode()).hexdigest()[:12]+'">'
html = html.replace('<script type="module" src="./app.js"></script>', script_tag)
html = html.replace('<link rel="stylesheet" href="./style.css">',style_tag)
(DIST / 'index.html').write_text(html)
shutil.copyfile(SRC / 'style.css', DIST / 'style.css')
single = html.replace(style_tag, '<style>' + css + '</style>')
single = single.replace(script_tag, '<script>' + bundle.replace('</script', '<\\/script') + '</script>')
(ROOT / 'little-us.html').write_text(single)
print('Built dist/index.html and standalone little-us.html (fully offline).')

# Keep the island-only export in sync with the main build.
import subprocess, sys
subprocess.run([sys.executable, str(ROOT / 'tools' / 'build_qingdao.py')], check=True)
