"""Static design boards only. Does not modify or implement the application."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import json, math, re

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'design'
OUT.mkdir(exist_ok=True)
W, H, S = 1600, 1000, 2
BG = '#eee7d3'
INK = '#505b49'
MUTED = '#929781'
GREEN = '#899c73'
CREAM = '#fff9e9'
FONT = '/System/Library/AssetsV2/com_apple_MobileAsset_Font8/86ba2c91f017a3749571a82f2c6d890ac7ffb2fb.asset/AssetData/PingFang.ttc'
LATIN = '/System/Library/Fonts/HelveticaNeue.ttc'
REGIONS = json.loads(re.search(r'CHINA_REGIONS=(.*);', (ROOT / 'src/china-map-data.js').read_text(), re.S).group(1))
FONTS = {}

def font(size, latin=False):
    key = size, latin
    if key not in FONTS:
        FONTS[key] = ImageFont.truetype(LATIN if latin else FONT, round(size*S))
    return FONTS[key]

def rgb(value):
    return tuple(int(value[i:i+2], 16) for i in (1, 3, 5))

def text(im, xy, content, size=18, color=INK, latin=False, anchor=None):
    ImageDraw.Draw(im).text((xy[0]*S, xy[1]*S), content, font=font(size, latin), fill=color, anchor=anchor)

def poly(im, points, color, outline=None, width=1):
    d = ImageDraw.Draw(im)
    points = [(round(x*S), round(y*S)) for x,y in points]
    d.polygon(points, fill=color)
    if outline:
        d.line(points+[points[0]], fill=outline, width=round(width*S), joint='curve')

def line(im, points, color, width=1):
    ImageDraw.Draw(im).line([(x*S,y*S) for x,y in points], fill=color, width=round(width*S), joint='curve')

def rr(im, rect, radius=16, fill=CREAM, border=None, width=1):
    ImageDraw.Draw(im).rounded_rectangle(tuple(v*S for v in rect), radius*S, fill=fill, outline=border, width=round(width*S))

def ellipse(im, rect, fill, outline=None, width=1):
    ImageDraw.Draw(im).ellipse(tuple(v*S for v in rect), fill=fill, outline=outline, width=round(width*S))

def shadow(im, rect, radius=24, blur=22, alpha=28, dy=12):
    layer = Image.new('RGBA', im.size)
    ImageDraw.Draw(layer).rounded_rectangle((rect[0]*S,(rect[1]+dy)*S,rect[2]*S,(rect[3]+dy)*S), radius*S, fill=(90,75,45,alpha))
    im.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur*S)))

def icon(im, kind, x, y, color=INK, size=20):
    q=size/20
    def pts(seq): return [(x+a*q,y+b*q) for a,b in seq]
    if kind == 'back': line(im,pts([(12,4),(6,10),(12,16)]),color,1.7);line(im,pts([(6,10),(18,10)]),color,1.7)
    elif kind == 'plus': line(im,pts([(10,4),(10,16)]),color,1.7);line(im,pts([(4,10),(16,10)]),color,1.7)
    elif kind == 'minus': line(im,pts([(4,10),(16,10)]),color,1.7)
    elif kind == 'close': line(im,pts([(5,5),(15,15)]),color,1.6);line(im,pts([(15,5),(5,15)]),color,1.6)
    elif kind == 'home':
        line(im,pts([(2,10),(10,3),(18,10),(18,18),(2,18),(2,10)]),color,1.5)
        line(im,pts([(7,18),(7,11),(13,11),(13,18)]),color,1.5)
    elif kind == 'search':
        ellipse(im,(x+3*q,y+3*q,x+13*q,y+13*q),None,color,1.5)
        line(im,pts([(12,12),(17,17)]),color,1.5)
    elif kind == 'reset':
        d=ImageDraw.Draw(im);d.arc(((x+4*q)*S,(y+4*q)*S,(x+17*q)*S,(y+17*q)*S),-100,220,fill=color,width=round(1.5*S))
        line(im,pts([(3,4),(3,9),(8,9)]),color,1.5)
    elif kind == 'photo':
        rr(im,(x+2*q,y+3*q,x+18*q,y+17*q),2*q,None,color,1.4)
        ellipse(im,(x+5*q,y+6*q,x+8*q,y+9*q),color)
        line(im,pts([(3,16),(9,10),(12,13),(15,10),(18,13)]),color,1.4)

def button(im, rect, label, primary=False, sym=None):
    rr(im,rect,21,GREEN if primary else '#fbf6e7')
    col='#fffcef' if primary else INK
    x,y,x2,y2=rect
    if sym:
        icon(im,sym,x+18,(y+y2)/2-10,col)
        text(im,(x+46,(y+y2)/2),label,17,col,anchor='lm')
    else: text(im,((x+x2)/2,(y+y2)/2),label,17,col,anchor='mm')

def background():
    im=Image.new('RGBA',(W*S,H*S),BG)
    # Gentle warm gradient; no simulated photographs or personal data.
    d=ImageDraw.Draw(im)
    a,b=rgb('#f1ead9'),rgb('#eae3cf')
    for y in range(H*S):
        t=y/(H*S-1)
        d.line([(0,y),(W*S,y)],fill=tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3)))
    button(im,(38,28,176,78),'回到小屋',sym='back')
    text(im,(205,31),'little us.',30,INK,True)
    text(im,(206,67),'小小的我们 · 足迹',12,MUTED)
    text(im,(800,55),'我们的足迹地图',19,INK,anchor='mm')
    button(im,(1270,28,1396,78),'导入 / 备份')
    button(im,(1414,28,1562,78),'记录足迹',True,'plus')
    line(im,[(40,105),(1560,105)],'#ddd7c3',1)
    text(im,(40,955),'设计稿 · 示例内容与图片区域，实际使用从空白记录开始',13,MUTED)
    text(im,(1560,955),'little us.  /  TRAVEL MEMORIES',12,MUTED,True,anchor='ra')
    return im

CITIES = [('北京',116.4053,39.9049,1),('上海',121.4737,31.2304,2),('成都',104.0665,30.5723,2),('大理',100.2676,25.6065,1)]

def draw_map(im, ox=577, oy=580, scale=14.1, selected=None):
    def project(lon,lat,z=0):
        u=(lon-104.2)*.819;v=36-lat
        return (ox+(u+v*.27)*scale,oy+(v*.76-u*.13-z)*scale)
    def local(u,v,z=0):return (ox+(u+v*.27)*scale,oy+(v*.76-u*.13-z)*scale)
    corners=[(-29,-20),(29,-20),(29,23),(-29,23)]
    top=[local(u,v) for u,v in corners]
    bottom=[local(u,v,-1.2) for u,v in corners]
    sh=Image.new('RGBA',im.size)
    poly(sh,[(x+12,y+25) for x,y in bottom],(92,76,43,43))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(20*S)))
    # The thick wooden tray shares the room's wood and soft neutral materials.
    poly(im,[top[1],top[2],bottom[2],bottom[1]],'#c3a372')
    poly(im,[top[2],top[3],bottom[3],bottom[2]],'#c9aa79')
    poly(im,top,'#dfc79d','#e7d3b1',1.3)
    inset=[local(u*.975,v*.975,.045) for u,v in corners]
    poly(im,inset,'#e8d9b8','#efe2c7',1)
    # Province relief rendered from the exact local geographic outlines.
    palette=['#b1bba1','#a6b395','#bac3a7','#aebaa0','#a2b18f','#b5bfa2']
    polygons=[]
    for i,region in enumerate(REGIONS):
        for polygon in region['polygons']:
            ring=polygon[0]
            if len(ring)<3 or max(p[1] for p in ring)<17.5: continue
            if sum(p[1] for p in ring)/len(ring)<18 and region['name'] not in ('海南省','台湾省'): continue
            height=.55+(i%3)*.065
            pts=[project(lon,lat,height) for lon,lat in ring]
            lower=[project(lon,lat,.045) for lon,lat in ring]
            polygons.append((sum(y for x,y in pts)/len(pts),i,pts,lower))
    polygons.sort(key=lambda p:p[0])
    for _,i,pts,lower in polygons:
        for j in range(len(pts)-1):
            if pts[j+1][0]>=pts[j][0]:
                poly(im,[pts[j],pts[j+1],lower[j+1],lower[j]],'#8f9b7c')
        poly(im,pts,palette[i%len(palette)],'#e2e5cf',.8)
    # Small inset presents southern islands without stretching the main relief.
    p=[local(u,v,.10) for u,v in [(20,12.7),(26.7,12.7),(26.7,21.2),(20,21.2)]]
    poly(im,p,'#e5dcc4','#bac3a3',.9)
    def sea(lon,lat):return local(20.45+(lon-105)/20*5.8,13.2+(25-lat)/25*6.8,.14)
    for region in REGIONS:
        for polygon in region['polygons']:
            ring=polygon[0]
            if not ring or not all(105<=p[0]<=125 and 0<=p[1]<=25 for p in ring): continue
            poly(im,[sea(lon,lat) for lon,lat in ring],'#a1b18d','#8b9d79',.65)
    lab=local(23.4,20.6,.2);text(im,lab,'南海诸岛',11,'#879578',anchor='mm')
    # Each recorded CITY has a warm light, rather than lighting an entire province.
    labels={'北京':(-18,-42),'上海':(44,0),'成都':(-50,-47),'大理':(-10,41)}
    for name,lon,lat,count in CITIES:
        x,y=project(lon,lat,.7)
        glow=Image.new('RGBA',im.size)
        ellipse(glow,(x-18,y-10,x+18,y+10),(231,204,116,100))
        im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(6*S)))
        ellipse(im,(x-8,y-4,x+8,y+4),'#c3ab66')
        line(im,[(x,y),(x,y-20)],'#a69052',3.3)
        ellipse(im,(x-7,y-28,x+7,y-14),'#ead991','#fff6cf',1.2)
        ellipse(im,(x-3,y-27,x+2,y-23),'#fffbea')
        if name==selected:
            ellipse(im,(x-19,y-9,x+19,y+9),None,'#d5b56e',1.5)
        dx,dy=labels[name];lx,ly=x+dx,y+dy
        rr(im,(lx-35,ly-16,lx+35,ly+16),13,'#faf3de','#e1d8bb')
        text(im,(lx,ly),name,14,INK,anchor='mm')
    return project

def controls(im, x=560):
    rr(im,(x-84,875,x+84,925),20,'#fbf6e7')
    icon(im,'minus',x-66,890,MUTED)
    icon(im,'reset',x-10,889,MUTED)
    icon(im,'plus',x+47,890,MUTED)
    text(im,(x,850),'拖动旋转 · 滚轮缩放 · 点击亮起的城市',13,MUTED,anchor='mm')

def landscape(im,rect,variant=0):
    # A drawn placeholder for the future user's uploaded photographs.
    x,y,x2,y2=rect;w=x2-x;h=y2-y
    thumb=Image.new('RGBA',(round(w*S),round(h*S)),'#dbe1cd')
    def P(seq):return [(a*w,b*h) for a,b in seq]
    ellipse(thumb,(w*.66,h*.15,w*.79,h*.39),'#efe3bc')
    if variant%3==0:
        poly(thumb,P([(0,.77),(.22,.35),(.48,.66),(.7,.44),(1,.78),(1,1),(0,1)]),'#a1b096')
        poly(thumb,P([(0,.88),(.3,.72),(.66,.85),(1,.62),(1,1),(0,1)]),'#889d81')
        poly(thumb,P([(0,.92),(.4,.83),(.7,.94),(1,.8),(1,1),(0,1)]),'#c4d2cd')
    elif variant%3==1:
        poly(thumb,P([(0,.75),(.3,.57),(.6,.66),(1,.49),(1,1),(0,1)]),'#aebfa5')
        for dx,dy,bw,bh in [(.19,.47,.19,.36),(.45,.38,.23,.44),(.7,.53,.17,.3)]:
            rr(thumb,(w*dx,h*dy,w*(dx+bw),h*(dy+bh)),2,'#d3b78b')
            poly(thumb,[(w*(dx-.02),h*dy),(w*(dx+bw*.5),h*(dy-.08)),(w*(dx+bw+.02),h*dy)],'#829378')
        poly(thumb,P([(0,1),(.55,.81),(.9,1)]),'#e1cfad')
    else:
        poly(thumb,P([(0,.69),(.33,.53),(.66,.6),(1,.5),(1,1),(0,1)]),'#a4b795')
        for a in [.16,.4,.67,.82]:
            line(thumb,[(w*a,h*.44),(w*a,h*.84)],'#7f9471',3)
            ellipse(thumb,(w*(a-.09),h*.25,w*(a+.09),h*.58),'#8fa681')
        poly(thumb,P([(0,1),(.49,.78),(.59,.61),(.65,.63),(.58,.84),(.8,1)]),'#e6d9b8')
    mask=Image.new('L',thumb.size)
    ImageDraw.Draw(mask).rounded_rectangle((0,0,thumb.width-1,thumb.height-1),14*S,fill=255)
    im.paste(thumb,(round(x*S),round(y*S)),mask)
    rr(im,(x+10,y2-33,x+91,y2-10),8,'#f9f0da')
    text(im,(x+50,y2-22),'图片示意',11,'#8d927f',anchor='mm')

def homepage():
    im=background()
    text(im,(50,145),'把我们的足迹，留在这片山河里。',35,INK)
    text(im,(52,201),'走过的城市，和每一次想记住的同行。',17,MUTED)
    rr(im,(53,246,331,288),16,'#f9f3e2')
    text(im,(74,257),'4 座城市',16,INK);text(im,(181,257),'·',16,MUTED);text(im,(206,257),'6 段回忆',16,INK)
    draw_map(im,ox=583,oy=530,scale=13.9)
    controls(im,580)
    panel=(1190,145,1550,857)
    shadow(im,panel);rr(im,panel,26,'#fbf6e7','#fffbee')
    text(im,(1216,174),'走过的地方',23,INK)
    text(im,(1217,212),'每一个亮点，都藏着我们的故事。',14,MUTED)
    rr(im,(1214,252,1526,297),14,'#f1ecd9')
    icon(im,'search',1229,264,MUTED);text(im,(1259,263),'查找已记录城市',15,MUTED)
    for i,(city,province,count) in enumerate([('成都','四川',2),('大理','云南',1),('上海','上海',2),('北京','北京',1)]):
        y=326+i*109
        rr(im,(1214,y,1526,y+91),17,'#fffbee')
        ellipse(im,(1232,y+25,1259,y+52),'#aeb99b')
        ellipse(im,(1240,y+31,1251,y+42),'#f3e3a3')
        text(im,(1275,y+15),city,21,INK)
        text(im,(1275,y+51),f'{province} · {count} 段回忆',14,MUTED)
        text(im,(1503,y+41),'›',25,'#9ca389',anchor='mm')
    text(im,(1218,791),'点击城市，打开照片与文字。',13,MUTED)
    save(im,'01-map-home.png')

def details():
    im=background()
    text(im,(50,145),'走到哪里，都有我们的故事。',32,INK)
    text(im,(52,196),'成都的两段回忆，留在同一盏小灯里。',17,MUTED)
    draw_map(im,ox=522,oy=563,scale=12.7,selected='成都')
    controls(im,510)
    panel=(1060,139,1550,922)
    shadow(im,panel);rr(im,panel,25,'#fbf6e7','#fffbee')
    icon(im,'close',1509,162,MUTED)
    text(im,(1090,166),'成都',35,INK)
    text(im,(1091,215),'四川 · 2 段回忆',15,MUTED)
    button(im,(1364,199,1520,245),'再记一次',False,'plus')
    line(im,[(1090,265),(1520,265)],'#e4deca')
    text(im,(1090,285),'2025.05.18',13,MUTED,True)
    text(im,(1090,316),'在成都，慢慢走。',24,INK)
    landscape(im,(1090,362,1520,551),2)
    text(im,(1090,568),'沿着树荫散步，在转角的小店歇了很久。',16,INK)
    text(im,(1090,599),'没有赶路，只想和你多待一会儿。',16,INK)
    for i in range(3):
        landscape(im,(1090+i*96,643,1176+i*96,706),i)
    text(im,(1395,670),'共 3 张',13,MUTED)
    text(im,(1090,729),'编辑',14,GREEN);text(im,(1148,729),'删除',14,MUTED)
    line(im,[(1090,771),(1520,771)],'#e4deca')
    rr(im,(1090,793,1520,881),14,'#f1ecd9')
    landscape(im,(1102,805,1189,869),1)
    text(im,(1207,805),'雨后的一碗热面',19,INK)
    text(im,(1208,841),'2024.10.03 · 2 张图片',13,MUTED)
    text(im,(1497,834),'›',26,MUTED,anchor='mm')
    save(im,'02-city-detail.png')

def field(im, y, label, value, placeholder=False, h=48):
    text(im,(1114,y),label,15,INK)
    rr(im,(1110,y+30,1520,y+30+h),12,'#fffbef','#dedfc8')
    text(im,(1127,y+43),value,16,MUTED if placeholder else INK)

def add_record():
    im=background()
    text(im,(50,145),'再点亮一个，和你走过的地方。',32,INK)
    text(im,(52,197),'选择城市后，会在沙盘上预览位置。',17,MUTED)
    draw_map(im,ox=510,oy=563,scale=12.4,selected='成都')
    controls(im,505)
    panel=(1078,139,1550,922)
    shadow(im,panel);rr(im,panel,25,'#fbf6e7','#fffbee')
    text(im,(1111,168),'记录一次同行',29,INK)
    icon(im,'close',1509,170,MUTED)
    text(im,(1113,214),'地点和日期必填，图片与文字可以稍后补充。',13,MUTED)
    field(im,252,'地点','四川 · 成都')
    icon(im,'search',1485,297,MUTED)
    text(im,(1113,338),'输入城市名后，从列表中选择准确城市。',12,MUTED)
    field(im,373,'日期','2026-10-31')
    field(im,469,'这次同行的名字（选填）','例如：在成都，慢慢走。',True)
    text(im,(1114,580),'图片（可多选）',15,INK)
    rr(im,(1110,611,1520,710),14,'#f2eddb','#d4dbc3')
    icon(im,'photo',1298,628,GREEN,25)
    text(im,(1315,672),'点击添加照片 · 支持多张',14,MUTED,anchor='mm')
    text(im,(1114,728),'想记住的话（选填）',15,INK)
    rr(im,(1110,759,1520,837),12,'#fffbef','#dedfc8')
    text(im,(1126,773),'写下这一天，让画面有了声音。',15,MUTED)
    button(im,(1110,857,1520,901),'保存，点亮这个城市',True)
    save(im,'03-add-record.png')

def save(im, name):
    im.convert('RGB').resize((W,H),Image.Resampling.LANCZOS).save(OUT/name)
    print(OUT/name)

if __name__ == '__main__':
    homepage();details();add_record()
