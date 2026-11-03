"""Regenerate and embed the photo-board illustration. Requires Pillow and NumPy."""
from pathlib import Path
import base64
import importlib.util
import re
from PIL import Image

root=Path(__file__).resolve().parents[1]
design=root/'design/photo-wall'
spec=importlib.util.spec_from_file_location('photo_wall_design',design/'draw_photo_wall.py')
art=importlib.util.module_from_spec(spec)
spec.loader.exec_module(art)
output=design/'photo-wall-front.png'
art.board().resize((1600,1100),Image.Resampling.LANCZOS).save(output,optimize=True)
module=root/'src/photo-wall-art.js'
encoded=base64.b64encode(output.read_bytes()).decode('ascii')
source,count=re.subn(r"export const PHOTO_WALL_ART = '[^']*';",
    "export const PHOTO_WALL_ART = 'data:image/png;base64,"+encoded+"';",module.read_text())
if count!=1:
    raise ValueError('Expected exactly one embedded photo-wall image')
module.write_text(source)
print('Regenerated and embedded',output)
