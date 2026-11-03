"""Deterministic album design boards; no runtime or browser data changes."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math, random

OUT=Path(__file__).resolve().parent
W,H,S=1600,1000,2
INK='#4e5947'; MUTED='#8f947f'; GREEN='#839672'; BG='#eee7d5'; PAPER='#fffaf0'; ROSE='#bc8172'; GOLD='#c5a77a'
PING='/System/Library/AssetsV2/com_apple_MobileAsset_Font8/86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc'
LATIN='/System/Library/Fonts/HelveticaNeue.ttc'
SERIF='/System/Library/Fonts/Supplemental/Songti.ttc'
SCRIPT='/System/Library/Fonts/Noteworthy.ttc'
FONTS={}

def ft(size,kind='ui'):
    key=(size,kind)
    if key not in FONTS:FONTS[key]=ImageFont.truetype({'ui':PING,'serif':SERIF,'latin':LATIN,'script':SCRIPT}[kind],round(size*S))
    return FONTS[key]

def tx(im,xy,t,size=18,col=INK,kind='ui',anchor=None):
    ImageDraw.Draw(im).text((xy[0]*S,xy[1]*S),t,font=ft(size,kind),fill=col,anchor=anchor)

def rect(im,r,fill,border=None,rad=0,width=1):
    d=ImageDraw.Draw(im); box=tuple(round(v*S) for v in r)
    if rad:d.rounded_rectangle(box,round(rad*S),fill=fill,outline=border,width=max(1,round(width*S)))
    else:d.rectangle(box,fill=fill,outline=border,width=max(1,round(width*S)))

def ln(im,pts,col=INK,width=1):
    ImageDraw.Draw(im).line([(round(x*S),round(y*S)) for x,y in pts],fill=col,width=max(1,round(width*S)),joint='curve')

def poly(im,pts,col,outline=None,width=1):
    d=ImageDraw.Draw(im);points=[(round(x*S),round(y*S)) for x,y in pts];d.polygon(points,fill=col)
    if outline:d.line(points+[points[0]],fill=outline,width=max(1,round(width*S)),joint='curve')

def ell(im,r,col=None,outline=None,width=1):
    ImageDraw.Draw(im).ellipse(tuple(v*S for v in r),fill=col,outline=outline,width=max(1,round(width*S)))

def sh(im,r,alpha=28,blur=18,dy=14,rad=20):
    layer=Image.new('RGBA',im.size);rect(layer,(r[0]+8,r[1]+dy,r[2]+8,r[3]+dy),(65,55,33,alpha),rad=rad)
    im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur*S)))

def icon(im,kind,x,y,col=INK,sz=20):
    k=sz/20
    def pts(p):return [(x+a*k,y+b*k) for a,b in p]
    if kind in ('prev','back'):ln(im,pts([(12,4),(6,10),(12,16)]),col,1.7);ln(im,pts([(6,10),(18,10)]),col,1.7) if kind=='back' else None
    elif kind=='next':ln(im,pts([(7,4),(13,10),(7,16)]),col,1.7)
    elif kind=='plus':ln(im,pts([(4,10),(16,10)]),col,1.7);ln(im,pts([(10,4),(10,16)]),col,1.7)
    elif kind=='close':ln(im,pts([(5,5),(15,15)]),col,1.7);ln(im,pts([(15,5),(5,15)]),col,1.7)
    elif kind=='grid':
        for a,b in [(2,2),(11,2),(2,11),(11,11)]:rect(im,(x+a*k,y+b*k,x+(a+6)*k,y+(b+6)*k),None,col,rad=1.5*k)
    elif kind=='edit':poly(im,pts([(3,13),(13,3),(17,7),(7,17),(2,18)]),None,col,1.5)
    elif kind=='image':
        rect(im,(x+2*k,y+3*k,x+18*k,y+17*k),None,col,2*k);ell(im,(x+5*k,y+6*k,x+8*k,y+9*k),col);ln(im,pts([(3,16),(8,10),(12,13),(15,10),(18,13)]),col,1.3)
    elif kind=='book':ln(im,pts([(2,4),(8,3),(10,5),(12,3),(18,4),(18,17),(12,16),(10,18),(8,16),(2,17),(2,4)]),col,1.5);ln(im,pts([(10,5),(10,18)]),col,1.2)

def btn(im,r,label,primary=False,sym=None):
    rect(im,r,GREEN if primary else '#faf5e8', '#7d916a' if primary else '#fffaf0',23)
    x,y,x2,y2=r;col='#fffcf2' if primary else INK
    if sym:icon(im,sym,x+17,(y+y2)/2-10,col);tx(im,(x+46,(y+y2)/2),label,16,col,anchor='lm')
    else:tx(im,((x+x2)/2,(y+y2)/2),label,16,col,anchor='mm')

def chip(im,r,label,active=False):
    rect(im,r,GREEN if active else '#f3edde',rad=11);tx(im,((r[0]+r[2])/2,(r[1]+r[3])/2),label,12,'#fffaf0' if active else MUTED,anchor='mm')

def multiline(im,xy,lines,size=18,col=INK,gap=34,kind='ui'):
    for i,t in enumerate(lines):tx(im,(xy[0],xy[1]+i*gap),t,size,col,kind)

def paper(w=860,h=622,color=PAPER,grid=False):
    im=Image.new('RGBA',(round(w*S),round(h*S)))
    rect(im,(0,0,w-1,h-1),color,'#e2dac7',23)
    d=ImageDraw.Draw(im);rng=random.Random(13)
    for _ in range(int(w*h/55)):
        x=rng.randrange(4,im.width-4);y=rng.randrange(4,im.height-4)
        if im.getpixel((x,y))[3]:d.point((x,y),fill=(168,150,118,rng.randrange(4,15)))
    # Grain is alpha-composited onto paper rather than punched through it.
    base=Image.new('RGBA',im.size);rect(base,(0,0,w-1,h-1),color,'#e2dac7',23)
    base.alpha_composite(im)
    if grid:
        for x in range(25,int(w-25),22):
            for y in range(25,int(h-25),22):ell(base,(x,y,x+.7,y+.7),'#ddd9ca')
    return base

PHOTOS={}
def photo(w,h,kind='hills'):
    key=(w,h,kind)
    if key in PHOTOS:return PHOTOS[key].copy()
    im=Image.new('RGBA',(round(w*S),round(h*S)))
    palettes={'hills':('#b9c9c3','#90a48a'),'lake':('#bacdd0','#799ba0'),'snow':('#bdcbd1','#8a9993'),'home':('#e8dbc2','#b7bba0'),'street':('#d6d8c7','#a7b192'),'flowers':('#e8ded0','#bac8a8')}
    sky,field=palettes.get(kind,palettes['hills']);rect(im,(0,0,w,h),sky)
    ell(im,(w*.72,h*.12,w*.84,h*.12+w*.12),'#f6e9b9')
    if kind in ('hills','lake','snow'):
        poly(im,[(0,h*.67),(w*.22,h*.28),(w*.49,h*.55),(w*.76,h*.29),(w,h*.59),(w,h),(0,h)],field)
        if kind=='snow':
            poly(im,[(w*.07,h*.55),(w*.22,h*.28),(w*.36,h*.43),(w*.3,h*.47),(w*.21,h*.42),(w*.17,h*.48)],'#edf0e6')
            poly(im,[(w*.62,h*.42),(w*.76,h*.29),(w*.92,h*.49),(w*.84,h*.47),(w*.79,h*.4)],'#e6ece4')
        poly(im,[(0,h*.83),(w*.33,h*.59),(w*.7,h*.69),(w,h*.58),(w,h),(0,h)],'#718c78')
        if kind=='lake':
            poly(im,[(0,h*.77),(w*.33,h*.73),(w*.65,h*.77),(w,h*.69),(w,h),(0,h)],'#abc5c6')
            for i in range(5):ln(im,[(w*.3+i*w*.03,h*.81+i*h*.035),(w*.7+i*w*.02,h*.81+i*h*.035)],'#dce6d9',1.5)
        else:poly(im,[(w*.32,h),(w*.52,h*.66),(w*.56,h*.65),(w*.5,h),(w*.32,h)],'#d4c79e')
    elif kind=='home':
        rect(im,(0,h*.65,w,h),'#c8b993')
        rect(im,(w*.12,h*.14,w*.42,h*.61),'#fff7e5','#b8b998',3)
        rect(im,(w*.15,h*.18,w*.39,h*.56),'#ccd8c3')
        ln(im,[(w*.27,h*.17),(w*.27,h*.57)],'#fef5e4',4);ln(im,[(w*.15,h*.37),(w*.39,h*.37)],'#fef5e4',4)
        rect(im,(w*.1,h*.63,w*.65,h*.9),'#9ba78a',rad=10)
        rect(im,(w*.13,h*.52,w*.61,h*.73),'#e6ead5',rad=8)
        ell(im,(w*.45,h*.68,w*.82,h*.81),'#b59a71');ln(im,[(w*.51,h*.77),(w*.49,h*.99)],'#b59a71',5);ln(im,[(w*.77,h*.77),(w*.79,h*.99)],'#b59a71',5)
        rect(im,(w*.6,h*.68,w*.68,h*.76),'#fff3dc',rad=3)
        rect(im,(w*.76,h*.52,w*.82,h*.69),'#9b916b',rad=3)
        ln(im,[(w*.79,h*.55),(w*.79,h*.3)],'#829275',3)
        for x,y in [(w*.73,h*.3),(w*.85,h*.33),(w*.79,h*.24)]:ell(im,(x-w*.04,y-h*.04,x+w*.04,y+h*.04),'#c59585')
    elif kind=='street':
        rect(im,(0,h*.73,w,h),'#d2c4a6')
        for i,c in enumerate(['#bfac8d','#ddcbae','#98a58b']):
            x=w*(.05+i*.31);rect(im,(x,h*.2,x+w*.26,h*.75),c)
            rect(im,(x+w*.03,h*.31,x+w*.1,h*.55),'#e7edda');rect(im,(x+w*.15,h*.31,x+w*.23,h*.55),'#e7edda')
            rect(im,(x+w*.07,h*.59,x+w*.2,h*.75),'#738576')
        for x in [w*.15,w*.8]:ln(im,[(x,h*.75),(x,h*.39)],'#78846b',3);ell(im,(x-w*.09,h*.19,x+w*.09,h*.48),'#a5b490')
    else:
        rect(im,(0,h*.7,w,h),'#d3c3a8');poly(im,[(w*.42,h*.64),(w*.58,h*.64),(w*.55,h*.91),(w*.45,h*.91)],'#98a992')
        for x,y,c in [(w*.32,h*.29,'#c69a8c'),(w*.58,h*.2,'#e9dba5'),(w*.68,h*.4,'#bca7b2'),(w*.42,h*.48,'#dbaea1')]:
            ln(im,[(w*.5,h*.67),(x,y)],'#789073',2)
            for a in range(5):
                xx=x+math.cos(a*math.pi*2/5)*w*.045;yy=y+math.sin(a*math.pi*2/5)*w*.045;ell(im,(xx-w*.04,yy-w*.04,xx+w*.04,yy+w*.04),c)
            ell(im,(x-w*.022,y-w*.022,x+w*.022,y+w*.022),'#d7bc77')
    PHOTOS[key]=im.copy();return im

def imagebox(im,r,kind='hills',rounded=0,label=False):
    x,y,x2,y2=r;p=photo(x2-x,y2-y,kind)
    if rounded:
        mask=Image.new('L',p.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,p.width-1,p.height-1),rounded*S,fill=255);im.paste(p,(round(x*S),round(y*S)),mask)
    else:im.alpha_composite(p,(round(x*S),round(y*S)))
    if label:chip(im,(x+12,y+12,x+88,y+35),'占位图')

def tape(im,x,y,w=110,color='#d7c48e',angle=-5):
    layer=Image.new('RGBA',(round((w+20)*S),round(48*S)))
    poly(layer,[(10,8),(w+8,10),(w+11,34),(8,33),(11,28),(7,23)],color)
    for a in range(18,int(w+6),13):ln(layer,[(a,12),(a+4,29)],'#efe0b9',.6)
    rot=layer.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True);im.alpha_composite(rot,(round(x*S),round(y*S)))

def polaroid(im,r,kind,caption,angle=0):
    x,y,w,h=r;layer=Image.new('RGBA',(round((w+35)*S),round((h+35)*S)))
    sh(layer,(12,8,w+12,h+8),alpha=25,blur=7,dy=6,rad=2);rect(layer,(12,8,w+12,h+8),'#fffef7','#e4dfd1',2)
    imagebox(layer,(24,20,w,h-42),kind)
    tx(layer,(w/2+12,h-20),caption,15,'#77836b','serif',anchor='mm')
    layer=layer.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True);im.alpha_composite(layer,(round(x*S),round(y*S)))

def heart(im,x,y,size=28,col=ROSE):
    pts=[]
    for i in range(90):
        t=i/89*2*math.pi;pts.append((x+size*16*math.sin(t)**3/32,y-size*(13*math.cos(t)-5*math.cos(2*t)-2*math.cos(3*t)-math.cos(4*t))/32))
    poly(im,pts,col)

def guitar(im,x,y,k=1):
    ell(im,(x-17*k,y+19*k,x+16*k,y+63*k),'#dcc18a','#a48c65',1.1);ell(im,(x-12*k,y+10*k,x+12*k,y+37*k),'#dcc18a')
    rect(im,(x-4*k,y-27*k,x+4*k,y+26*k),'#9a8260',rad=1);rect(im,(x-6*k,y-37*k,x+6*k,y-22*k),'#b4a17a',rad=2)
    ell(im,(x-5*k,y+29*k,x+5*k,y+39*k),'#786b50')
    for a in [-2,0,2]:ln(im,[(x+a*k,y-29*k),(x+a*k,y+51*k)],'#f1dfb6',.65)
    ln(im,[(x-8*k,y+51*k),(x+8*k,y+51*k)],'#877b5c',2)

def bird(im,x,y,k=1):
    ell(im,(x-19*k,y-9*k,x+17*k,y+32*k),'#9aac79');ell(im,(x-12*k,y-23*k,x+13*k,y+1*k),'#b6c08c');ell(im,(x+2*k,y-15*k,x+5*k,y-12*k),'#4c5947')
    poly(im,[(x+12*k,y-12*k),(x+23*k,y-7*k),(x+12*k,y-3*k)],'#c3a173');poly(im,[(x-14*k,y+20*k),(x-28*k,y+42*k),(x-5*k,y+27*k)],'#7a9b6e')
    ln(im,[(x-6*k,y+30*k),(x-5*k,y+37*k)],'#aa9370',1.5);ln(im,[(x+4*k,y+29*k),(x+6*k,y+36*k)],'#aa9370',1.5)

def page_daily():
    im=paper(grid=True)
    chip(im,(42,30,138,58),'日常拼贴');tx(im,(814,43),'2025.03.16',14,MUTED,'latin',anchor='rm')
    tx(im,(45,80),'把普通的一天，过成喜欢的样子。',34,INK,'serif')
    tx(im,(48,131),'A SLOW SUNDAY, WITH YOU',13,MUTED,'latin')
    polaroid(im,(40,180,442,324),'home','在家，也有很好的风景。',3)
    tape(im,212,170,125,angle=-7)
    polaroid(im,(537,166,220,193),'flowers','今天的小小惊喜',-6);tape(im,607,154,87,'#c1cbb0',7)
    polaroid(im,(585,358,190,176),'street','一起慢慢走',5)
    tx(im,(510,361),'just us.',23,ROSE,'script');heart(im,555,431,22)
    multiline(im,(56,557),['听了一下午的歌，也没有做什么大事。','但和你在一起的日子，总想好好留下来。'],16,'#78806b',28,'serif')
    guitar(im,803,518,.69);bird(im,520,531,.75)
    tx(im,(805,593),'02',13,MUTED,'latin',anchor='rm')
    return im

def page_travel():
    im=paper();imagebox(im,(24,24,525,597),'hills')
    rect(im,(24,24,525,145),(51,82,76,115))
    tx(im,(50,56),'山野之间',54,'#fff9e7','serif');tx(im,(56,123),'去很远的地方，也靠你更近一点。',17,'#f3ecd5','serif')
    chip(im,(45,548,136,579),'图片占位')
    tx(im,(560,47),'2025 / 05 / 18',13,MUTED,'latin');tx(im,(560,94),'一起去看山。',36,INK,'serif')
    tx(im,(562,151),'SOMEWHERE WITH YOU',12,ROSE,'latin');ln(im,[(562,183),(808,183)],'#ded6c2')
    multiline(im,(562,212),['沿着风走，路过绿色的山坡。','我们拍下云，也拍下彼此。','','那天没有赶路，','只是把时间慢慢交给风景。'],17,'#6c7661',32,'serif')
    imagebox(im,(563,409,810,531),'lake');tape(im,668,395,75,'#d9c591',-4)
    tx(im,(563,555),'风吹过的时候，记得这一页。',16,MUTED,'serif')
    tx(im,(805,591),'03',13,MUTED,'latin',anchor='rm')
    return im

def page_anniversary():
    im=paper(color='#fff7ee')
    for x,y,s in [(56,88,18),(790,67,14),(778,485,26),(82,537,14)]:heart(im,x,y,s,'#d5a595')
    tx(im,(430,49),'2025.08.18',14,ROSE,'latin',anchor='mm')
    tx(im,(430,89),'和你，又走过了一季。',40,INK,'serif',anchor='mm')
    tx(im,(430,140),'ALL THE LITTLE THINGS WE KEEP',12,MUTED,'latin',anchor='mm')
    polaroid(im,(99,185,291,298),'lake','那天的风，很温柔。',6)
    polaroid(im,(447,193,291,298),'home','喜欢的人，就在身边。',-5)
    tape(im,198,174,91,'#dab895',-7);tape(im,554,179,95,'#bac6a7',8)
    heart(im,427,367,31);ln(im,[(391,403),(418,427),(445,416),(473,451)],'#c7ac94',1)
    tx(im,(430,531),'“ 想把和你在一起的日子，慢慢写成一本书。 ”',23,'#917969','serif',anchor='mm')
    tx(im,(430,578),'这一页，留给我们。',15,MUTED,'serif',anchor='mm');tx(im,(805,592),'04',13,MUTED,'latin',anchor='rm')
    return im

def page_film():
    im=paper(color='#f8f5e7');tx(im,(44,40),'一段散步，六个瞬间。',34,INK,'serif');tx(im,(45,101),'2025.06.01  /  SIX LITTLE MOMENTS',13,MUTED,'latin')
    for i in range(6):
        x=44+(i%3)*257;y=158+(i//3)*192
        rect(im,(x,y,x+237,y+171),'#58614d',rad=2);imagebox(im,(x+10,y+12,x+227,y+138),['street','home','flowers','hills','lake','snow'][i]);tx(im,(x+14,y+151),f'0{i+1}    little us.',10,'#e8e6d7','latin')
    tx(im,(44,563),'路很短，回忆很长。',21,MUTED,'serif');return im

def page_letter():
    im=paper(color='#f9f1df');tx(im,(47,41),'写给今天，也写给以后的我们。',32,INK,'serif');tx(im,(48,97),'2025.07.02   /   A NOTE FOR US',12,MUTED,'latin')
    for y in range(183,547,35):ln(im,[(48,y),(476,y)],'#ded5bd')
    multiline(im,(49,159),['今天想记录的，是一点小小的开心。','','一起听过的歌，','吃过的晚饭，走过的那条街。','','等到以后翻到这一页，','希望还能记起当时的心情。'],19,'#7c7f67',35,'serif')
    polaroid(im,(526,176,256,302),'flowers','就像今天，慢慢盛开。',-5);tape(im,605,164,87,'#bfc8a6',9);bird(im,713,529,.92)
    tx(im,(49,581),'with love,',18,ROSE,'script');return im

def page_large():
    im=paper();imagebox(im,(23,24,836,597),'snow');rect(im,(23,410,836,597),(54,72,64,128))
    tx(im,(55,435),'这一刻，不用很多话。',35,'#fffae9','serif');tx(im,(56,498),'2025.09.12   /   ONE MOMENT, ONE PAGE',12,'#e4e6d6','latin')
    tx(im,(57,550),'把喜欢的风景，和喜欢的人，放在一起。',19,'#f1efe0','serif');return im

def page_cover():
    im=paper(color='#8a9b77')
    rect(im,(22,20,836,598),None,'#b2bb9a',15)
    texture=Image.new('RGBA',im.size)
    for x in range(30,830,7):ln(texture,[(x,27),(x,592)],(239,235,213,8),.5)
    im.alpha_composite(texture)
    tx(im,(430,80),'LITTLE US. / OUR PHOTO JOURNAL',14,'#e5e7d1','latin',anchor='mm')
    tx(im,(430,142),'把日子，慢慢写成一本书。',43,'#fff8e7','serif',anchor='mm')
    polaroid(im,(236,208,344,267),'hills','把每一次同行，留在这里。',-3);tape(im,362,192,101,'#dbc895',-4)
    guitar(im,168,390,.85);bird(im,685,414,1.05);heart(im,695,245,28,'#d6b798')
    tx(im,(430,547),'2025 — 2026',23,'#ece8d0','serif',anchor='mm');tx(im,(430,579),'从第一页，翻回我们的故事。',14,'#e2e4cb','serif',anchor='mm');return im

PAGES={}
def pget(kind):
    if kind not in PAGES:PAGES[kind]={'cover':page_cover,'daily':page_daily,'travel':page_travel,'anniversary':page_anniversary,'film':page_film,'letter':page_letter,'large':page_large}[kind]()
    return PAGES[kind].copy()

def curved(p,amount=10):
    # A gently bent sheet: top and bottom dip across the horizontal page.
    pw,ph=p.size;margin=32*S;out=Image.new('RGBA',(pw,ph+2*margin));base=Image.new('RGBA',out.size);base.alpha_composite(p,(0,margin))
    n=64;mesh=[]
    for i in range(n):
        x1=round(i*pw/n);x2=round((i+1)*pw/n);a=amount*S*math.sin(math.pi*x1/pw);b=amount*S*math.sin(math.pi*x2/pw)
        mesh.append(((x1,0,x2,out.height),(x1,-a,x1,out.height-a,x2,out.height-b,x2,-b)))
    return base.transform(out.size,Image.Transform.MESH,mesh,Image.Resampling.BICUBIC)

def paste_shadow(im,p,x,y,alpha=40,blur=18,dy=18):
    layer=Image.new('RGBA',im.size);m=p.getchannel('A').point(lambda a:round(a*alpha/255));dark=Image.new('RGBA',p.size,(74,62,41,255));dark.putalpha(m);layer.alpha_composite(dark,(round((x+8)*S),round((y+dy)*S)));im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur*S)));im.alpha_composite(p,(round(x*S),round(y*S)))

def shell(title='每一页，都有我们。',subtitle='按日期排列，翻回一起走过的日子。',active='03 月',editor=False):
    im=Image.new('RGBA',(W*S,H*S),BG);d=ImageDraw.Draw(im)
    a=(242,236,220);b=(234,227,207)
    for y in range(H*S):
        t=y/(H*S);d.line((0,y,W*S,y),fill=tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3)))
    btn(im,(36,27,173,76),'回到小屋',sym='back');tx(im,(202,28),'little us.',30,INK,'latin');tx(im,(204,65),'小小的我们 · 相册',12,MUTED)
    tx(im,(800,52),'我们的时光手帐',18,INK,anchor='mm');btn(im,(1241,27,1389,76),'导入 / 备份');btn(im,(1407,27,1564,76),'写一页',True,'plus')
    ln(im,[(36,99),(1564,99)],'#ded8c4')
    tx(im,(315,126),title,29,INK,'serif');tx(im,(317,170),subtitle,15,MUTED)
    if not editor:
        tx(im,(44,144),'时光目录',20,INK);tx(im,(44,179),'按年月，找到某一天。',13,MUTED)
        rect(im,(40,213,256,258),'#faf6e8',rad=15);tx(im,(60,235),'2025 年',18,INK,anchor='lm');tx(im,(234,235),'⌄',18,MUTED,anchor='mm')
        ln(im,[(65,293),(65,663)],'#d8d3be',1.5)
        months=[('封面','从这里开始'),('03 月','周末与小日常'),('05 月','去看山与海'),('08 月','又一个纪念日'),('09 月','一张喜欢的风景')]
        for i,(month,small) in enumerate(months):
            y=277+i*79;isactive=month==active
            if isactive:rect(im,(42,y,257,y+68),'#e0e7d2',rad=14)
            ell(im,(60,y+27,70,y+37),GREEN if isactive else '#c5ccb0');tx(im,(89,y+12),month,18,GREEN if isactive else INK);tx(im,(90,y+43),small,11,MUTED)
        chip(im,(45,734,168,765),'模板示例 · 可移除');tx(im,(45,790),'照片和文字仅保存在本机。',11,MUTED);tx(im,(45,815),'更换设备前，请导出备份。',11,MUTED)
    tx(im,(39,959),'相册设计稿 · 所有图片均为占位示意，示例不是用户记录',12,MUTED);tx(im,(1560,959),'little us. / A JOURNAL OF US',12,MUTED,'latin',anchor='rm')
    return im

def stack(im,kind='daily',x=333,y=212,scale=1):
    # Later stories peek out behind the selected paper like the references.
    kinds=['large','anniversary','travel']
    for i,k in reversed(list(enumerate(kinds))):
        p=pget(k).resize((round(860*S*scale),round(622*S*scale)),Image.Resampling.LANCZOS)
        p=curved(p,6*scale).rotate(-1.0-i*.32,Image.Resampling.BICUBIC,expand=True)
        paste_shadow(im,p,x+68+(i+1)*47*scale,y+(i+1)*9*scale,22,12,8)
    p=curved(pget(kind).resize((round(860*S*scale),round(622*S*scale)),Image.Resampling.LANCZOS),10*scale)
    # Thin page edge with warm paper layers, kept distinct from a flat card.
    edge=Image.new('RGBA',p.size,'#e9dfc8');edge.putalpha(p.getchannel('A'))
    paste_shadow(im,edge,x,y+5,38,19,18)
    im.alpha_composite(p,(round(x*S),round(y*S)))
    rect(im,(1338,249,1410,325),'#c3cdb0',rad=12);tx(im,(1374,286),'日常',14,INK,anchor='mm')
    rect(im,(1378,355,1450,431),'#d6c49c',rad=12);tx(im,(1414,393),'旅行',14,INK,anchor='mm')
    rect(im,(1415,469,1494,545),'#dbb6a6',rad=12);tx(im,(1454,507),'纪念日',13,INK,anchor='mm')

def footer(im,count='02 / 12',date='2025.03.16',kind='日常拼贴'):
    rect(im,(628,895,1071,945),'#faf6e8','#fffaf0',22);icon(im,'prev',649,910,MUTED);tx(im,(706,920),'上一页',14,MUTED,anchor='mm');tx(im,(849,919),count,16,INK,'ui' if any(ord(c)>127 for c in count) else 'latin',anchor='mm');tx(im,(990,920),'下一页',14,MUTED,anchor='mm');icon(im,'next',1023,910,MUTED)
    btn(im,(1397,890,1556,938),'页面总览',sym='grid');tx(im,(347,875),f'{date}  ·  {kind}',13,MUTED);btn(im,(1134,135,1252,174),'编辑',sym='edit')
    tx(im,(1104,916),'点击页边或左右键翻页',12,MUTED,anchor='lm')

def save(im,name):
    im.convert('RGB').resize((W,H),Image.Resampling.LANCZOS).save(OUT/name);print(OUT/name)


def mainboards():
    im=shell('把日子，慢慢写成一本书。','这是我们的相册：日常、旅行，和每一个想留下来的瞬间。','封面');stack(im,'cover');footer(im,'封面 / 12','2025—2026','相册封面');save(im,'01-album-cover.png')
    im=shell();stack(im,'daily');footer(im);save(im,'02-album-daily.png')
    im=shell('一起去过的风景，翻回来时还在。','同一本手帐，也可以有大图与留白的旅行故事。','05 月');stack(im,'travel');footer(im,'03 / 12','2025.05.18','旅行图文');save(im,'03-album-travel.png')
    im=shell('这一页，留给特别的我们。','纪念日用温柔的贴纸与手写短句，日常与旅行继续按时间排列。','08 月');stack(im,'anniversary');footer(im,'04 / 12','2025.08.18','纪念日');save(im,'04-album-anniversary.png')


def page_turn():
    im=shell('翻过这一页，继续我们的故事。','翻页时纸面弯曲，背面与下一页同时出现。');stack(im,'travel')
    # The departing sheet folds toward the left, revealing the following page.
    p=pget('daily');half=p.crop((0,0,round(390*S),p.height)).resize((round(306*S),round(622*S)),Image.Resampling.LANCZOS)
    half=curved(half,10);paste_shadow(im,half,333,211,40,13,10)
    fold=Image.new('RGBA',im.size)
    points=[(639,244),(809,222),(881,346),(796,834),(639,864)]
    poly(fold,points,'#eee6d3','#d7cdb6',1.2)
    # Soft curved bands communicate light moving over the folded page back.
    for i in range(80):
        t=i/79;xx=639+178*t;col=tuple(round(v) for v in (233+17*math.sin(t*math.pi),222+22*math.sin(t*math.pi),201+30*math.sin(t*math.pi)))
        ln(fold,[(xx,244-22*t),(xx+58*math.sin(t*math.pi),346+20*t),(xx-15*t,843-10*t)],col,3)
    mask=Image.new('L',im.size);poly(mask,points,255);fold.putalpha(mask);im.alpha_composite(fold)
    ln(im,[(639,244),(676,354),(648,521),(639,864)],'#c5b998',1.4)
    ell(im,(664,556,720,612),'#f7f1df','#dcd2b9');icon(im,'prev',682,574,'#929a7f')
    footer(im,'02 / 03','2025.03 → 05','翻页中间状态')
    save(im,'05-album-page-turn.png')


def editor():
    im=shell('把今天，写进下一页。','左边预览排版，右边填写内容；选择模板后自动安排照片。',editor=True)
    # Preview is smaller only while editing, leaving space for an ordinary form.
    p=curved(pget('daily').resize((round(860*.83*S),round(622*.83*S)),Image.Resampling.LANCZOS),7)
    paste_shadow(im,p,36,237,35,16,16)
    tx(im,(39,210),'页面预览',16,INK);chip(im,(645,201,750,233),'日常拼贴')
    tx(im,(44,831),'可替换照片、调整裁切；文字与装饰随模板自动排版。',13,MUTED)
    btn(im,(46,871,174,918),'上一模板');btn(im,(190,871,318,918),'下一模板')
    r=(874,128,1560,932);sh(im,r,26,17,10,24);rect(im,r,'#fcf8ed','#fffdf4',24)
    tx(im,(905,158),'写一页故事',28,INK,'serif');tx(im,(1525,164),'×',24,MUTED,anchor='mm');tx(im,(907,207),'日期必填，图片和文字可以之后补充。',13,MUTED)
    def field(y,label,value,w=620):
        tx(im,(908,y),label,14,INK);rect(im,(905,y+26,905+w,y+71),'#fffdf5','#e1dcc8',10);tx(im,(921,y+48),value,16,MUTED,anchor='lm')
    field(244,'日期','2025-03-16');field(336,'这一页的名字','把普通的一天，过成喜欢的样子。')
    tx(im,(908,429),'模板',14,INK)
    for i,(name,kind) in enumerate([('日常拼贴','daily'),('旅行图文','travel'),('纪念日','anniversary')]):
        x=906+i*210;rect(im,(x,458,x+196,540),'#e5ead9' if i==0 else '#f4efe2',GREEN if i==0 else '#e7e0cd',12)
        thumb=pget(kind).resize((round(88*S),round(64*S)),Image.Resampling.LANCZOS);im.alpha_composite(thumb,(round((x+9)*S),round(467*S)));tx(im,(x+109,489),name,12,INK);tx(im,(x+109,513),'已选择' if i==0 else '选择',11,GREEN if i==0 else MUTED)
    tx(im,(908,562),'照片 · 3 张',14,INK);tx(im,(1524,568),'添加照片 ＋',12,GREEN,anchor='rm')
    for i,k in enumerate(['home','flowers','street']):
        x=907+i*129;imagebox(im,(x,593,x+117,664),k,8);rect(im,(x,669,x+117,692),'#efe9d8',rad=7);tx(im,(x+59,680),'调整裁切',11,MUTED,anchor='mm')
    rect(im,(1305,593,1419,664),'#f4efe1','#dbd7c2',8);icon(im,'plus',1353,616,MUTED)
    tx(im,(908,719),'想留下的话',14,INK);rect(im,(905,745,1525,823),'#fffdf5','#e1dcc8',10)
    multiline(im,(921,757),['听了一下午的歌，也没有做什么大事。','但和你在一起的日子，总想好好留下来。'],14,MUTED,26)
    tx(im,(908,836),'照片多时自动延续到下一页，年月目录按日期更新。',12,MUTED)
    btn(im,(906,871,1070,915),'取消');btn(im,(1090,871,1525,915),'保存这一页',True)
    save(im,'06-album-editor.png')


def templates():
    im=shell('同一本手帐，六种记忆的写法。','模板控制照片、文字与装饰的位置；每次故事可以选择适合的一种。',editor=True)
    kinds=[('daily','01 / 日常拼贴','1 张主图 + 2 张小图 · 拍立得、胶带、涂鸦'),('travel','02 / 旅行图文','大幅风景 + 留白文字 · 城市与同行故事'),('anniversary','03 / 纪念日','两张照片 + 一句心里话 · 温柔贴纸'),('film','04 / 胶片格子','最多 6 张照片 · 把一段散步排成小片段'),('letter','05 / 一封短信','文字为主 + 一张照片 · 留给未来的我们'),('large','06 / 一张大图','大幅照片 + 简短标题 · 保存喜欢的瞬间')]
    for i,(k,title,sub) in enumerate(kinds):
        x=48+(i%3)*514;y=225+(i//3)*350
        p=pget(k).resize((round(397*S),round(287*S)),Image.Resampling.LANCZOS)
        sh(im,(x+20,y,x+417,y+287),22,12,8,15);im.alpha_composite(p,(round((x+20)*S),round(y*S)))
        tx(im,(x,y+298),title,19,INK);tx(im,(x,y+328),sub,12,MUTED)
    save(im,'07-album-templates.png')


def crop_board():
    im=shell('让照片，刚好放进这一页。','裁切只调整这张照片在模板里的显示范围。',editor=True)
    p=curved(pget('daily').resize((round(860*.87*S),round(622*.87*S)),Image.Resampling.LANCZOS),7)
    paste_shadow(im,p,150,218,32,16,15)
    dim=Image.new('RGBA',im.size,(66,62,47,82));im.alpha_composite(dim)
    sh(im,(349,132,1251,913),60,28,20,25);rect(im,(349,132,1251,913),'#fcf9ef','#fffdf6',25)
    tx(im,(384,166),'调整照片裁切',28,INK,'serif');tx(im,(1215,173),'×',24,MUTED,anchor='mm');tx(im,(385,213),'拖动调整位置，用滑块缩放；原照片会保留。',15,MUTED)
    rect(im,(384,250,1216,726),'#e3ddcd',rad=13);imagebox(im,(410,275,1190,701),'home')
    shade=Image.new('RGBA',im.size);rect(shade,(410,275,1190,701),(57,64,52,93));rect(shade,(462,300,1128,677),(0,0,0,0));im.alpha_composite(shade)
    rect(im,(462,300,1128,677),None,'#fffced',width=2)
    for t in [1/3,2/3]:
        ln(im,[(462+666*t,300),(462+666*t,677)],(255,251,235,130),1);ln(im,[(462,300+377*t),(1128,300+377*t)],(255,251,235,130),1)
    for x,y,a,b in [(462,300,1,1),(1128,300,-1,1),(462,677,1,-1),(1128,677,-1,-1)]:ln(im,[(x+a*19,y),(x,y),(x,y+b*19)],'#fffef1',4)
    tx(im,(387,767),'缩小',14,MUTED);ln(im,[(458,779),(1114,779)],'#ddd5c0',4);ln(im,[(458,779),(659,779)],GREEN,4);ell(im,(650,770,668,788),GREEN,'#fffaf0',2);tx(im,(1140,767),'放大',14,MUTED)
    btn(im,(386,833,516,881),'重置');btn(im,(903,833,1038,881),'取消');btn(im,(1056,833,1216,881),'应用裁切',True)
    save(im,'08-album-photo-crop.png')


def overview():
    ow,oh=1600,1160;im=Image.new('RGB',(ow,oh),'#eee7d5');d=ImageDraw.Draw(im)
    f=ImageFont.truetype(PING,28);small=ImageFont.truetype(PING,15)
    d.text((35,24),'相册设计 · 叠页手帐 / 时间线 / 混合模板',font=f,fill=INK)
    for i,(fn,title) in enumerate([('01-album-cover.png','01 · 封面'),('02-album-daily.png','02 · 日常拼贴'),('03-album-travel.png','03 · 旅行图文'),('04-album-anniversary.png','04 · 纪念日')]):
        x=32+(i%2)*789;y=89+(i//2)*519
        pic=Image.open(OUT/fn).resize((760,475),Image.Resampling.LANCZOS);im.paste(pic,(x,y));d.text((x+4,y+481),title,font=small,fill=INK)
    d.text((35,1130),'静态设计稿 · 占位图与示例内容 · 设计确认后开发',font=small,fill=MUTED)
    im.save(OUT/'00-album-overview.png');print(OUT/'00-album-overview.png')

if __name__=='__main__':
    mainboards();page_turn();editor();templates();crop_board();overview()
