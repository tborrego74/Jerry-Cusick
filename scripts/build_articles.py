#!/usr/bin/env python3
"""Builds the guide pages (/<slug>/index.html) from scripts/articles.json.
The articles were carried over word for word from the previous WordPress site so every old URL keeps working."""
import json, re, html, os
from bs4 import BeautifulSoup

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://jerrycusick.com'
posts = json.load(open(os.path.join(ROOT, 'scripts', 'articles.json'), encoding='utf-8'))

ORDER = ['va-home-loans-colorado', 'va-loans-colorado-springs', 'va-funding-fee-colorado', 'va-certificate-of-eligibility-colorado',
         'colorado-disabled-veteran-property-tax-exemption', 'va-loans-colorado-faq', 'dscr-loans-colorado', 'dscr-loan-requirements-colorado',
         'dscr-short-term-rental-colorado-mountain-towns', 'dscr-loans-colorado-faq', 'good-neighbor-next-door-colorado']
by = {p['slug']: p for p in posts}
def group(slug): return 'VA loans' if slug.startswith('va-') or 'veteran' in slug else 'DSCR loans' if slug.startswith('dscr') else 'Good Neighbor Next Door'

CSS = """
:root{--night:#12211e;--ink:#16241f;--paper:#f3f2ee;--dawn:#c8472b;--gold:#f2c14e;--spruce:#2c5a4c;--muted:#4c5a55;--line:#cfd3cc;
  --display:'Barlow Condensed','Arial Narrow',Impact,sans-serif;--ui:'Barlow','Helvetica Neue',Arial,sans-serif;--body:'Source Serif 4',Georgia,serif}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font:400 18px/1.65 var(--body);-webkit-font-smoothing:antialiased}
a{color:var(--dawn)}
header.top{position:sticky;top:0;z-index:20;min-height:60px;display:flex;align-items:center;gap:20px;padding:8px 20px;background:rgba(243,242,238,.96);backdrop-filter:blur(10px);border-bottom:1px solid var(--line);font-family:var(--ui)}
.brand{font:700 24px var(--display);text-transform:uppercase;letter-spacing:.03em;text-decoration:none;color:var(--ink);white-space:nowrap}
.brand small{font:500 12px var(--ui);color:var(--muted);margin-left:8px;letter-spacing:0}
header nav{display:flex;gap:22px;margin-left:auto;font-size:15px;font-weight:500}
header nav a{text-decoration:none;color:var(--ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;font:700 16px var(--ui);padding:13px 22px;border-radius:3px;background:var(--ink);color:#fff;text-decoration:none;border:0}
.btn.gold{background:var(--gold);color:var(--ink)}
.btn.line{background:transparent;color:#fff;box-shadow:inset 0 0 0 2px #fff}
.btn.sm{padding:9px 16px;font-size:14px}
.hero{background:var(--night);color:#fff;padding:56px 20px 48px}
.hero div,main,.cta div,footer div{max-width:780px;margin:0 auto}
.crumb{font:600 13px var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--gold)}
.crumb a{color:inherit;text-decoration:none}
h1{font:700 clamp(36px,6vw,60px)/1 var(--display);text-transform:uppercase;margin:14px 0 0;text-wrap:balance}
.by{font:500 14.5px var(--ui);color:#c5d2cc;margin-top:18px}
main{padding:44px 20px 24px}
main h2{font:700 32px/1.05 var(--display);text-transform:uppercase;color:var(--spruce);margin:48px 0 0;text-wrap:balance}
main h3{font:700 19px/1.3 var(--ui);margin:30px 0 0}
main p,main ul,main ol{margin:16px 0 0}
main li{margin-top:8px}
.tbl{overflow-x:auto;margin-top:20px}
table{border-collapse:collapse;width:100%;font:500 15.5px/1.45 var(--ui);min-width:520px}
th,td{text-align:left;vertical-align:top;padding:10px 12px;border:1px solid var(--line)}
th{background:var(--night);color:#fff;font-weight:700}
tr:nth-child(even) td{background:#fff}
.qa{border-top:1px solid var(--line);padding:18px 0 4px;margin-top:18px}
.qa strong{display:block;font:700 19px/1.3 var(--ui)}
.qa p{margin-top:8px}
.more{margin-top:56px;padding-top:28px;border-top:2px solid var(--ink);font-family:var(--ui)}
.more b{font:700 14px var(--ui);letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.more ul{list-style:none;padding:0;margin:12px 0 0}
.more li{margin-top:8px;font-weight:600;font-size:16px}
.cta{background:var(--night);color:#fff;padding:56px 20px;margin-top:56px}
.cta h2{font:700 clamp(34px,5vw,52px)/1 var(--display);text-transform:uppercase;margin:0}
.cta p{color:#c5d2cc;margin:14px 0 0;max-width:34em}
.cta .row{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px}
footer{background:#0b1614;color:#aab3ad;font:13.5px/1.6 var(--ui);padding:36px 20px}
footer p{margin:0 0 12px}
footer a{color:#fff}
footer b{color:#fff}
@media (max-width:760px){header nav{display:none}header.top .btn{margin-left:auto}.brand small{display:none}body{font-size:17px}}
"""

def clean(content):
    s = BeautifulSoup(content, 'html.parser')
    for fig in s.find_all('figure'):
        if fig.find('img'): fig.decompose()                      # images are restored in a later pass
        elif fig.find('table'):
            fig.name = 'div'; fig.attrs = {'class': 'tbl'}
    for img in s.find_all('img'): img.decompose()
    for t in s.find_all('table'):
        if not (t.parent and t.parent.get('class') == ['tbl']): t.wrap(s.new_tag('div', attrs={'class': 'tbl'}))
    for sec in s.select('.schema-faq-section'):
        sec.attrs = {'class': 'qa', 'id': sec.get('id', '')}
    for wrap in s.select('.schema-faq'): wrap.unwrap()
    for el in s.find_all(True):
        if el.name == 'a':
            href = el.get('href', '')
            href = re.sub(r'^https?://(www\.)?jerrycusick\.com', '', href) or '/'
            if href.rstrip('/') == '/contact': href = '/#start'
            if href.rstrip('/') == '/loan-options': href = '/#paths'
            if href.rstrip('/') == '/about-us': href = '/#jerry'
            el.attrs = {'href': href}
            if href.startswith('http'): el['rel'] = 'noopener'
        elif el.get('class') in (['qa'], ['tbl']): pass
        else: el.attrs = {}
    out = str(s)
    return re.sub(r'\n{3,}', '\n\n', out).strip()

def text(h): return ' '.join(BeautifulSoup(h or '', 'html.parser').get_text(' ').split())

for slug in ORDER:
    p = by[slug]
    title = html.unescape(p['title'])
    desc = p.get('seoDesc') or text(p['excerpt'])[:155]
    seo = re.sub(r'\s*[–|-]\s*Jerry Cusick.*$', '', html.unescape(p.get('seoTitle') or title))
    seo = (seo if len(seo) <= 52 or seo.startswith('Frequently') else seo.split(':')[0]) + ' | Jerry Cusick'
    url = f'{SITE}/{slug}/'
    body = clean(p['content'])
    qs = [n for n in (p.get('schema') or {}).get('@graph', []) if n.get('@type') == 'Question']
    graph = [{"@type": "Article", "headline": title, "description": desc, "datePublished": p['date'], "dateModified": p['modified'],
              "mainEntityOfPage": url, "author": {"@type": "Person", "name": "Jerry Cusick", "url": SITE + "/#jerry"},
              "publisher": {"@type": "Organization", "name": "Jerry Cusick, Mortgage Loan Officer, NMLS #649445", "url": SITE + "/"}},
             {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
                                                             {"@type": "ListItem", "position": 2, "name": title, "item": url}]}]
    if qs:
        graph.append({"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q['name'], "acceptedAnswer": {"@type": "Answer", "text": text(q['acceptedAnswer']['text'])}} for q in qs]})
    ld = json.dumps({"@context": "https://schema.org", "@graph": graph}, ensure_ascii=False).replace('</', '<\\/')
    related = [s for s in ORDER if s != slug and group(s) == group(slug)]
    rel = ''.join(f'<li><a href="/{s}/">{html.escape(html.unescape(by[s]["title"]))}</a></li>' for s in related)
    more = f'<div class="more"><b>More on {group(slug)}</b><ul>{rel}</ul></div>' if rel else ''
    e = html.escape
    page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(seo)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
<meta property="og:type" content="article">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/img/share.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
<script type="application/ld+json">{ld}</script>
<style>{CSS}</style>
<script src="/js/clarity.js" defer></script>
<script src="/js/track.js" defer></script>
</head>
<body>
<header class="top">
  <a class="brand" href="/">Jerry Cusick<small>Colorado mortgage broker · NMLS #649445</small></a>
  <nav aria-label="Main"><a href="/#journey">The journey</a><a href="/#paths">Loan paths</a><a href="/#proof">Reviews</a><a href="/#jerry">Meet Jerry</a></nav>
  <a class="btn sm" href="/#start">Start my plan</a>
</header>
<div class="hero"><div>
  <p class="crumb"><a href="/">Home</a> · <a href="/#paths">{group(slug)}</a></p>
  <h1>{e(title)}</h1>
  <p class="by">By Jerry Cusick, Mortgage Loan Officer, NMLS #649445</p>
</div></div>
<main>
{body}

</main>
<section class="cta"><div>
  <h2>Talk it through with Jerry.</h2>
  <p>Every situation is different. Tell Jerry where you are and he will map the next step with you personally.</p>
  <div class="row"><a class="btn gold" href="/#start">Have Jerry reach out</a><a class="btn line" href="tel:+17204001407">Call or text (720) 400-1407</a><a class="btn line" href="/#s2">Estimate my payment</a></div>
</div></section>
<footer><div>
  <p><b>Jerry Cusick</b>, Mortgage Loan Officer, NMLS #649445. Powered by IMB (Independent Mortgage Brokers), NMLS #2191655. 6825 E Tennessee Ave. Suite 415, Denver, CO 80224. (720) 400-1407. Equal Housing Opportunity.</p>
  <p>Verify licensing at <a href="https://www.nmlsconsumeraccess.org/" rel="noopener">NMLS Consumer Access</a>. This is not a commitment to lend. All loans are subject to credit approval, underwriting guidelines and program availability. Programs, rates and terms can change without notice. VA and HUD programs are subject to eligibility; this site is not affiliated with or endorsed by the Department of Veterans Affairs, HUD or any government agency.</p>
  <p><a href="/privacy-policy/">Privacy policy</a> · Created by <a href="https://borregobusinesssystems.com/" rel="noopener">Borrego Business Systems</a></p>
</div></footer>
</body>
</html>
"""
    os.makedirs(os.path.join(ROOT, slug), exist_ok=True)
    open(os.path.join(ROOT, slug, 'index.html'), 'w', encoding='utf-8').write(page)
    print(slug, len(body), 'faq', len(qs), '|', seo)
