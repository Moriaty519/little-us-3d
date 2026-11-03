"""Compose the three captured design states; this is not a runtime effect."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parent
canvas = Image.new('RGB', (1600, 430), '#f2eedf')
draw = ImageDraw.Draw(canvas)
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc', 26)
small = ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc', 21)
states = [('01-cinema-main.png', '当前照片'), ('03-cinema-film.png', '快速过片'), ('04-cinema-next.png', '下一张')]
for index, (filename, label) in enumerate(states):
    x = 32 + index * 532
    draw.text((x, 21), label, font=font, fill='#57664e')
    image = Image.open(root / filename).convert('RGB').resize((472, 266), Image.Resampling.LANCZOS)
    canvas.paste(image, (x, 70))
    if index < 2:
        draw.line([(x+487, 195), (x+517, 195)], fill='#8b9c77', width=3)
        draw.line([(x+509, 187), (x+517, 195), (x+509, 203)], fill='#8b9c77', width=3)
draw.text((32, 368), '每秒切换一次 · 快速上下过片，短暂遮挡和轻微颗粒仅在转场出现', font=small, fill='#859178')
canvas.save(root / '05-cinema-transition.png')
print('Saved 05-cinema-transition.png')
