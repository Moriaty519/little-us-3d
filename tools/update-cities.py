"""Build the offline city catalogue from Aliyun DataV public boundary metadata."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen
import json

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://geo.datav.aliyun.com/areas_v3/bound/'
def fetch(code):
    with urlopen(BASE + str(code) + '_full.json', timeout=45) as response:
        return json.load(response)['features']

def entry(p, province):
    lon, lat = p.get('center') or p['centroid']
    return {'id':str(p['adcode']), 'name':p['name'], 'province':province,
            'lon':round(lon,6), 'lat':round(lat,6)}

if __name__ == '__main__':
    provinces = [f['properties'] for f in fetch(100000) if f['properties'].get('level')=='province']
    direct = {110000,120000,310000,500000,810000,820000}
    pending = [p for p in provinces if p['adcode'] not in direct | {710000}]
    cities = [entry(p,p['name']) for p in provinces if p['adcode'] in direct]
    def read_province(p):
        return [entry(f['properties'],p['name']) for f in fetch(p['adcode'])
                if f['properties'].get('name') and (f['properties'].get('center') or f['properties'].get('centroid'))]
    with ThreadPoolExecutor(max_workers=5) as pool:
        for result in pool.map(read_province,pending): cities.extend(result)
    # Common Taiwan city centres, explicitly retained as offline city entries.
    for key,name,lon,lat in [('taipei','台北市',121.5654,25.0330),('newtaipei','新北市',121.4628,25.0120),('taoyuan','桃园市',121.3010,24.9937),('taichung','台中市',120.6736,24.1477),('tainan','台南市',120.2270,22.9997),('kaohsiung','高雄市',120.3014,22.6273),('hsinchu','新竹市',120.9675,24.8138),('keelung','基隆市',121.7392,25.1276),('chiayi','嘉义市',120.4491,23.4801)]:
        cities.append({'id':'tw-'+key,'name':name,'province':'台湾省','lon':lon,'lat':lat})
    cities = sorted({c['id']:c for c in cities}.values(),key=lambda c:(c['province'],c['id']))
    source = '// Offline city centres: Aliyun DataV boundary metadata; Taiwan city entries are explicitly curated.\n'
    source += 'export const CHINA_CITIES=' + json.dumps(cities,ensure_ascii=False,separators=(',',':')) + ';\n'
    (ROOT/'src/cities.js').write_text(source)
    print(f'Saved {len(cities)} offline city entries.')
