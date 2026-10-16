"""Check actual Calc print output in CI; this is not an Office 2019 execution test."""
import pathlib,re,subprocess,json
root=pathlib.Path('qa-output/render')
out=[]
for stem in ['final-excel-short-chromium','final-excel-chromium']:
 path=root/(stem+'.pdf')
 info=subprocess.check_output(['pdfinfo',str(path)],text=True)
 pages=int(re.search(r'Pages:\s+(\d+)',info).group(1))
 assert 'A4' in info,info
 if 'short' in stem:assert pages==1,f'Short A-E report printed on {pages} pages'
 else:assert pages>3,'Long report must span multiple A4 pages plus attachments'
 text=subprocess.check_output(['pdftotext','-layout',str(path),'-'],text=True)
 for token in ['A.','B.','C.','D.','E.','QA']:
  assert token in text,(stem,token)
 if 'short' not in stem:assert '35' in text,'last long-content row survives printing'
 out.append({'file':path.name,'pages':pages,'A4':True})
root.joinpath('print-validation.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
print('PASS actual LibreOffice A4 print:',json.dumps(out,ensure_ascii=False))
