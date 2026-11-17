"""Read the supplied XLSX templates without rewriting their source files."""
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as E
import json,hashlib,sys
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
books=[]
keys=['course','landscape','sprinkler','pest','office']
for key,p in zip(keys,sorted(Path(sys.argv[1]).glob('*.xlsx'))):
 with ZipFile(p) as z:
  strings=[''.join(t.text or '' for t in si.findall('.//s:t',ns)) for si in E.fromstring(z.read('xl/sharedStrings.xml'))] if 'xl/sharedStrings.xml' in z.namelist() else []
  workbook=E.fromstring(z.read('xl/workbook.xml'))
  rels={r.get('Id'):r.get('Target') for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
  b={'id':key,'name':p.stem.split('_')[1],'source':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sections':[],'improvements':[]}
  for sheet in workbook.find('s:sheets',ns):
   target=rels[sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')]
   path=target.lstrip('/') if target.startswith('/') else 'xl/'+target
   root=E.fromstring(z.read(path));cells={}
   for c in root.findall('s:sheetData/s:row/s:c',ns):
    v=c.find('s:v',ns);inline=c.find('s:is',ns)
    val=v.text if v is not None else ''.join(t.text or '' for t in inline.findall('.//s:t',ns)) if inline is not None else ''
    if c.get('t')=='s':val=strings[int(val)]
    cells[c.get('r')]=val or ''
   # Only top-left cells of merged ranges are displayed by Excel.
   for m in root.findall('s:mergeCells/s:mergeCell',ns):
    a,end=m.get('ref').split(':');import re
    def coord(s):
     col,row=re.match(r'([A-Z]+)(\d+)',s).groups();n=0
     for x in col:n=n*26+ord(x)-64
     return n,int(row)
    c1,r1=coord(a);c2,r2=coord(end)
    for addr in list(cells):
     c,r=coord(addr)
     if c1<=c<=c2 and r1<=r<=r2 and addr!=a:cells.pop(addr)
   if sheet.get('name').startswith('개선전후'):
    b['improvements'].append({'name':sheet.get('name'),'labels':{a:v for a,v in cells.items() if v}})
    continue
   section={'id':sheet.get('name'),'name':cells.get('D4','').split(' / ')[-1] or sheet.get('name'),'rows':[]};process=''
   for r in range(8,200):
    if not cells.get('B'+str(r),'').isdigit():continue
    if cells.get('C'+str(r)):process=cells['C'+str(r)]
    row={'id':key+'-'+cells['B'+str(r)],'number':int(cells['B'+str(r)]),'process':process,'task':cells.get('D'+str(r),''),'hazard':cells.get('E'+str(r),''),'level':'','measure':cells.get('G'+str(r),''),'dueDate':'','doneDate':'','owner':'','excluded':False,'excludeReason':''}
    section['rows'].append(row)
   b['sections'].append(section)
  books.append(b)
Path('edge-functions/enl-incident-sync-v411/risk-templates.json').write_text(json.dumps({'version':'20261117-1','books':books},ensure_ascii=False,indent=2)+'\n')
for b in books:
 print(b['name'],[(s['name'],len(s['rows'])) for s in b['sections']], '개선전후',len(b['improvements']))
print('Improvement fields:',books[0]['improvements'][0])
