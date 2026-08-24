#!/usr/bin/env python3
import sys,urllib.request,re
if len(sys.argv)<2:
    print('Usage: check_embeds.py <URL>')
    sys.exit(1)
url=sys.argv[1]
req=urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        s=r.read().decode('utf-8',errors='ignore')
except Exception as e:
    print('FETCH_FAILED',e)
    sys.exit(2)
pattern=re.compile(r'https?://(?:www\.)?(?:youtube\.com|youtu\.be|vimeo\.com)[^"\s<]+', re.I)
found=list(dict.fromkeys(m.group(0) for m in pattern.finditer(s)))
print('FOUND',len(found),'embeds')
for u in found:
    print(u)
