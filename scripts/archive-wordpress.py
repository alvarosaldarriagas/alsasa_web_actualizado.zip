#!/usr/bin/env python3
"""Archive already-reviewed public WordPress content without changing the source.

Requires beautifulsoup4 and bleach. Input JSON is obtained through WordPress's
public API and the existing approvedPosts/mediaGallery helpers. No CRM credentials
or private property fields are included in the generated files.
"""
import argparse
import concurrent.futures
import hashlib
import html
import json
from pathlib import Path
import urllib.parse
import urllib.request

import bleach
from bs4 import BeautifulSoup

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--reviewed-properties', required=True)
    parser.add_argument('--posts', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    output = Path(args.output)
    properties = json.loads(Path(args.reviewed_properties).read_text())
    posts = json.loads(Path(args.posts).read_text())
    hosts = {'alsasa.co', 'www.alsasa.co', 'admin.alsasa.co'}

    def source(value):
        u = urllib.parse.urlsplit(value)
        if (u.scheme not in {'http', 'https'} or u.hostname not in hosts or
            u.username or u.password or u.port or not u.path.startswith('/wp-content/uploads/') or
            Path(u.path).suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'}):
            raise ValueError('Unapproved image source')
        return urllib.parse.urlunsplit(('https', 'admin.alsasa.co', u.path, '', ''))

    sources = set()
    for prop in properties:
        sources.update(source(u) for u in prop['gallery'])
    for post in posts:
        hero = post.get('yoast_head_json', {}).get('og_image', [{}])[0].get('url')
        if not hero:
            hero = post.get('_embedded', {}).get('wp:featuredmedia', [{}])[0].get('source_url')
        post['_archive_hero'] = source(hero) if hero else ''
        if hero:
            sources.add(source(hero))
        soup = BeautifulSoup(post['content']['rendered'], 'html.parser')
        for img in soup.find_all('img'):
            sources.add(source(img.get('src', '')))

    asset_dir = output / 'public' / 'media' / 'wordpress'
    asset_dir.mkdir(parents=True, exist_ok=True)
    def download(url):
        suffix = Path(urllib.parse.urlsplit(url).path).suffix.lower()
        name = hashlib.sha256(url.encode()).hexdigest()[:24] + suffix
        path = asset_dir / name
        if path.exists():
            data = path.read_bytes()
        else:
            with urllib.request.urlopen(url, timeout=45) as response:
                if urllib.parse.urlsplit(response.url).hostname not in hosts:
                    raise ValueError('Unexpected image redirect')
                if not response.headers.get('Content-Type', '').startswith('image/'):
                    raise ValueError('Image response is not an image')
                data = response.read(20 * 1024 * 1024 + 1)
                if not data or len(data) > 20 * 1024 * 1024:
                    raise ValueError('Unexpected image size')
            path.write_bytes(data)
        return {'source': url, 'path': '/media/wordpress/' + name,
                'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}

    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        assets = list(pool.map(download, sorted(sources)))
    mapping = {item['source']: item['path'] for item in assets}
    result_properties = []
    photo_updates = {}
    for prop in properties:
        gallery = [mapping[source(u)] for u in prop['gallery']]
        if prop['public']:
            record = dict(prop['public'])
            record.update(gallery=gallery, image=gallery[0] if gallery else '', source='archive')
            result_properties.append(record)
        elif prop['code'] == 'A1149':
            price_lines = [line for line in prop['text'] if line.startswith(('Valor:', 'Precio:'))]
            if len(price_lines) != 1:
                raise ValueError('A1149 price must be unambiguous')
            price = int(''.join(c for c in price_lines[0] if c.isdigit()))
            photo_updates['A1149'] = {'gallery': gallery, 'price': price, 'wordpressId': prop['wordpressId']}

    slugs = {post['slug'] for post in posts}
    clean_posts = []
    for post in posts:
        soup = BeautifulSoup(post['content']['rendered'], 'html.parser')
        for node in soup.find_all(['script', 'style', 'iframe', 'form', 'object', 'embed']):
            node.decompose()
        for img in soup.find_all('img'):
            img['src'] = mapping[source(img['src'])]
            img.attrs = {k: v for k, v in img.attrs.items() if k in {'src', 'alt', 'width', 'height'}}
        for a in soup.find_all('a', href=True):
            url = urllib.parse.urlsplit(a['href'])
            if url.hostname in hosts:
                slug = url.path.strip('/')
                a['href'] = '/blog/' + slug if slug in slugs else (url.path or '/') + ('#' + url.fragment if url.fragment else '')
        content = bleach.clean(str(soup),
            tags={'p','br','h2','h3','h4','h5','h6','ul','ol','li','strong','em','b','i','a','blockquote','figure','figcaption','img','table','thead','tbody','tr','th','td','div','span','hr'},
            attributes={'a':['href','title'], 'img':['src','alt','width','height']},
            protocols={'http','https','mailto','tel'}, strip=True)
        excerpt = BeautifulSoup(post.get('excerpt', {}).get('rendered', ''), 'html.parser').get_text(' ', strip=True)
        clean_posts.append({'id': post['id'], 'slug': post['slug'],
            'title': html.unescape(BeautifulSoup(post['title']['rendered'], 'html.parser').get_text()),
            'excerpt': excerpt[:150].rstrip() + ('…' if len(excerpt) > 150 else ''),
            'content': content, 'image': mapping.get(post['_archive_hero'], ''),
            'publishedAt': post.get('date_gmt', post['date']) + 'Z'})

    result = {'capturedAt': '2026-09-30', 'properties': result_properties,
              'propertyUpdates': photo_updates, 'posts': clean_posts}
    (output / 'data').mkdir(exist_ok=True)
    (output / 'data' / 'wordpress-archive.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    (output / 'docs').mkdir(exist_ok=True)
    (output / 'docs' / 'wordpress-assets-manifest.json').write_text(json.dumps(assets, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'properties': len(result_properties), 'propertyUpdates': list(photo_updates),
                     'posts': len(clean_posts), 'assets': len(assets), 'bytes': sum(a['bytes'] for a in assets)}))

if __name__ == '__main__':
    main()
