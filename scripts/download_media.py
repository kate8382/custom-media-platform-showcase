#!/usr/bin/env python3
import re,os,sys,urllib.request,urllib.error
html='frontend/documentation/legacy/Webpage-Complete.html'
root='frontend'
dest_audio=os.path.join(root,'src','assets','audio')
dest_video=os.path.join(root,'src','assets','video')
for d in (dest_audio,dest_video):
    os.makedirs(d,exist_ok=True)
with open(html,'r',encoding='utf-8',errors='ignore') as fh:
    s=fh.read()
pattern=re.compile(r'https?://[^\s"\'\<>]+?\.(?:mp3|wav|ogg|m4a|aac|flac|mp4|webm|mov|mkv)(?:\?[^"\']*)?', re.I)
urls=[m.group(0) for m in pattern.finditer(s)]
urls=sorted(dict.fromkeys(urls))
print('Found',len(urls),'remote media URLs')
for u in urls:
    print('-->',u)

copied=0;failed=0
for u in urls:
    try:
        fn=os.path.basename(urllib.request.urlparse(u).path)
        if not fn:
            print('SKIP (no filename):',u)
            failed+=1
            continue
        ext=fn.split('.')[-1].lower()
        if ext in ('mp4','webm','mov','mkv'):
            dst=os.path.join(dest_video,fn)
        else:
            dst=os.path.join(dest_audio,fn)
        if os.path.exists(dst):
            print('SKIP exists',dst)
            copied+=1
            continue
        print('Downloading ->',dst)
        req=urllib.request.Request(u, headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=30) as r, open(dst,'wb') as f:
            f.write(r.read())
        print('OK')
        copied+=1
    except Exception as e:
        print('FAILED:',e)
        failed+=1

print('\nSummary: downloaded=%d failed=%d' % (copied, failed))
