"""Produce an isolated preview of the existing app, with staging endpoints only.
Serve the output on localhost:8729 (allowed by existing staging APIs).
Never publish this artifact over production Pages.
"""
from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[2]
out=root/'ai/qa/artifacts/staging'
out.mkdir(parents=True,exist_ok=True)
production='wjelumpbjklfrdjxbesj.supabase.co'
staging='zgwxzfvvpqgdedyobwmg.supabase.co'
extensions={'.html','.js','.css','.json','.webmanifest','.png','.jpg','.jpeg','.svg','.ico','.woff','.woff2'}
for p in root.iterdir():
 if p.is_file() and p.suffix in extensions:
  target=out/p.name
  if p.suffix in {'.html','.js','.css','.json','.webmanifest','.svg'}:
   target.write_text(p.read_text(encoding='utf-8').replace(production,staging).replace('https://enlsafety.github.io','http://127.0.0.1:8729'),encoding='utf-8')
  else:shutil.copy2(p,target)
for name in ['icons','assets']:
 if (root/name).is_dir():shutil.copytree(root/name,out/name,dirs_exist_ok=True)
# Keep the normal app entry and PWA stack; use a dedicated preview origin/profile.
assert production not in (out/'auth-v411.js').read_text(encoding='utf-8')
assert staging in (out/'ai-safety-team-v440.js').read_text(encoding='utf-8')
print('Staging preview:',out)

