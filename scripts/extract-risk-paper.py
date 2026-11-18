"""Extract display geometry from the five supplied workbooks, without changing them."""
from pathlib import Path
import sys, json, hashlib
import openpyxl
from openpyxl.utils.cell import range_boundaries, get_column_letter

books, styles = {}, []
for key, path in zip(['course', 'landscape', 'sprinkler', 'pest', 'office'], sorted(Path(sys.argv[1]).glob('*.xlsx'))):
    book = openpyxl.load_workbook(path)
    sheets = []
    for sheet in book:
        left, top, right, bottom = range_boundaries(str(sheet.print_area).split('!')[-1])
        merged, covered = {}, set()
        for merge in sheet.merged_cells.ranges:
            merged[(merge.min_row, merge.min_col)] = [merge.max_row-merge.min_row+1, merge.max_col-merge.min_col+1]
            covered.update((r,c) for r in range(merge.min_row,merge.max_row+1) for c in range(merge.min_col,merge.max_col+1) if (r,c)!=(merge.min_row,merge.min_col))
        rows = []
        for r in range(top,bottom+1):
            cells=[]
            for c in range(left,right+1):
                if (r,c) in covered: continue
                cell=sheet.cell(r,c)
                color=lambda x,default: '#'+x.rgb[-6:] if x and x.type=='rgb' and x.rgb!='00000000' else default
                cells.append(dict(address=cell.coordinate,value=cell.value if cell.value is not None else '',span=merged.get((r,c),[1,1]),
                    style=dict(backgroundColor=color(cell.fill.fgColor,'#ffffff'),color=color(cell.font.color,'#1f1f1f'),fontWeight=700 if cell.font.bold else 400,
                    textAlign=cell.alignment.horizontal or 'left',fontSize=str((cell.font.sz or 12)*4/3)+'px')))
            rows.append(dict(height=round((sheet.row_dimensions[r].height or 20)*4/3,2),cells=cells))
        sheets.append(dict(id=sheet.title,name=str(sheet['D4'].value or '').split(' / ')[-1] if not sheet.title.startswith('개선전후') else sheet.title,
            improvement=sheet.title.startswith('개선전후'),widths=[round(sheet.column_dimensions[get_column_letter(c)].width*7+5,2) for c in range(left,right+1)],rows=rows))
    books[key]=dict(source=path.name,sha256=hashlib.sha256(path.read_bytes()).hexdigest(),sheets=sheets)
for book in books.values():
    for sheet in book['sheets']:
        for row in sheet['rows']:
            for cell in row['cells']:
                style=cell['style']
                if style not in styles: styles.append(style)
                cell['style']=styles.index(style)
Path('risk-paper-templates.js').write_text('/* Generated from supplied XLSX print areas. See scripts/extract-risk-paper.py. */\nwindow.ENLRiskPaperStyles='+json.dumps(styles,separators=(',',':'))+';\nwindow.ENLRiskPaperTemplates='+json.dumps(books,ensure_ascii=False,separators=(',',':'))+';\n')
print({key:len(book['sheets']) for key,book in books.items()})
