#!/usr/bin/env python3
import re,os,sys,urllib.request,urllib.error,urllib.parse

if len(sys.argv)<2:
    print('Usage: download_media_url.py <URL>')
    sys.exit(1)
url=sys.argv[1]
root='frontend'
dest_audio=os.path.join(root,'src','assets','audio')
dest_video=os.path.join(root,'src','assets','video')
for d in (dest_audio,dest_video):
    os.makedirs(d,exist_ok=True)

print('Fetching',url)
req=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        s=r.read().decode('utf-8',errors='ignore')
except Exception as e:
    print('Failed to fetch URL:',e)
    sys.exit(2)

pattern=re.compile(r'https?://[^"]+?\.(?:mp4|webm|mov|mkv|mp3|wav|ogg|m4a|aac|flac)(?:\?[^\"\']*)?|[\w\-\./]+?\.(?:mp4|webm|mov|mkv|mp3|wav|ogg|m4a|aac|flac)(?:\?[^\"\']*)?', re.I)
urls=[]
for m in pattern.finditer(s):
    u=m.group(0)
    # resolve relative
    if not urllib.parse.urlparse(u).netloc:
        u=urllib.parse.urljoin(url,u)
    urls.append(u)
urls=sorted(dict.fromkeys(urls))
print('Found',len(urls),'media URLs')
for u in urls:
    print('-->',u)

copied=0;failed=0
for u in urls:
    try:
        fn=os.path.basename(urllib.parse.urlparse(u).path)
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
        with urllib.request.urlopen(req, timeout=60) as r, open(dst,'wb') as f:
            f.write(r.read())
        print('OK')
        copied+=1
    except Exception as e:
        print('FAILED:',e)
        failed+=1

print('\nSummary: downloaded=%d failed=%d' % (copied, failed))
