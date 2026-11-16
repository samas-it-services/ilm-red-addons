"""Photographs every harness page at its own width (Chrome via Playwright). Harness only."""
import pathlib, sys
from playwright.sync_api import sync_playwright

out = pathlib.Path(__file__).parent / 'out'
chrome = sys.argv[1] if len(sys.argv) > 1 else '/usr/bin/google-chrome'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=chrome, args=['--no-sandbox'])
    for f in sorted(out.glob('*.html')):
        w = 390 if 'phone' in f.name else 1180
        pg = b.new_page(viewport={'width': w, 'height': 900})
        pg.goto(f.as_uri()); pg.wait_for_timeout(300)
        sw = pg.evaluate('document.documentElement.scrollWidth')
        pg.screenshot(path=str(f.with_suffix('.png')), full_page=True)
        print(f'{f.stem}: width {w}, scrollWidth {sw}{"  SIDEWAYS SCROLL" if sw > w else ""}')
    b.close()
