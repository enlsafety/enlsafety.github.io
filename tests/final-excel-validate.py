import pathlib,zipfile,xml.etree.ElementTree as ET,json,openpyxl
out=[]
for path in pathlib.Path('qa-output').glob('final-excel-*.xlsx'):
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None
  names=z.namelist();assert all(n in names for n in ['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/styles.xml','xl/sharedStrings.xml'])
  for n in names:
   if n.endswith(('.xml','.rels')):ET.fromstring(z.read(n))
  assert any(n.startswith('xl/drawings/drawing') for n in names)
  assert len([n for n in names if n.startswith('xl/media/')])>=2,'image plus PDF rendered page'
  assert not any('vba' in n.lower() for n in names)
  xml=''.join(z.read(n).decode() for n in names if n.endswith('.xml'))
  assert '미리보기를 만들지 못했습니다' not in xml
  assert 'extLst' not in xml,'no Office-version extension requirements'
 w=openpyxl.load_workbook(path)
 assert w.sheetnames[0]=='사고경위서' and '사고조치보고서' in w.sheetnames,w.sheetnames
 assert len(w.sheetnames)>=4
 values=[str(c.value) for s in w for row in s for c in row if c.value is not None];text='\n'.join(values)
 for token in ['정정된 가상 사고경위','긴 문장 검증 35','계속','동선 분리 계획','가상 표지 설치 완료','계획 작성자','조치 시행일','조치 담당자','가상PDF증빙.pdf','ERP 기안서 정정','QA-ERP-1']:
  assert token in text,token
 cost=[s.cell(r,2) for s in w for r in range(1,s.max_row+1) if s.cell(r,1).value=='복구 예상 비용'];assert cost and cost[0].value==12000 and cost[0].data_type=='n' and '원' in cost[0].number_format
 for s in w:
  assert s.print_area,s.title
  assert str(s.page_setup.paperSize)=='9'
  assert s.page_setup.orientation in ['portrait','landscape']
  assert s.page_setup.fitToWidth==1
  assert s.sheet_properties.pageSetUpPr.fitToPage
  assert s.page_margins.left>0 and s.page_margins.right>0
  assert list(s.merged_cells.ranges)
  assert s.column_dimensions['A'].width>0 and s.column_dimensions['B'].width>0
  for row in s:
   for c in row:
    if c.value is not None:assert c.font.name and c.font.sz>=9
  assert all(d.height is None or d.height<=210 for d in s.row_dimensions.values())
 assert any(c.alignment.wrap_text and c.border.left.style for s in w for row in s for c in row if c.value)
 out.append({'file':str(path),'sheets':w.sheetnames,'images':sum(len(s._images) for s in w),'validated':True})
assert len(out)==2,'both browser engines'
pathlib.Path('qa-output/final-excel-validation.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print('PASS OOXML/openpyxl both browsers:',json.dumps(out,ensure_ascii=False))
