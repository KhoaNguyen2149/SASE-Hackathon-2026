"""Fetch attributed, freely licensed Wikimedia images for OSM Wikidata references.
Only structured public APIs are queried. No venue website photos are copied.
"""
import json, time, urllib.parse, urllib.request, hashlib, math
from pathlib import Path
AGENT='DeskHop-Catalog/0.2 (+https://github.com/KhoaNguyen2149/SASE-Hackathon-2027)'
def api(host, params):
    url='https://'+host+'/w/api.php?'+urllib.parse.urlencode({'format':'json',**params})
    cache=Path('data/imports')/(hashlib.sha256(url.encode()).hexdigest()+'.json')
    if cache.exists(): return json.loads(cache.read_text(encoding='utf8'))
    request=urllib.request.Request(url,headers={'User-Agent':AGENT})
    with urllib.request.urlopen(request,timeout=40) as response: result=json.load(response)
    cache.write_text(json.dumps(result),encoding="utf8")
    time.sleep(1)
    return result
path=Path('src/data/colorado.json')
data=json.loads(path.read_text(encoding='utf8'))
ids=sorted({v['wikidata'] for v in data['venues'] if v['wikidata'].startswith('Q') and v['wikidata'][1:].isdigit()})
files={}
coordinates={}
for offset in range(0,len(ids),40):
    result=api('www.wikidata.org',{'action':'wbgetentities','ids':'|'.join(ids[offset:offset+40]),'props':'claims'})
    for key,entity in result.get('entities',{}).items():
        geo=entity.get('claims',{}).get('P625',[])
        if geo:
            value=geo[0].get('mainsnak',{}).get('datavalue',{}).get('value',{})
            if isinstance(value,dict) and 'latitude' in value: coordinates[key]=(value['latitude'],value['longitude'])
        claims=entity.get('claims',{}).get('P18',[])
        if claims:
            value=claims[0].get('mainsnak',{}).get('datavalue',{}).get('value')
            if isinstance(value,str): files[key]='File:'+value
names=sorted(set(files.values())|{v['commons'] for v in data['venues'] if v['commons'].startswith('File:')})
photos={}
for offset in range(0,len(names),35):
    result=api('commons.wikimedia.org',{'action':'query','titles':'|'.join(names[offset:offset+35]),'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':'900'})
    for page in result.get('query',{}).get('pages',{}).values():
        info=page.get('imageinfo',[{}])[0]; meta=info.get('extmetadata',{})
        license=meta.get('LicenseShortName',{}).get('value','')
        if not license.startswith(('CC BY','CC0','Public domain')):continue
        url=info.get('thumburl','')
        if not url.startswith(('https://upload.wikimedia.org/','https://thumb.wikimedia.org/')):continue
        # Convert metadata markup to text; never inject supplier HTML into the UI.
        from html.parser import HTMLParser
        class Text(HTMLParser):
            def __init__(self): super().__init__(); self.value=''
            def handle_data(self,value): self.value+=value
        author=Text();author.feed(meta.get('Artist',{}).get('value','Wikimedia contributor'))
        photos[page['title']]={'url':url,'source':info.get('descriptionurl',''),'credit':author.value[:240]+' · '+license,'license':license}
count=0
for v in data['venues']:v.pop('photo',None)
for venue in data['venues']:
    title=venue['commons'] if venue['commons'].startswith('File:') else files.get(venue['wikidata'],'')
    if any(word in title.lower() for word in ['massacre','nara -','1920','1874','abbey']): continue
    geo=coordinates.get(venue['wikidata'])
    if not venue['commons'].startswith('File:') and (not geo or abs(geo[0]-venue['lat'])>0.1 or abs(geo[1]-venue['lng'])>0.15):continue
    photo=photos.get(title.replace("_"," "))
    venue.pop('photo',None)
    if photo:venue['photo']=photo;count+=1
path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
print(json.dumps({'licensed_photos':count,'wikidata_records':len(ids),'image_claims':len(files),'licensed_files':len(photos)}))
