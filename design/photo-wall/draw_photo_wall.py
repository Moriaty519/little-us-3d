"""Draw a soft miniature-style photo board. Requires Pillow and NumPy.

Run: python3 draw_photo_wall.py
Outputs are saved next to this source. All subjects are drawn procedurally.
"""
from pathlib import Path
import math
import random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

OUT = Path(__file__).resolve().parent
S = 3
CREAM = '#f5f1df'
SAGE = '#99aa83'
random.seed(23)


class Canvas:
    def __init__(self, width, height, background=(0, 0, 0, 0)):
        self.width, self.height = width, height
        self.im = Image.new('RGBA', (round(width*S), round(height*S)), background)
        self.d = ImageDraw.Draw(self.im)

    def box(self, xy, fill, radius=0, outline=None, width=1):
        xy = tuple(round(v*S) for v in xy)
        if radius:
            self.d.rounded_rectangle(xy, round(radius*S), fill=fill,
                                     outline=outline, width=round(width*S))
        else:
            self.d.rectangle(xy, fill=fill, outline=outline, width=round(width*S))

    def ellipse(self, xy, fill, outline=None, width=1):
        self.d.ellipse(tuple(round(v*S) for v in xy), fill, outline, round(width*S))

    def poly(self, xy, fill):
        self.d.polygon([(round(x*S), round(y*S)) for x,y in xy], fill)

    def line(self, xy, fill, width=1):
        self.d.line([(round(x*S), round(y*S)) for x,y in xy], fill,
                    round(width*S), joint='curve')

    def arc(self, xy, start, end, fill, width=1):
        self.d.arc(tuple(round(v*S) for v in xy), start, end, fill, round(width*S))

    def paste(self, im, x, y):
        self.im.alpha_composite(im, (round(x*S), round(y*S)))

    def shadow(self, im, x, y, blur=8, offset=(5,8), opacity=0.22):
        a = im.getchannel('A').point(lambda v: round(v*opacity))
        sh = Image.new('RGBA', im.size, '#51492e')
        sh.putalpha(a)
        pad = round((blur*4 + max(offset))*S)
        layer = Image.new('RGBA', (im.width+pad*2,im.height+pad*2))
        layer.alpha_composite(sh,(pad,pad))
        layer = layer.filter(ImageFilter.GaussianBlur(blur*S))
        self.im.alpha_composite(layer,(round((x+offset[0])*S)-pad,
                                      round((y+offset[1])*S)-pad))


def cloud(c, x, y, scale=1):
    c.ellipse((x,y+9*scale,x+65*scale,y+26*scale),'#e9eadc')
    c.ellipse((x+17*scale,y,x+44*scale,y+25*scale),'#e9eadc')


def tree(c,x,y,scale=1):
    c.box((x-4*scale,y,x+4*scale,y+77*scale),'#9c8659',2)
    c.ellipse((x-34*scale,y-41*scale,x+35*scale,y+28*scale),'#849567')
    c.ellipse((x-33*scale,y-39*scale,x+18*scale,y+13*scale),'#9aa878')
    c.ellipse((x-8*scale,y-46*scale,x+37*scale,y+8*scale),'#9ba978')


def scene(kind, w, h):
    c = Canvas(w,h,'#dce2d1')
    if kind == 'mountains':
        c.box((0,0,w,h),'#c5d8df')
        c.ellipse((w*.72,h*.12,w*.84,h*.28),'#d9c990')
        cloud(c,w*.1,h*.12,.75)
        c.poly([(0,h*.68),(w*.26,h*.23),(w*.6,h*.7)],'#829b98')
        c.poly([(w*.29,h*.69),(w*.69,h*.3),(w,h*.66)],'#b6bf9e')
        c.poly([(w*.08,h*.62),(w*.26,h*.23),(w*.34,h*.42)],'#b8c2a6')
        c.poly([(w*.205,h*.33),(w*.26,h*.23),(w*.33,h*.35),
                (w*.29,h*.34),(w*.25,h*.3)],'#eeeee0')
        c.box((0,h*.68,w,h),'#92b5ba')
        c.poly([(0,h*.82),(w*.38,h*.68),(w*.53,h*.69),(w*.15,h)],'#bacbc1')
        c.ellipse((-w*.3,h*.8,w*.35,h*1.3),'#9ba87d')
        for x,y,length in [(w*.45,h*.82,w*.14),(w*.7,h*.91,w*.09),(w*.22,h*.73,w*.12)]:
            c.line([(x,y),(x+length,y)],'#dce3d4',1.7)
        tree(c,w*.075,h*.78,.42)
    elif kind == 'cafe':
        c.box((0,0,w,h),'#d4dac2')
        c.box((0,h*.69,w,h),'#d5c494')
        c.poly([(w*.12,h*.82),(w*.79,h*.82),(w*.99,h*.94),(w*.25,h*.94)],'#c3b280')
        c.box((w*.12,h*.15,w*.8,h*.83),'#ecd2b1',5)
        c.box((w*.2,h*.38,w*.4,h*.76),'#afbb99',3)
        c.box((w*.47,h*.39,w*.72,h*.66),'#879d83',3)
        c.box((w*.49,h*.4,w*.695,h*.64),'#8caaad',2)
        c.line([(w*.59,h*.4),(w*.59,h*.64)],'#f4e8c6',3)
        c.line([(w*.49,h*.52),(w*.695,h*.52)],'#f4e8c6',3)
        c.box((w*.105,h*.23,w*.82,h*.37),'#6f946f',3)
        stripe = (w*.715)/7
        for i in range(7):
            if i % 2 == 0:
                c.box((w*.105+i*stripe,h*.23,w*.105+(i+1)*stripe,h*.37),'#e8e2c6',2)
        c.box((w*.17,h*.11,w*.76,h*.2),'#b6bf98',3)
        c.ellipse((w*.29,h*.14,w*.315,h*.18),'#f1e8cb')
        c.line([(w*.34,h*.16),(w*.56,h*.16)],'#e8e5ce',2)
        c.ellipse((w*.71,h*.76,w*.94,h*.88),'#a6b18c')
        c.line([(w*.82,h*.86),(w*.82,h*.97)],'#ac905b',4)
        c.box((w*.05,h*.76,w*.13,h*.89),'#bda574',2)
        tree(c,w*.09,h*.64,.28)
        c.ellipse((w*.365,h*.57,w*.38,h*.59),'#d8bd7e')
    elif kind == 'flowers':
        c.box((0,0,w,h),'#dfd6cb')
        c.box((0,h*.78,w,h),'#c4ceac')
        c.ellipse((w*.19,h*.77,w*.84,h*.92),'#afba99')
        c.poly([(w*.32,h*.58),(w*.7,h*.58),(w*.63,h*.87),(w*.39,h*.87)],'#c99573')
        c.box((w*.3,h*.57,w*.72,h*.65),'#deca9f',5)
        for x,y in [(w*.4,h*.33),(w*.63,h*.28),(w*.53,h*.17),(w*.7,h*.43)]:
            c.line([(w*.51,h*.61),(x,y)],'#81956c',3)
            c.ellipse((x-13,y+30,x+3,y+46),'#9cad7d')
            for i in range(7):
                a=i*math.tau/7
                px,py=x+13*math.cos(a),y+13*math.sin(a)
                c.ellipse((px-10,py-12,px+10,py+12),'#f5edd6' if x<w*.5 else '#e9b6af')
            c.ellipse((x-7,y-7,x+7,y+7),'#cbb76d')
    elif kind == 'dog':
        c.box((0,0,w,h),'#d8dfc8')
        c.ellipse((-w*.2,h*.7,w*1.2,h*1.3),'#b7c39e')
        c.ellipse((w*.21,h*.78,w*.85,h*.96),'#a5b391')
        c.ellipse((w*.32,h*.5,w*.72,h*.89),'#b6854f')
        c.ellipse((w*.35,h*.49,w*.64,h*.8),'#dbc39a')
        c.ellipse((w*.27,h*.21,w*.79,h*.61),'#d8bd8e')
        c.ellipse((w*.245,h*.23,w*.4,h*.6),'#b08d5d')
        c.ellipse((w*.68,h*.22,w*.81,h*.58),'#aa885b')
        c.ellipse((w*.33,h*.21,w*.74,h*.52),'#d6a666')
        c.ellipse((w*.41,h*.41,w*.67,h*.61),'#eee2c4')
        for x in [w*.42,w*.65]:
            c.ellipse((x-4,h*.38-4,x+4,h*.38+4),'#584c33')
            c.ellipse((x-2,h*.38-3,x,h*.38-1),'#f6edd8')
        c.ellipse((w*.5,h*.445,w*.572,h*.49),'#77633f')
        c.line([(w*.536,h*.49),(w*.536,h*.53)],'#9a8159',1.5)
        c.box((w*.355,h*.59,w*.72,h*.64),'#93a77f',4)
        c.ellipse((w*.51,h*.62,w*.55,h*.665),'#d5ba76')
        c.ellipse((w*.33,h*.78,w*.465,h*.92),'#d5bc91')
        c.ellipse((w*.56,h*.78,w*.7,h*.92),'#d5bc91')
        c.arc((w*.6,h*.56,w*.86,h*.83),-65,80,'#c4a372',12)
    elif kind == 'cabin':
        c.box((0,0,w,h),'#c8d9da')
        c.ellipse((w*.76,h*.1,w*.85,h*.24),'#d5c58d')
        c.ellipse((-w*.25,h*.35,w*.72,h*1.3),'#b6c19b')
        c.ellipse((w*.3,h*.48,w*1.25,h*1.15),'#a9b68d')
        c.poly([(w*.19,h*.82),(w*.67,h*.75),(w*.88,h*.95),(w*.34,h*.97)],'#98a57c')
        for x,y,z in [(w*.1,h*.47,.5),(w*.87,h*.4,.65),(w*.78,h*.52,.35)]:
            tree(c,x,y,z)
        c.poly([(w*.3,h*.38),(w*.57,h*.37),(w*.57,h*.82),(w*.3,h*.83)],'#e3bf82')
        c.poly([(w*.57,h*.38),(w*.74,h*.5),(w*.74,h*.79),(w*.57,h*.82)],'#c3ad7b')
        c.poly([(w*.23,h*.43),(w*.42,h*.2),(w*.63,h*.39)],'#a1af7e')
        c.poly([(w*.42,h*.2),(w*.65,h*.3),(w*.79,h*.5),(w*.63,h*.45)],'#799061')
        c.line([(w*.235,h*.44),(w*.42,h*.215),(w*.637,h*.44)],'#c6ccac',5)
        c.box((w*.395,h*.6,w*.505,h*.82),'#aab793',2)
        c.box((w*.32,h*.48,w*.41,h*.58),'#ede8cd',2)
        c.box((w*.335,h*.493,w*.394,h*.563),'#9cac92',1)
        c.box((w*.626,h*.54,w*.685,h*.655),'#a8b698',1)
        c.ellipse((w*.476,h*.709,w*.488,h*.723),'#c5ae71')
        c.poly([(w*.41,h*.83),(w*.52,h*.83),(w*.64,h),(w*.44,h)],'#d9cca6')
        for x,y in [(w*.16,h*.84),(w*.24,h*.92),(w*.76,h*.88)]:
            c.ellipse((x,y,x+5,y+5),'#ebe9cb')
    elif kind == 'beach':
        c.box((0,0,w,h),'#d2e3e4')
        c.ellipse((w*.67,h*.14,w*.8,h*.3),'#d9ca97')
        c.box((0,h*.47,w,h),'#7ea8b3')
        c.poly([(0,h*.82),(w,h*.62),(w,h),(0,h)],'#e0c28e')
        c.line([(0,h*.8),(w*.25,h*.76),(w*.58,h*.68),(w,h*.62)],'#e8e7d3',4)
        c.line([(w*.08,h*.6),(w*.32,h*.6)],'#cddbcc',2)
        c.line([(w*.57,h*.52),(w*.75,h*.52)],'#cddbcc',1.7)
        c.ellipse((w*.31,h*.81,w*.74,h*.93),'#c5b88f')
        c.line([(w*.48,h*.58),(w*.49,h*.89)],'#a18b59',4)
        c.poly([(w*.21,h*.62),(w*.48,h*.38),(w*.77,h*.62)],'#97a782')
        c.poly([(w*.21,h*.62),(w*.48,h*.38),(w*.48,h*.63)],'#bec9a8')
        c.poly([(w*.48,h*.38),(w*.6,h*.62),(w*.48,h*.63)],'#a8b690')
        c.box((w*.58,h*.8,w*.72,h*.85),'#f0e6ca',2)
        c.line([(w*.62,h*.795),(w*.62,h*.855)],'#aeb996',4)
    return c.im


def paper(w,h,fill=CREAM,radius=3):
    c=Canvas(w,h)
    c.box((1,2,w-1,h-1),'#d5d1b9',radius)
    c.box((0,0,w-2,h-4),fill,radius)
    c.line([(4,3),(w-7,3)],'#fffbed',1)
    return c


def place(c, im, x,y,angle=0, shadow=True,blur=5,opacity=.22):
    rot=im.rotate(angle,resample=Image.Resampling.BICUBIC,expand=True)
    dx=(rot.width-im.width)/(2*S)
    dy=(rot.height-im.height)/(2*S)
    if shadow:c.shadow(rot,x-dx,y-dy,blur=blur,opacity=opacity)
    c.paste(rot,x-dx,y-dy)


def tape(c,x,y,w=88,h=31,angle=-8,color='#b2bd95'):
    t=Canvas(w,h)
    teeth=[(0,0),(w,0),(w-3,h*.18),(w,h*.35),(w-3,h*.55),(w,h*.78),(w-2,h),
           (0,h),(2,h*.8),(0,h*.63),(3,h*.45),(0,h*.25)]
    t.poly(teeth,color)
    t.line([(5,3),(w-6,3)],'#c6cfaf',1)
    for k in range(7):
        xx=9+k*11
        t.line([(xx,h*.27),(xx+3,h*.27)],'#c6cdae',1)
        t.line([(xx+5,h*.68),(xx+8,h*.68)],'#c6cdae',1)
    place(c,t.im,x,y,angle,blur=1.3,opacity=.13)


def pin(c,x,y,color='#a8b48c'):
    c.ellipse((x-3,y+5,x+12,y+15),'#8e9675')
    c.ellipse((x-9,y-9,x+9,y+9),'#859269')
    c.ellipse((x-9,y-11,x+7,y+4),color)
    c.ellipse((x-5,y-9,x+1,y-4),'#c8d1ae')


def star(c,x,y,r=18,color='#d9c58f',angle=0):
    pts=[]
    for i in range(10):
        a=-math.pi/2+i*math.pi/5+angle
        rr=r if i%2==0 else r*.48
        pts.append((x+math.cos(a)*rr,y+math.sin(a)*rr))
    c.poly([(xx+2,yy+3) for xx,yy in pts],'#a0a785')
    c.poly(pts,color)


def daisy(c,x,y,r=25):
    for i in range(8):
        a=i*math.tau/8
        px,py=x+r*.72*math.cos(a),y+r*.72*math.sin(a)
        c.ellipse((px-r*.36+2,py-r*.46+3,px+r*.36+2,py+r*.46+3),'#a7ac8c')
        c.ellipse((px-r*.36,py-r*.46,px+r*.36,py+r*.46),'#f0ecda')
    c.ellipse((x-r*.32,y-r*.32,x+r*.32,y+r*.32),'#cfb978')
    c.ellipse((x-r*.27,y-r*.28,x+r*.17,y+r*.12),'#e1cc8c')


def sprig(c,x,y,scale=1):
    p=Canvas(210*scale,230*scale)
    base=(120*scale,215*scale)
    for top in [(45,38),(94,12),(137,35),(171,69)]:
        tx,ty=top[0]*scale,top[1]*scale
        p.line([base,(tx,ty)],'#9e9a6d',2.4*scale)
        for f in [.26,.43,.61]:
            px=tx+(base[0]-tx)*f;py=ty+(base[1]-ty)*f
            p.ellipse((px-16*scale,py-3*scale,px+2*scale,py+12*scale),'#a6b18b')
            p.ellipse((px+2*scale,py+7*scale,px+21*scale,py+18*scale),'#b5bd98')
        for j in range(5):
            yy=ty+j*8*scale
            p.ellipse((tx-11*scale,yy-4*scale,tx+1*scale,yy+6*scale),'#d9cba4')
            p.ellipse((tx+1*scale,yy,tx+13*scale,yy+10*scale),'#e2d6b6')
    p.line([(111*scale,189*scale),(126*scale,191*scale)],'#e8dfbb',4*scale)
    place(c,p.im,x,y,-12,blur=3,opacity=.2)


def board():
    b=Canvas(1600,1100)
    # A warm, bevelled wood frame around a muted sage fabric surface.
    b.box((0,0,1600,1100),'#ad925f',43)
    b.box((0,0,1593,1090),'#d0b47b',40)
    b.box((4,4,1586,1079),'#dfc794',37)
    b.box((11,11,1579,1070),'#d8bf87',32)
    b.line([(34,19),(1557,19)],'#ede0b6',2)
    b.line([(18,34),(18,1048)],'#e8d6a5',2)
    b.box((54,54,1543,1037),'#b0ac81',16)
    b.box((61,62,1542,1038),'#a9b493',13)
    b.box((64,65,1537,1031),'#9cac88',12)
    # Very fine woven texture; low contrast keeps the miniature appearance.
    texture=Canvas(1600,1100)
    for y in range(70,1025,4):
        texture.line([(70,y),(1530,y)],(103,119,80,13),.5)
    for x in range(70,1535,5):
        texture.line([(x,70),(x,1025)],(232,236,210,17),.5)
    for _ in range(200):
        x=random.uniform(80,1520);y=random.uniform(80,1020)
        texture.ellipse((x,y,x+1.3,y+1.3),(97,115,77,16))
    b.paste(texture.im,0,0)
    # Two small notes sit behind the photographs.
    note=paper(235,165,'#e5d8b1',4)
    for yy,length in [(51,148),(73,167),(95,119)]:
        note.line([(30,yy),(30+length,yy)],'#c7bb95',2)
    place(b,note.im,924,420,7,blur=3)
    tape(b,981,415,80,28,5,'#d5d3b1')
    note2=paper(168,145,'#d2d7ba',3)
    note2.ellipse((55,32,115,91),'#adb98f')
    note2.poly([(53,107),(85,66),(119,107)],'#eff0d8')
    place(b,note2.im,110,535,-6,blur=3)
    # Photographs: landscape, cafe, bouquet, pet, little house, beach.
    photos=[('mountains',125,142,338,340,7),
            ('cafe',581,112,421,305,-3),
            ('flowers',1168,145,276,355,-7),
            ('dog',172,654,297,307,-5),
            ('cabin',579,549,405,373,5),
            ('beach',1152,651,313,303,-4)]
    for i,(kind,x,y,w,h,angle) in enumerate(photos):
        p=paper(w,h)
        p.box((0,0,w-2,h-4),'#faf7e9',3,outline='#9b8059',width=5)
        m=19
        sh=h-74
        p.box((m-3,m-3,w-m+3,sh+3),'#7e8a6a',1)
        artwork=ImageEnhance.Color(scene(kind,w-2*m,sh-m)).enhance(1.25)
        artwork=ImageEnhance.Contrast(artwork).enhance(1.10)
        p.paste(artwork,m,m)
        p.line([(w*.42,h-26),(w*.58,h-26)],'#d4d2ba',1.4)
        place(b,p.im,x,y,angle,blur=5,opacity=.32)
    # Adhesive strips and rounded pegs provide the attached-paper feeling.
    tape(b,238,115,102,33,7)
    tape(b,731,100,111,33,-3,'#c0c8a3')
    tape(b,1251,130,91,34,-7,'#d3d2ae')
    tape(b,234,645,94,34,-5,'#d1d0ad')
    tape(b,730,535,111,32,5)
    tape(b,1226,640,99,32,-4,'#bec8a0')
    pin(b,420,452,'#c9b375')
    pin(b,966,139,'#a9b992')
    pin(b,1420,460,'#c9b375')
    # Delicate botanical and paper decorations, visibly on the board itself.
    daisy(b,105,129,27)
    daisy(b,111,175,16)
    star(b,1074,191,23)
    star(b,1096,245,13,'#e6d8ae',.15)
    sprig(b,940,735,.92)
    tape(b,1055,909,54,25,-10,'#ded6b6')
    # A small brass paper clip, without text or decorative UI labels.
    b.arc((1023,464,1051,516),180,360,'#b3a374',4)
    b.line([(1023,489),(1023,520),(1045,520),(1045,485)],'#b3a374',4)
    b.arc((1031,482,1045,505),180,360,'#d8c38c',2)
    # A paper heart in a quiet gap between the lower photographs.
    heart=Canvas(65,57)
    heart.ellipse((5,3,35,34),'#d6be9d')
    heart.ellipse((28,3,58,34),'#d6be9d')
    heart.poly([(8,24),(55,24),(32,54)],'#d6be9d')
    place(b,heart.im,500,825,-12,blur=2,opacity=.16)
    return b.im


def warp(im,quad,size):
    # Pillow's inverse projective transform, from final pixels to source pixels.
    src=[(0,0),(im.width,0),(im.width,im.height),(0,im.height)]
    a=[];v=[]
    for (x,y),(u,z) in zip(quad,src):
        a.append([x,y,1,0,0,0,-u*x,-u*y]);v.append(u)
        a.append([0,0,0,x,y,1,-z*x,-z*y]);v.append(z)
    coeff=np.linalg.solve(np.asarray(a),np.asarray(v))
    return im.transform(size,Image.Transform.PERSPECTIVE,coeff,
                        Image.Resampling.BICUBIC)


def main():
    W,H=2400,1800
    yy,xx=np.mgrid[0:H,0:W]
    glow=np.exp(-(((xx-900)/1550)**2+((yy-530)/1250)**2))
    colors=np.array([235,226,204])+glow[...,None]*np.array([10,10,9])
    bg=Image.fromarray(colors.astype('uint8'),'RGB').convert('RGBA')
    surface=board()
    quad=[(291,195),(2140,384),(2070,1556),(287,1363)]
    face=warp(surface,quad,(W,H))
    # Broad ambient shadow plus a short soft contact shadow.
    shadow=Image.new('RGBA',(W,H),'#8e8260')
    shadow.putalpha(face.getchannel('A').point(lambda v:round(v*.23)))
    shadow=shadow.filter(ImageFilter.GaussianBlur(38))
    shifted=Image.new('RGBA',(W,H));shifted.alpha_composite(shadow,(47,68))
    bg.alpha_composite(shifted)
    # Board depth: a solid wooden edge, offset underneath the framed face.
    depth=Image.new('RGBA',(W,H),'#b49864')
    depth.putalpha(face.getchannel('A'))
    shifted=Image.new('RGBA',(W,H));shifted.alpha_composite(depth,(5,23))
    bg.alpha_composite(shifted)
    bg.alpha_composite(face)
    bg.convert('RGB').save(OUT/'photo-wall.png',optimize=True)
    # Also preserve the full-resolution frontal artwork for subsequent editing.
    surface.save(OUT/'photo-wall-front.png',optimize=True)
    bg.convert('RGB').resize((1200,900),Image.Resampling.LANCZOS).save(
        OUT/'photo-wall-preview.jpg',quality=94)
    print(OUT/'photo-wall.png')


if __name__=='__main__':
    main()
