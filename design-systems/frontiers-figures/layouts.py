"""Figure layouts built on the kit (spec FR-007): ten common shapes, each a figure type in the
ontology's classification (0014-design-systems FR-032): a process diagram (a vertical chain of
steps), a comparison (two columns), a cycle diagram (a loop), a layer diagram (a stack), a
relationship diagram (many sources converging on one), a decision flowchart (a gate), a
hierarchy diagram (a tree), and, drawn from data (spec FR-012), a bar chart, a line chart and a
timeline. A figure that fits none is drawn directly on the kit's primitives.

Every layout uses the house type sizes: 21px body text, 22px bold for emphasized boxes and
takeaways, 20px bold for small labels (column heads, YES/NO), a 34px title and a 20px subtitle. Box
heights are sized from the number of wrapped lines in the theme's sans, so a box always fits its
text; height arguments are minimums. The canvas height follows the content, and its width is the
standard or compact canvas (svgkit.CANVAS). Colors are figure roles, never values.
"""
from svgkit import SVG, BODY_PX, MIN_PAD, box_height

TOP = 120        # first content row, below a title and subtitle
BODY = BODY_PX   # 21px body text
EMPH = 22        # bold emphasized box text and takeaways
LABEL = 20       # small bold labels


def _note(s, y, width, text):
    """Neutral takeaway box across the canvas; returns its height."""
    h = box_height(text, width - 56, size=EMPH, bold=True, pad=24)
    s.rect(28, y, width - 56, h, fill="neutral-tint", stroke="line", sw=1.2, rx=3)
    s.text_block(width / 2, y + h / 2 + EMPH * 0.35, text, size=EMPH, bold=True, fill="ink",
                 max_width=width - 56 - 48)
    return h


def chain_vertical(path, title, subtitle, steps, width=1040, box_w=760, box_h=70, gap=34,
                   top=TOP, colors=None, note=None):
    """Steps top to bottom, joined by arrows. A step is a string or a
    (text, bold) tuple. box_h is the minimum box height."""
    texts = [st[0] if isinstance(st, tuple) else st for st in steps]
    bolds = [st[1] if isinstance(st, tuple) and len(st) > 1 else False for st in steps]
    bh = max([box_height(t, box_w, size=EMPH if b else BODY, bold=b, min_h=box_h) for t, b in zip(texts, bolds)])
    n = len(steps)
    note_h = box_height(note, width - 56, size=EMPH, bold=True, pad=24) if note else 0
    h = round(top + n * bh + (n - 1) * gap + (note_h + 24 + 28 if note else 30))
    s = SVG(width, h)
    s.title(title, subtitle)
    x = (width - box_w) / 2
    y = top
    for i, (text, bold) in enumerate(zip(texts, bolds)):
        fill, stroke, tfill = (colors[i] if colors else ("primary-tint", "primary", "ink"))
        s.box_with_text(x, y, box_w, bh, text, fill=fill, stroke=stroke, text_fill=tfill,
                        size=EMPH if bold else BODY, bold=bold)
        if i < n - 1:
            s.line(width / 2, y + bh, width / 2, y + bh + gap - 1)
        y += bh + gap
    if note:
        _note(s, y - gap + 24, width, note)
    s.save(path)


def two_column(path, title, subtitle, left_title, left_steps, right_title, right_steps,
               takeaway=None, width=1040, col_w=460, box_h=80, gap=30, top=TOP + 36,
               left_colors=("primary-tint", "primary", "ink"), right_colors=("emphasis-tint", "emphasis", "emphasis")):
    """Two columns of steps side by side (e.g. before/after); each
    column's last step is bold. Boxes in the same row share a height."""
    n = max(len(left_steps), len(right_steps))

    def bh_of(steps, i):
        if i >= len(steps):
            return 0
        last = i == len(steps) - 1
        return box_height(steps[i], col_w, size=EMPH if last else BODY, bold=last, min_h=box_h)
    row_h = [max(bh_of(left_steps, i), bh_of(right_steps, i)) for i in range(n)]
    body_h = sum(row_h) + (n - 1) * gap
    tk_h = box_height(takeaway, width - 56, size=EMPH, bold=True, pad=24) if takeaway else 0
    h = round(top + body_h + (30 + tk_h + 28 if takeaway else 30))
    s = SVG(width, h)
    s.title(title, subtitle)
    lx = 40
    rx = width - 40 - col_w
    s.text(lx + col_w / 2, top - 16, left_title, size=LABEL, bold=True, fill="muted")
    s.text(rx + col_w / 2, top - 16, right_title, size=LABEL, bold=True, fill="muted")
    for col_x, steps, (fill, stroke, tfill) in ((lx, left_steps, left_colors), (rx, right_steps, right_colors)):
        y = top
        for i, step in enumerate(steps):
            last = i == len(steps) - 1
            s.box_with_text(col_x, y, col_w, row_h[i], step, fill=fill, stroke=stroke, text_fill=tfill,
                            size=EMPH if last else BODY, bold=last)
            if not last:
                cx = col_x + col_w / 2
                s.line(cx, y + row_h[i], cx, y + row_h[i] + gap - 1, stroke="line")
            y += row_h[i] + gap
    if takeaway:
        _note(s, top + body_h + 30, width, takeaway)
    s.save(path)


def loop_circular(path, title, subtitle, steps, width=1040, center=None, radius=300, radius_x=345):
    """Steps placed clockwise around an oval from the top (radius is the
    vertical radius, radius_x the horizontal one, so side boxes clear
    their neighbours), each joined to the next by a curved arrow; an
    optional neutral centre label."""
    import math
    box_w = 250
    box_h = max([box_height(t, box_w, min_h=80) for t in steps])
    top_margin = TOP
    cx = width / 2
    cy = top_margin + radius + box_h / 2
    c_w = 250
    c_h = box_height(center, c_w, size=EMPH, bold=True, min_h=80) if center else 0
    height = round(cy + radius + box_h / 2 + 30)
    s = SVG(width, height)
    s.title(title, subtitle)
    n = len(steps)
    pts = []
    for i in range(n):
        ang = -math.pi / 2 + i * 2 * math.pi / n
        pts.append((cx + radius_x * math.cos(ang), cy + radius * math.sin(ang)))
    for i, (bx, by) in enumerate(pts):
        s.box_with_text(bx - box_w / 2, by - box_h / 2, box_w, box_h, steps[i], fill="primary-tint",
                        stroke="primary", text_fill="ink", size=BODY)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        dx, dy = x2 - x1, y2 - y1
        dist = (dx ** 2 + dy ** 2) ** 0.5
        ux, uy = dx / dist, dy / dist
        # leave each box where the line from its centre crosses its edge
        def edge(u, v):
            tx = (box_w / 2 + 6) / abs(u) if u else float("inf")
            ty = (box_h / 2 + 6) / abs(v) if v else float("inf")
            return min(tx, ty)
        t = edge(ux, uy)
        sx, sy = x1 + ux * t, y1 + uy * t
        ex, ey = x2 - ux * t, y2 - uy * t
        mx, my = (sx + ex) / 2, (sy + ey) / 2
        nx, ny = -uy, ux
        cxm, cym = mx + nx * 36, my + ny * 36
        s.curve(sx, sy, cxm, cym, ex, ey, stroke="line")
    if center:
        s.rect(cx - c_w / 2, cy - c_h / 2, c_w, c_h, fill="neutral-tint", stroke="line", sw=1.2, rx=6)
        s.text_block(cx, cy + EMPH * 0.35, center, size=EMPH, bold=True, fill="ink", max_width=c_w - 2 * MIN_PAD)
    s.save(path)


def stack_layers(path, title, subtitle, layers, width=1040, box_w=860, box_h=80, gap=18, top=TOP,
                 note=None):
    """Horizontal layers top to bottom. A layer is (text, fill, stroke,
    text_fill, bold); each box is sized to its own wrapped text."""
    hs = [box_height(t, box_w, size=EMPH if b else BODY, bold=b, min_h=box_h) for t, _, _, _, b in layers]
    n = len(layers)
    note_h = box_height(note, width - 56, size=EMPH, bold=True, pad=24) if note else 0
    h = round(top + sum(hs) + (n - 1) * gap + (note_h + 24 + 28 if note else 30))
    s = SVG(width, h)
    s.title(title, subtitle)
    x = (width - box_w) / 2
    y = top
    for (text, fill, stroke, tfill, bold), bh in zip(layers, hs):
        s.box_with_text(x, y, box_w, bh, text, fill=fill, stroke=stroke, text_fill=tfill,
                        size=EMPH if bold else BODY, bold=bold)
        y += bh + gap
    if note:
        _note(s, y - gap + 24, width, note)
    s.save(path)


def converge(path, title, subtitle, sources, sink, width=1040, top=TOP):
    """Up to four sources per row, all feeding one emphasized sink below.
    One row gets a line from each source; more than one row is framed
    as a group with a single arrow, so no line crosses a lower box."""
    n = len(sources)
    cols = 4
    rows = (n + cols - 1) // cols
    gx, gy = 16, 20
    box_w = (width - 56 - (cols - 1) * gx) / cols
    box_h = max([box_height(src, box_w, min_h=70) for src in sources])
    used = min(n, cols)
    grid_w = used * box_w + (used - 1) * gx
    x0 = (width - grid_w) / 2
    y0 = top
    positions = []
    for i, src in enumerate(sources):
        r, c = divmod(i, cols)
        positions.append((x0 + c * (box_w + gx), y0 + r * (box_h + gy)))
    h_grid = rows * box_h + (rows - 1) * gy
    sink_y = y0 + h_grid + (80 if rows == 1 else 70)
    sink_w = 520
    sink_h = box_height(sink, sink_w, size=EMPH, bold=True, min_h=80)
    sink_x = (width - sink_w) / 2
    h = round(sink_y + sink_h + 40)
    s = SVG(width, h)
    s.title(title, subtitle)
    if rows > 1:
        s.rect(x0 - 12, y0 - 12, grid_w + 24, h_grid + 24, fill="surface", stroke="line", sw=1.2, rx=6)
        s.line(width / 2, y0 + h_grid + 12, width / 2, sink_y - 1, stroke="line")
    for (bx, by), src in zip(positions, sources):
        s.box_with_text(bx, by, box_w, box_h, src, fill="neutral-tint", stroke="line", text_fill="body", size=BODY)
        if rows == 1:
            s.line(bx + box_w / 2, by + box_h, sink_x + sink_w / 2, sink_y - 1, stroke="line", sw=1.3)
    s.box_with_text(sink_x, sink_y, sink_w, sink_h, sink, fill="emphasis-tint", stroke="emphasis",
                    text_fill="emphasis", size=EMPH, bold=True)
    s.save(path)


def gate(path, title, subtitle, question, yes_branch, no_branch, width=1040, top=TOP + 10):
    """A question box that splits into a YES branch (primary, left) and a
    NO branch (emphasis, right)."""
    qw = 560
    qh = box_height(question, qw, size=EMPH, bold=True, min_h=90)
    bw = 430
    bh = max(box_height(yes_branch, bw, min_h=110), box_height(no_branch, bw, min_h=110))
    qx, qy = (width - qw) / 2, top
    by = qy + qh + 100
    h = round(by + bh + 40)
    s = SVG(width, h)
    s.title(title, subtitle)
    s.box_with_text(qx, qy, qw, qh, question, fill="neutral-tint", stroke="strong", text_fill="ink",
                    size=EMPH, bold=True)
    lx, rx = width / 2 - 30 - bw, width / 2 + 30
    s.line(qx + qw * 0.28, qy + qh, lx + bw / 2, by - 1, stroke="line")
    s.line(qx + qw * 0.72, qy + qh, rx + bw / 2, by - 1, stroke="line")
    # YES/NO sit outside the arrows so a label never crosses a line
    s.text(lx + bw / 2 - 40, qy + qh + 56, "YES", size=LABEL, bold=True, fill="muted")
    s.text(rx + bw / 2 + 40, qy + qh + 56, "NO", size=LABEL, bold=True, fill="muted")
    s.box_with_text(lx, by, bw, bh, yes_branch, fill="primary-tint", stroke="primary", text_fill="ink", size=BODY)
    s.box_with_text(rx, by, bw, bh, no_branch, fill="emphasis-tint", stroke="emphasis", text_fill="emphasis", size=BODY)
    s.save(path)


def tree(path, title, subtitle, root, children, width=1040, top=TOP):
    """An ink root box over a row of children, alternating primary and
    emphasis. Children share the canvas width (at most 300px each)."""
    rw = 400
    rh = box_height(root, rw, size=EMPH, bold=True, min_h=70)
    n = len(children)
    gx = 24
    cw = min(300, (width - 56 - (n - 1) * gx) / n)
    ch = max([box_height(c, cw, min_h=110) for c in children])
    rx = (width - rw) / 2
    ry = top
    cy = ry + rh + 90
    s = SVG(width, round(cy + ch + 40))
    s.title(title, subtitle)
    s.box_with_text(rx, ry, rw, rh, root, fill="ink", stroke="ink", text_fill="surface", size=EMPH, bold=True)
    total = n * cw + (n - 1) * gx
    x0 = (width - total) / 2
    for i, child in enumerate(children):
        cx = x0 + i * (cw + gx)
        s.line(rx + rw / 2, ry + rh, cx + cw / 2, cy - 1, stroke="line")
        fill, stroke, tfill = ("primary-tint", "primary", "ink") if i % 2 == 0 else ("emphasis-tint", "emphasis", "emphasis")
        s.box_with_text(cx, cy, cw, ch, child, fill=fill, stroke=stroke, text_fill=tfill, size=BODY)
    s.save(path)


# ───── Charts (spec FR-012): drawn from data, every series labelled directly, never by color alone ─────

SOURCE = 20      # the source line under a chart
MAX_SERIES = 4   # series-1 to series-4


def _nice_ticks(top, count=5):
    """Round axis ticks from 0 to at least top."""
    raw = top / (count - 1)
    mag = 10 ** len(str(int(raw))) / 10 if raw >= 1 else 1
    step = next(m * mag for m in (1, 2, 2.5, 5, 10) if m * mag >= raw)
    n = 0
    while n * step < top:
        n += 1
    return [i * step for i in range(n + 1)]


def _fmt(v, unit):
    text = f"{v:,.0f}" if float(v).is_integer() or abs(v) >= 100 else f"{v:,.1f}"
    return f"{text}{unit}"


def _source(s, y, width, source):
    if source:
        s.text(28, y, f"Source: {source}", size=SOURCE, fill="muted", anchor="start")


def bar_chart(path, title, subtitle, items, unit="", highlight=None, source=None, width=1040, top=TOP, bar_h=36, gap=18):
    """Horizontal bars, one per (label, value), longest first as given, each labelled with its value;
    the item at index `highlight` takes the emphasis role, the rest series-1."""
    from svgkit import text_width
    label_w = min(max(text_width(lbl, BODY) for lbl, _ in items) + 8, width * 0.4)
    vmax = max(v for _, v in items)
    value_w = max(text_width(_fmt(v, unit), BODY, bold=True) for _, v in items) + 16
    x0 = 28 + label_w + 12
    span = width - 40 - value_w - x0
    h = round(top + len(items) * (bar_h + gap) + (52 if source else 24))
    s = SVG(width, h)
    s.title(title, subtitle)
    y = top
    for i, (lbl, v) in enumerate(items):
        w = max(span * v / vmax, 2)
        s.rect(x0, y, w, bar_h, fill="emphasis" if i == highlight else "series-1", rx=2)
        s.text(x0 - 12, y + bar_h / 2 + BODY * 0.35, lbl, size=BODY, fill="body", anchor="end")
        s.text(x0 + w + 10, y + bar_h / 2 + BODY * 0.35, _fmt(v, unit), size=BODY, bold=True, fill="ink", anchor="start")
        y += bar_h + gap
    s.line(x0, top - 8, x0, y - gap + 8, stroke="line", sw=1.5, arrow=False)
    _source(s, h - 20, width, source)
    s.save(path)


def line_chart(path, title, subtitle, x_labels, series, unit="", y_max=None, source=None, width=1040, top=TOP + 10, plot_h=400):
    """One line per (name, values) over x_labels, from zero, with gridlines at round ticks; each line is
    named at its last point, so no legend is needed. At most four series."""
    from svgkit import text_width
    if len(series) > MAX_SERIES:
        raise ValueError(f"a line chart draws at most {MAX_SERIES} series; split it or label the rest in the text")
    ticks = _nice_ticks(y_max or max(max(vals) for _, vals in series))
    left = 28 + max(text_width(_fmt(t, unit), LABEL) for t in ticks) + 14
    right = width - 28 - min(max(text_width(name, LABEL, bold=True) for name, _ in series) + 22, 260)
    h = round(top + plot_h + 50 + (40 if source else 10))
    s = SVG(width, h)
    s.title(title, subtitle)
    ytop, ybot = top, top + plot_h
    sy = lambda v: ybot - (ybot - ytop) * v / ticks[-1]  # noqa: E731
    sx = lambda i: left + (right - left) * i / max(len(x_labels) - 1, 1)  # noqa: E731
    for t in ticks:
        s.line(left, sy(t), right, sy(t), stroke="rule" if t else "line", sw=1 if t else 1.5, arrow=False)
        s.text(left - 10, sy(t) + LABEL * 0.35, _fmt(t, unit), size=LABEL, fill="muted", anchor="end")
    for i, lbl in enumerate(x_labels):
        s.text(sx(i), ybot + 30, lbl, size=LABEL, fill="muted", anchor="middle")
    ends = []
    for k, (name, vals) in enumerate(series):
        role = f"series-{k + 1}"
        pts = [(sx(i), sy(v)) for i, v in enumerate(vals)]
        s.polyline(pts, stroke=role, sw=3)
        for x, y in pts:
            s.dot(x, y, r=4.5, fill=role)
        ends.append([pts[-1][1], name, role])
    ends.sort()
    for i in range(1, len(ends)):
        ends[i][0] = max(ends[i][0], ends[i - 1][0] + LABEL + 8)
    for y, name, role in ends:
        s.text(right + 14, y + LABEL * 0.35, name, size=LABEL, bold=True, fill="ink", anchor="start")
    _source(s, h - 20, width, source)
    s.save(path)


def timeline(path, title, subtitle, events, width=1040, top=TOP, gap=26, text_w=None):
    """Events top to bottom, each a (when, what): the date in bold on the left, a marker on a vertical
    line, and what happened beside it, wrapped to fit."""
    from svgkit import text_width, wrap
    when_w = max(text_width(w, LABEL, bold=True) for w, _ in events) + 8
    x_line = 28 + when_w + 24
    text_w = text_w or width - x_line - 28 - 28
    rows = [wrap(what, BODY, text_w) for _, what in events]
    row_h = [max(len(lines), 1) * BODY * 1.3 for lines in rows]
    h = round(top + sum(row_h) + gap * (len(events) - 1) + 40)
    s = SVG(width, h)
    s.title(title, subtitle)
    s.line(x_line, top - 6, x_line, top + sum(row_h) + gap * (len(events) - 1), stroke="line", sw=2, arrow=False)
    y = top
    for (when, _), lines, rh in zip(events, rows, row_h):
        base = y + BODY * 0.9
        s.dot(x_line, base - BODY * 0.35, r=7, fill="primary")
        s.text(x_line - 24, base, when, size=LABEL, bold=True, fill="ink", anchor="end")
        for j, line in enumerate(lines):
            s.text(x_line + 24, base + j * BODY * 1.3, line, size=BODY, fill="body", anchor="start")
        y += rh + gap
    s.save(path)
