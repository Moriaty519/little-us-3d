"""Approved story semantics; proposed folded-sheet interaction. Design only."""
from pathlib import Path
import importlib.util, math
from PIL import Image, ImageDraw, ImageFilter
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('album_design',ROOT/'render_album_design.py')
d=importlib.util.module_from_spec(spec);spec.loader.exec_module(d)
S=d.S

def project(image,quad,canvas_size):
    # Affine column slices preserve the central crease without adding dependencies.
    result=Image.new('RGBA',canvas_size)
    a,b,c,e=quad
    for i in range(image.width):
        u=i/max(1,image.width-1)
        top=(a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u)
        bottom=(e[0]+(c[0]-e[0])*u,e[1]+(c[1]-e[1])*u)
        h=max(1,round((bottom[1]-top[1])*S))
        col=image.crop((i,0,i+1,image.height)).resize((max(2,round(abs(b[0]-a[0])*S/image.width)+2),h),Image.Resampling.BICUBIC)
        result.alpha_composite(col,(round(top[0]*S),round(top[1]*S)))
    return result

def spread(kind='daily'):
    if kind!='daily':return d.page_travel() if kind=='travel' else d.page_anniversary()
    im=d.paper(grid=True)
    d.chip(im,(36,29,138,57),'日常拼贴')
    d.tx(im,(383,85),'把普通的一天，',31,d.INK,'serif',anchor='rm')
    d.tx(im,(383,129),'过成喜欢的样子。',31,d.INK,'serif',anchor='rm')
    d.polaroid(im,(28,197,348,288),'home','在家，也有很好的风景。',2)
    d.tape(im,145,177,105,angle=-3)
    d.multiline(im,(40,534),['听了一下午的歌，没有做什么大事。','和你在一起，总想好好留下来。'],15,'#78806b',29,'serif')
    d.tx(im,(810,45),'2025.03.16',14,d.MUTED,'latin',anchor='rm')
    d.polaroid(im,(479,106,278,216),'flowers','今天的小小惊喜',-3)
    d.tape(im,566,89,93,'#c1cbb0',4)
    d.polaroid(im,(559,347,226,210),'street','一起慢慢走',3)
    d.tx(im,(482,348),'just us.',24,d.ROSE,'script');d.heart(im,505,422,25)
    d.bird(im,489,528,.65);d.guitar(im,818,522,.65)
    return im

PAGES=[spread('daily'),spread('travel'),spread('anniversary')]

def sheet(im,cx,cy,w=740,h=455,kind=0,tilt=0,alpha=255):
    page=PAGES[kind%3].copy()
    if alpha<255:page.putalpha(page.getchannel('A').point(lambda v:round(v*alpha/255)))
    # Two halves of one story; the shared center is lower to form a valley fold.
    ox=w*.5; mid=cy+8
    lquad=[(cx-ox,cy-tilt),(cx,mid),(cx,mid+h),(cx-ox,cy+h-tilt)]
    rquad=[(cx,mid),(cx+ox,cy-tilt),(cx+ox,cy+h-tilt),(cx,mid+h)]
    im.alpha_composite(project(page.crop((0,0,page.width//2,page.height)),lquad,im.size))
    im.alpha_composite(project(page.crop((page.width//2,0,page.width,page.height)),rquad,im.size))
    crease=Image.new('RGBA',im.size)
    for a in range(14,0,-1):
        d.ln(crease,[(cx-a*.9,mid+1),(cx-a*.9,mid+h-1)],(73,67,48,round((15-a)*1.1)),1)
        d.ln(crease,[(cx+a*.55,mid+1),(cx+a*.55,mid+h-1)],(255,253,239,round((15-a)*2.5)),1)
    im.alpha_composite(crease)

def stack(im,cx,cy,w,h,kind=0):
    d.sh(im,(cx-w*.7,cy+24,cx+w*.7,cy+h),alpha=20,blur=25,dy=26,rad=25)
    for i in range(4,0,-1):
        sc=1-i*.045
        for side in [-1,1]:sheet(im,cx+side*w*.075*i,cy+15*i,w*sc,h*sc,(kind+i)%3,tilt=3*i,alpha=245)
    sheet(im,cx,cy,w,h,kind,tilt=8)

def arrow(im,x,y,length=52):
    d.ln(im,[(x,y),(x+length,y)],'#899d73',2)
    d.ln(im,[(x+length-9,y-6),(x+length,y),(x+length-9,y+6)],'#899d73',2)

im=Image.new('RGBA',(1600*S,1290*S),d.BG)
d.btn(im,(36,28,184,82),'回到小屋',sym='back')
d.tx(im,(209,30),'little us.',31,d.INK,'latin');d.tx(im,(210,66),'小小的我们 · 相册',12,d.MUTED)
d.tx(im,(824,53),'我们的时光手帐',17,d.MUTED,anchor='mm')
d.btn(im,(1141,31,1282,80),'导出备份');d.btn(im,(1296,31,1394,80),'模板');d.btn(im,(1410,31,1565,80),'写一页',True,'plus')
d.ln(im,[(36,100),(1565,100)],'#dfd9c7')
d.tx(im,(325,135),'每一张折页，都是一个完整的故事。',34,d.INK,'serif')
d.tx(im,(326,190),'更新交互设计 · 沿用奶油绿色、浅木色与六种内页模板',15,d.MUTED)
d.tx(im,(38,146),'时光目录',24,d.INK)
d.tx(im,(38,187),'按年月，找到某一天。',13,d.MUTED)
d.rect(im,(37,229,237,278),'#fbf6e9',rad=14);d.tx(im,(57,245),'2025 年 ⌄',18,d.INK)
for i,(m,label) in enumerate([('封面','从这里开始'),('03 月','日常拼贴'),('05 月','旅行图文'),('08 月','纪念日')]):
    yy=302+i*83
    d.rect(im,(37,yy,237,yy+68),'#dfe7d1' if i==1 else None,rad=15)
    d.tx(im,(64,yy+11),m,20,d.INK);d.tx(im,(64,yy+41),label,11,d.MUTED)
d.multiline(im,(42,670),['一个故事 = 一张折页','左右两半使用同一份内容','照片或文字多时自动续页'],12,d.MUTED,27)
stack(im,965,279,710,423)
d.chip(im,(1274,240,1528,269),'左侧已翻过 · 右侧待阅读')
d.btn(im,(695,776,806,824),'上一页',sym='prev');d.tx(im,(943,802),'03 / 06  ·  日常拼贴',15,d.INK,anchor='mm');d.btn(im,(1080,776,1191,824),'下一页',sym='next')
d.tx(im,(956,855),'拖动页边翻动 · 点击照片放大 · 照片与文字避开中间折痕',14,d.MUTED,anchor='mm')
d.ln(im,[(38,893),(1562,893)],'#d8d5c1')
d.tx(im,(42,916),'翻页过程',24,d.INK,'serif')
d.tx(im,(42,956),'建议采用随手指拖动的折页动画；松手后完成翻页或回弹。',14,d.MUTED)
for x in [42,560,1078]:d.rect(im,(x,997,x+480,1251),'#f5efe0',rad=21)
stack(im,282,1040,256,138)
d.tx(im,(282,1211),'① 拖住右侧页边',17,d.INK,anchor='mm')
arrow(im,522,1111,29)
# Intermediate state: next story visible, outgoing folded sheet swings to the left.
stack(im,800,1040,256,138,kind=1)
back=d.paper(w=220,h=260,color='#ebe5d2')
quad=[(728,1018),(798,1048),(798,1201),(740,1179)]
im.alpha_composite(project(back,quad,im.size))
d.ln(im,[(767,1037),(777,1187)],'#d2c9b4',2)
d.tx(im,(800,1211),'② 折页立起、弯曲并移向左侧',17,d.INK,anchor='mm')
arrow(im,1041,1111,29)
stack(im,1318,1040,256,138,kind=1)
d.tx(im,(1318,1211),'③ 下一张故事折页居中',17,d.INK,anchor='mm')
d.tx(im,(1556,1270),'静态交互方案示意 · 占位插图 · 尚未修改网页交互',11,d.MUTED,anchor='rm')
im.convert('RGB').resize((1600,1290),Image.Resampling.LANCZOS).save(ROOT/'09-album-folded-interaction.png')
print(ROOT/'09-album-folded-interaction.png')
