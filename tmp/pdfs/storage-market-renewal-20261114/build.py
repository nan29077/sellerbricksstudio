from argparse import ArgumentParser
from functools import lru_cache
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageOps
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

from copybook import BOOKS


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PUB = ROOT / 'public'
CREATED = Path('C:/Users/Jeon/.codex/generated_images/01a1d85b-70d9-7381-a4d4-ed878054e485')
PHOTOS = {
    'brand': CREATED / 'exec-6d579ba5-4bf2-4735-9d9c-c52c121b27ee.png',
    'seller': CREATED / 'exec-cab89181-0c88-4607-8914-a40b8f37d308.png',
}
W, H = A4
M = 44
CW = W - 2*M
NAVY, SOFT_NAVY, GOLD = '#1A1A2E', '#292940', '#F5A623'
INK, MUTED, LIGHT = '#242439', '#47495B', '#E4E1EB'
PAPER, WHITE, TINT, LINE, BRONZE = '#FAF7F0', '#FFFFFF', '#FFF1D7', '#E4DCCF', '#774B15'
REG, BOLD, EN = 'KR', 'KR-Bold', 'EN-Bold'
PHONE = '070-4158-2540'
for family, name in [(REG, 'malgun.ttf'), (BOLD, 'malgunbd.ttf'), (EN, 'arialbd.ttf')]:
    pdfmetrics.registerFont(TTFont(family, 'C:/Windows/Fonts/' + name))


def width(text, size, font):
    return pdfmetrics.stringWidth(text, font, size)


def wrap(text, space, size, font):
    if space is None:
        return text.split('\n')
    result = []
    for para in text.split('\n'):
        line = ''
        for word in para.split():
            joined = f'{line} {word}' if line else word
            if width(joined, size, font) <= space:
                line = joined
                continue
            if line:
                result.append(line)
            assert width(word, size, font) <= space, word
            line = word
        result.append(line)
    return result


@lru_cache(maxsize=48)
def fitted(path, w, h, cy):
    with Image.open(path) as im:
        photo = ImageOps.fit(im.convert('RGB'), (w, h), Image.Resampling.LANCZOS, centering=(0.5, cy))
    data = BytesIO()
    photo.save(data, 'JPEG', quality=91, optimize=True)
    return ImageReader(data)


class Brochure:
    def __init__(self, spec, out_dir, site_url):
        self.spec = spec
        self.site_url = site_url
        self.count = len(spec['sections'])+1
        self.c = canvas.Canvas(str(out_dir/spec['file']), pagesize=A4, pageCompression=1)
        self.c.setTitle('스토리지마켓 ' + spec['audience'] + ' 서비스 소개서')
        self.c.setAuthor('스토리지마켓')
        self.c.setSubject('브랜드 상품과 방송 공간을 잇는 라이브 커머스')
        self.c.setViewerPreference('DisplayDocTitle', 'true')

    def rect(self, x, y, w, h, fill, border=None, radius=0):
        self.c.setFillColor(HexColor(fill))
        if border:
            self.c.setStrokeColor(HexColor(border))
            self.c.setLineWidth(.7)
        if radius:
            self.c.roundRect(x, H-y-h, w, h, radius, fill=1, stroke=bool(border))
        else:
            self.c.rect(x, H-y-h, w, h, fill=1, stroke=bool(border))

    def rule(self, y, dark=False):
        self.c.setStrokeColor(HexColor('#514D64' if dark else LINE))
        self.c.setLineWidth(.7)
        self.c.line(M, H-y, W-M, H-y)

    def txt(self, value, x, y, size=12, font=REG, color=INK, space=None, leading=None):
        leading = leading or size*1.52
        self.c.setFillColor(HexColor(color))
        self.c.setFont(font, size)
        for line in wrap(value, space, size, font):
            assert x + width(line, size, font) < W+0.1, value
            self.c.drawString(x, H-y-size*.88, line)
            y += leading
        return y

    def tag(self, value, x, y, tone=BRONZE):
        self.c.saveState()
        t = self.c.beginText(x, H-y-8)
        t.setFont(EN, 8.6)
        t.setCharSpace(1.35)
        t.setFillColor(HexColor(tone))
        t.textLine(value)
        self.c.drawText(t)
        self.c.restoreState()

    def logo(self, x, y, w, dark):
        p = PUB/'images/brand'/('storage-market-logo-on-dark.png' if dark else 'storage-market-logo-on-light.png')
        h = w*246/1926
        self.c.drawImage(str(p), x, H-y-h, w, h, mask='auto')

    def photo(self, asset, x, y, w, h, cy=.5):
        path = PHOTOS[asset] if asset in PHOTOS else PUB/asset
        self.c.drawImage(fitted(path, round(w*2), round(h*2), cy), x, H-y-h, w, h)

    def footer(self, index, dark):
        self.rule(797, dark)
        self.txt('스토리지마켓  /  '+self.spec['audience'], M, 809, 8.8, BOLD, LIGHT if dark else MUTED)
        value = f'{index:02d}   /   {self.count:02d}'
        self.txt(value, W-M-width(value, 9, EN), 809, 9, EN, GOLD if dark else BRONZE)

    def contact_links(self):
        self.rule(709, True)
        phone_label = '문의하기  ' + PHONE
        phone_uri = 'tel:' + PHONE.replace('-', '')
        self.txt(phone_label, M, 723, 16, BOLD, WHITE)
        self.c.linkURL(phone_uri, (M, H-745, M+width(phone_label, 16, BOLD), H-719), thickness=0)
        if not self.site_url:
            self.txt('누르면 전화 앱에서 문의할 수 있습니다.', M, 752, 10.8, REG, LIGHT)
            return
        buttons = [
            ('스토리지마켓 바로가기', '/'),
            ('회원가입하기', '/signup/' + self.spec['key']),
            ('온라인 문의하기', '/support'),
        ]
        gap = 10
        button_width = (CW-2*gap)/3
        for i, (label, path) in enumerate(buttons):
            x = M + i*(button_width+gap)
            primary = i == 0
            self.rect(x, 751, button_width, 35, GOLD if primary else SOFT_NAVY,
                      None if primary else '#625D73', 6)
            size = 10.8
            self.txt(label, x+(button_width-width(label, size, BOLD))/2, 763,
                     size, BOLD, NAVY if primary else WHITE)
            self.c.linkURL(self.site_url+path, (x, H-786, x+button_width, H-751), thickness=0)

    def cover(self):
        p = self.spec['cover']
        self.rect(0, 0, W, H, NAVY)
        self.logo(M, 39, 200, True)
        self.rule(79, True)
        self.tag(p[0], M, 101, GOLD)
        self.txt(self.spec['audience']+' 서비스 소개서', M, 124, 11.5, BOLD, LIGHT)
        self.txt(p[1], M, 150, 37, BOLD, WHITE, CW, 46)
        self.txt(p[2], M, 258, 13.1, REG, LIGHT, CW, 21)
        self.photo(self.spec['key'], 0, 324, W, 367, .40)
        self.rect(0, 322, W, 3, GOLD)
        self.txt('서비스 연출 이미지', M, 701, 8.5, REG, LIGHT)
        sw = CW / 3
        for i,(head,sub) in enumerate(p[3]):
            x = M+i*sw
            self.txt(head, x, 739, 14.8, BOLD, GOLD, sw-12, 18)
            self.txt(sub, x, 762, 9.4, REG, LIGHT, sw-10, 14)
        self.footer(1, True)
        self.bookmark(1, '표지')
        self.c.showPage()

    def bookmark(self, n, title):
        name = f'page-{n:02d}'
        self.c.bookmarkPage(name)
        self.c.addOutlineEntry(title.replace('\n',' '), name)

    def header(self, label, title, intro, number, dark):
        self.rect(0, 0, W, H, NAVY if dark else PAPER)
        self.logo(M, 34, 151, dark)
        self.rule(65, dark)
        self.tag(label, M, 85, GOLD if dark else BRONZE)
        y = self.txt(title, M, 109, 32, BOLD, WHITE if dark else NAVY, CW, 40)
        y = self.txt(intro, M, y+12, 12.7, REG, LIGHT if dark else MUTED, CW, 20)
        self.footer(number, dark)
        return y+18

    def render_block(self, kind, content, y, dark):
        if kind == 'image':
            asset, h, cy, caption = content
            self.photo(asset, M,y,CW,h,cy)
            return self.txt(caption,M,y+h+7,8.5,REG,MUTED,CW,13)+13
        if kind == 'note':
            return self.txt(content,M,y,9.4,REG,LIGHT if dark else MUTED,CW,15)+9
        if kind == 'bar':
            head, body = content
            count = len(wrap(body,CW-44,11.4,REG))
            h = 52+17.5*count
            self.rect(M,y,CW,h,SOFT_NAVY if dark else TINT,'#514D64' if dark else None,8)
            self.rect(M+13,y+15,3,16,GOLD)
            self.txt(head,M+25,y+15,13.5,BOLD,WHITE if dark else NAVY,CW-45,20)
            self.txt(body,M+25,y+37,11.4,REG,LIGHT if dark else MUTED,CW-44,17.5)
            return y+h+14
        if kind in {'list','steps','faq'}:
            numbered = kind == 'steps'
            x = M+45 if numbered else M
            for i,(head,body) in enumerate(content,1):
                self.rule(y,dark)
                if numbered:
                    self.rect(M,y+11,28,25,GOLD if dark else TINT,None,5)
                    self.txt(f'{i:02}',M+7,y+18,10.4,EN,NAVY)
                end = self.txt(head,x,y+11,14,BOLD,WHITE if dark else NAVY,W-M-x,20)
                end = self.txt(body,x,end+4,11.7,REG,LIGHT if dark else MUTED,W-M-x,18)
                y = end + (12 if kind=='faq' else 10)
            return y+5
        if kind == 'cards':
            gap = 13
            sw = (CW-gap)/2
            for k in range(0,len(content),2):
                pair = content[k:k+2]
                h = max(57+18*len(wrap(body,sw-32,11.4,REG)) for _,body in pair)
                for i,(head,body) in enumerate(pair):
                    x = M+i*(sw+gap)
                    self.rect(x,y,sw,h,WHITE,LINE,8)
                    self.rect(x+16,y+15,19,2,GOLD)
                    heading = self.txt(head,x+16,y+26,14,BOLD,NAVY,sw-32,18)
                    assert heading <= y+45, head
                    self.txt(body,x+16,y+47,11.4,REG,MUTED,sw-32,18)
                y += h+12
            return y+5
        if kind == 'gallery':
            gap = 10
            sw = (CW-2*gap)/3
            h = max(124 + len(wrap(body,sw-22,10.6,REG))*17 for _,_,body in content)
            for i,(asset,head,body) in enumerate(content):
                x = M+i*(sw+gap)
                self.rect(x,y,sw,h,WHITE,LINE,7)
                self.photo(asset,x+1,y+1,sw-2,83,.44)
                self.txt(head,x+11,y+94,12.7,BOLD,NAVY,sw-22,17)
                self.txt(body,x+11,y+116,10.6,REG,MUTED,sw-22,17)
            return self.txt('서비스 연출 이미지', M,y+h+7,8.5,REG,MUTED)+13
        if kind == 'flow':
            sw = CW/len(content)
            self.rect(M,y,CW,74,NAVY,None,8)
            for i,(head,sub) in enumerate(content,1):
                x = M+(i-1)*sw+13
                self.txt(f'{i:02}',x,y+12,10,EN,GOLD)
                self.txt(head,x,y+29,13.2,BOLD,WHITE,sw-23,17)
                self.txt(sub,x,y+51,9.6,REG,LIGHT,sw-23,13)
            return y+90
        if kind == 'compare':
            cols = [93,(CW-93)/2,(CW-93)/2]
            for i,row in enumerate(content):
                h = max(20+17*len(wrap(cell,w-20,10.9,BOLD if (i==0 or col==0) else REG))
                        for col,(cell,w) in enumerate(zip(row,cols)))
                bg = NAVY if i==0 else WHITE if i%2 else '#F1EBE0'
                self.rect(M,y,CW,h,bg,None,5 if i==0 else 0)
                x = M
                for col,(cell,w) in enumerate(zip(row,cols)):
                    f = BOLD if i==0 or col==0 else REG
                    self.txt(cell,x+10,y+10,10.9,f,WHITE if i==0 else MUTED,w-20,17)
                    x += w
                y += h+2
            return y+12
        if kind == 'metric':
            value, head, body = content
            self.rect(M,y,CW,100,NAVY,None,8)
            self.txt(value,M+19,y+22,41,EN,GOLD)
            self.txt(head,M+178,y+22,16.5,BOLD,WHITE,CW-196,21)
            self.txt(body,M+178,y+49,11.2,REG,LIGHT,CW-196,18)
            return y+116
        raise ValueError(kind)

    def render(self):
        self.cover()
        for number, (label,title,intro,blocks) in enumerate(self.spec['sections'],2):
            dark = number == self.count
            self.bookmark(number,title)
            y = self.header(label,title,intro,number,dark)
            for kind, data in blocks:
                y = self.render_block(kind,data,y,dark)
            assert y <= (705 if dark else 800), (self.spec['key'],number,y)
            if dark:
                self.contact_links()
            print(self.spec['key'],number,round(y))
            self.c.showPage()
        self.c.save()


def parse_site_url(value):
    url = urlsplit(value)
    if (url.scheme not in {'http', 'https'} or not url.hostname
            or url.username or url.password or url.query or url.fragment):
        raise ValueError('Enter the public base URL for Storage Market.')
    return value.rstrip('/')


if __name__ == '__main__':
    parser = ArgumentParser(description='Build the Storage Market PDF brochures.')
    parser.add_argument('--out-dir', type=Path, default=HERE)
    parser.add_argument('--site-url', type=parse_site_url)
    args = parser.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    for book in BOOKS:
        Brochure(book, args.out_dir, args.site_url).render()
