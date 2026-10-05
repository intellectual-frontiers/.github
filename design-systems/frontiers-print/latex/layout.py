#!/usr/bin/env python3
"""Resolve and emit journal article layouts from layouts.json and typefaces.json, this design system's machine-readable
layout and typeface registry (spec FR-006, FR-007). Part of frontiers-print, run by the production pipeline and by
the assurance harness.
  layout.py resolve <name|alias|''>   print the canonical name, or exit 1 and list the layouts
  layout.py emit <canonical>          print iflayout.def (LaTeX macros the class reads)
  layout.py list                      print the layouts with summaries
  layout.py doc                       print the layouts as Markdown
  layout.py sync <file>...            rewrite the generated layouts block in each Markdown file
  layout.py check-docs <file>...      fail if a file's generated layouts block is out of date
The registry is the only place a layout's numbers live. Licensed fonts are never part of this design system; a
consumer that has them names their directory in IF_FONTS_LICENSED.
"""
import json, os, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
REG = json.load(open(HERE / 'layouts.json'))
L = REG['layouts']
TF = json.load(open(HERE / 'typefaces.json'))
FONT_DIRS = {'house': HERE.parent / 'fonts', 'licensed': Path(os.environ.get('IF_FONTS_LICENSED', HERE.parent / 'fonts-licensed'))}

def resolve(name):
    name = (name or '').strip() or REG['default']
    if name in L: canon = name
    else:
        canon = next((k for k, v in L.items() if name in v.get('aliases', [])), None)
    if canon is None:
        sys.exit(f"layout: '{name}' is not a layout. Choose one of: " + ', '.join(sorted(L)) + '. Aliases: ' + ', '.join(f"{a} = {k}" for k, v in L.items() for a in v.get('aliases', [])))
    if L[canon]['status'] != 'built':
        built = ', '.join(k for k, v in L.items() if v['status'] == 'built')
        sys.exit(f"layout: '{canon}' is planned and not built yet. {L[canon].get('note','')} Built layouts: {built}.")
    return canon

def _files(fam):
    d = FONT_DIRS[fam['dir']]
    return [d / (fam[k] + fam['ext']) for k in ('regular', 'bold', 'italic', 'bolditalic')]

def resolve_typeface(canon, override=''):
    """The typeface set to use: the paper's choice, else the layout's, else the default. A license-required set
    whose files are missing falls back to the layout's own set, with a note on stderr; a built set whose files
    are missing, or an unknown name, is an error."""
    name = (override or '').strip() or L[canon].get('typeface') or TF['default']
    if name not in TF['sets']:
        sys.exit(f"typeface: '{name}' is not a typeface set. Choose one of: " + ', '.join(TF['sets']))
    st = TF['sets'][name]
    missing = [str(f) for fam in (st['main'], st['sans']) for f in _files(fam) if not f.exists()]
    if missing:
        if st['status'] == 'license-required':
            fb = L[canon].get('typeface') or TF['default']
            if fb == name: fb = TF['default']
            print(f"typeface: '{name}' needs licensed fonts that are not installed ({', '.join(Path(m).name for m in missing[:3])}...); using '{fb}'. See docs/paper-layouts.md, Typefaces.", file=sys.stderr)
            return resolve_typeface(canon, fb)
        sys.exit(f"typeface: set '{name}' is missing font files: {', '.join(missing)}")
    return name

def _fontspec(fam, sans=False):
    d = FONT_DIRS[fam['dir']]
    o = [f"Path={d}/", f"Extension={fam['ext']}", f"UprightFont={fam['regular']}", f"BoldFont={fam['bold']}", f"ItalicFont={fam['italic']}", f"BoldItalicFont={fam['bolditalic']}"]
    if fam.get('scale', 1) != 1: o.append(f"Scale={fam['scale']}")
    if fam.get('features'): o.append(fam['features'])
    if sans: o.append('RawFeature={-calt}')  # contextual alternates reach the PDF without a Unicode mapping
    return fam['regular'], ','.join(o)

def emit(canon, typeface=''):
    c = L[canon]; o = []
    d = lambda k, v: o.append(f"\\def\\ifL{k}{{{v}}}")
    d('name', canon); d('cols', c['cols']); d('side', c['side']); d('geometry', c['geometry'])
    d('headsep', c['headsep']); d('footskip', c['footskip']); d('colsep', c['colsep'])
    for k in ('body', 'small', 'foot'): d(k + 'sz', c[k][0]); d(k + 'ld', c[k][1])
    for nm, (a, b) in zip(('hone', 'htwo', 'hthree'), c['h']): d(nm + 'sz', a); d(nm + 'ld', b)
    d('span', f"{c['span_in']}in"); d('dispskip', c['display_skip'])
    left = c.get('sidebar_side') == 'left'
    d('spanl', f"-{c['span_in']}in" if left else '0in'); d('spanr', '0in' if left else f"-{c['span_in']}in")
    o.append('\\newif\\ifsideleft' + ('\\sidelefttrue' if left else '\\sideleftfalse'))
    o.append('\\newif\\ififsidebar' + ('\\ifsidebartrue' if c['sidebar'] else '\\ifsidebarfalse'))
    tf = resolve_typeface(canon, typeface); st = TF['sets'][tf]
    d('typeface', tf)
    for role, key in (('main', 'main'), ('sans', 'sans')):
        name, opts = _fontspec(st[key], sans=(key == 'sans')); d(role + 'font', name); d(role + 'opts', opts)
    for role in ('main', 'sans', 'mono'):
        d('fb' + role, ','.join('"[' + str(FONT_DIRS['house'] / f) + ']"' for f in TF['fallback'][role]))
    return '\n'.join(o) + '\n'

def doc():
    out = []
    for k, v in L.items():
        al = ', '.join(f'`{a}`' for a in v['aliases']) or 'none'
        out.append(f"### `{k}`" + ('' if v['status'] == 'built' else ' (planned, not built)'))
        out.append(f"{v['summary']}\n")
        out.append(f"- **Aliases:** {al}\n- **Modeled on:** {v['modeled_on']}\n- **Best for:** {v['best_for']}")
        if v.get('caution'): out.append(f"- **Caution:** {v['caution']}")
        if v.get('note'): out.append(f"- **Status:** {v['note']}")
        out.append('')
    return '\n'.join(out)

def typeface_doc():
    out = []
    for k, v in TF['sets'].items():
        out.append(f"### `{k}`" + ('' if v['status'] == 'built' else ' (license required)'))
        out.append(f"{v['summary']}\n")
        out.append(f"- **Modeled on:** {v['modeled_on']}\n- **Best for:** {v['best_for']}")
        if v.get('note'): out.append(f"- **Files:** {v['note']}")
        out.append('')
    return '\n'.join(out)

BEGIN, END = '<!-- layouts:begin (generated by latex/layout.py sync; edit layouts.json, not this block) -->', '<!-- layouts:end -->'

def sync(path, check=False):
    t = Path(path).read_text(); new = t
    for name, body in (('layouts', doc), ('typefaces', typeface_doc)):
        begin = f'<!-- {name}:begin'; end = f'<!-- {name}:end -->'
        a, b = new.find(begin), new.find(end)
        if a < 0 or b < 0: continue
        new = new[:a] + f'<!-- {name}:begin (generated by latex/layout.py sync; edit {"layouts" if name == "layouts" else "typefaces"}.json, not this block) -->\n' + body() + '\n' + new[b:]
    if '<!-- layouts:begin' not in t and '<!-- typefaces:begin' not in t: sys.exit(f"layout: {path} has no generated-block markers")
    if check:
        if new != t: sys.exit(f"layout: {path} is out of date; run latex/layout.py sync {path}")
        return
    Path(path).write_text(new)

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'list'
    if cmd == 'resolve': print(resolve(sys.argv[2] if len(sys.argv) > 2 else ''))
    elif cmd == 'built':
        print('\n'.join(k for k, v in L.items() if v['status'] == 'built'))
    elif cmd == 'doc': print(doc())
    elif cmd == 'sync': [sync(f, check=False) for f in sys.argv[2:]]
    elif cmd == 'check-docs': [sync(f, check=True) for f in sys.argv[2:]]
    elif cmd == 'emit': sys.stdout.write(emit(resolve(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else ''))
    elif cmd == 'typeface': print(resolve_typeface(resolve(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else ''))
    elif cmd == 'typefaces':
        for k, v in TF['sets'].items(): print(f"{k} [{v['status']}] {v['summary']}")
    else:
        for k, v in L.items(): print(f"{k} [{v['status']}]" + (f" (alias: {', '.join(v['aliases'])})" if v['aliases'] else '') + f"\n   {v['summary']}")
