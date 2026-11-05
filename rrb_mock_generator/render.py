"""Render mocks (JSON) to a question-paper HTML/PDF and a solutions HTML/PDF."""
import json, html, math, sys, glob, subprocess

E = html.escape
PAL = ["#1f4e79", "#e08a1e", "#2e8b57", "#b03a2e", "#6c4f9e", "#3a8fb7", "#9c7c38"]


def t(s):
    return E(str(s)).replace("\n", "<br>")


# ------------------------------------------------------------------ visuals
def v_table(headers, rows, cls="dt"):
    h = "".join(f"<th>{E(str(x))}</th>" for x in headers)
    b = "".join("<tr>" + "".join(f"<td>{E(str(c))}</td>" for c in r) + "</tr>" for r in rows)
    return f"<table class='{cls}'><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>"


def v_pie(labels, values, title):
    W, H, cx, cy, R = 430, 270, 135, 135, 110
    tot = sum(values)
    a0 = -math.pi / 2
    out = [f"<svg width='{W}' height='{H}' viewBox='0 0 {W} {H}' xmlns='http://www.w3.org/2000/svg'>"]
    for i, (l, v) in enumerate(zip(labels, values)):
        a1 = a0 + 2 * math.pi * v / tot
        x0, y0 = cx + R * math.cos(a0), cy + R * math.sin(a0)
        x1, y1 = cx + R * math.cos(a1), cy + R * math.sin(a1)
        large = 1 if a1 - a0 > math.pi else 0
        out.append(f"<path d='M{cx},{cy} L{x0:.1f},{y0:.1f} A{R},{R} 0 {large} 1 {x1:.1f},{y1:.1f} Z' fill='{PAL[i % len(PAL)]}' stroke='#fff' stroke-width='2'/>")
        am = (a0 + a1) / 2
        out.append(f"<text x='{cx + R * 0.64 * math.cos(am):.1f}' y='{cy + R * 0.64 * math.sin(am) + 4:.1f}' text-anchor='middle' font-size='12' font-weight='700' fill='#fff'>{v}%</text>")
        out.append(f"<rect x='{280}' y='{40 + i * 24}' width='14' height='14' fill='{PAL[i % len(PAL)]}'/><text x='300' y='{52 + i * 24}' font-size='12.5'>{E(l)}</text>")
        a0 = a1
    out.append("</svg>")
    return f"<div class='fig'><div class='figt'>{E(title)}</div>{''.join(out)}</div>"


def v_bar(cats, series, unit, line=False):
    W, H, L, B, T = 520, 280, 46, 40, 20
    mx = max(max(s["values"]) for s in series)
    top = int(math.ceil(mx / 20.0) * 20) + 20
    pw, ph = W - L - 20, H - B - T
    out = [f"<svg width='{W}' height='{H}' viewBox='0 0 {W} {H}' xmlns='http://www.w3.org/2000/svg'>"]
    for g in range(0, top + 1, 20):
        y = T + ph - ph * g / top
        out.append(f"<line x1='{L}' y1='{y:.1f}' x2='{W - 20}' y2='{y:.1f}' stroke='#ddd'/><text x='{L - 6}' y='{y + 4:.1f}' font-size='10' text-anchor='end' fill='#555'>{g}</text>")
    n = len(cats); gw = pw / n; k = len(series)
    for ci, c in enumerate(cats):
        out.append(f"<text x='{L + gw * ci + gw / 2:.1f}' y='{H - B + 16}' font-size='12' text-anchor='middle'>{E(c)}</text>")
    for si, s in enumerate(series):
        col = PAL[si]
        pts = []
        for ci, v in enumerate(s["values"]):
            if line:
                x = L + gw * ci + gw / 2; y = T + ph - ph * v / top
                pts.append((x, y))
                out.append(f"<circle cx='{x:.1f}' cy='{y:.1f}' r='3.5' fill='{col}'/><text x='{x:.1f}' y='{y - 7:.1f}' font-size='10' text-anchor='middle' fill='{col}' font-weight='700'>{v}</text>")
            else:
                bw = gw * 0.7 / k
                x = L + gw * ci + gw * 0.15 + bw * si; y = T + ph - ph * v / top
                out.append(f"<rect x='{x:.1f}' y='{y:.1f}' width='{bw:.1f}' height='{T + ph - y:.1f}' fill='{col}'/><text x='{x + bw / 2:.1f}' y='{y - 3:.1f}' font-size='9.5' text-anchor='middle'>{v}</text>")
        if line:
            out.append("<polyline fill='none' stroke='{}' stroke-width='2' points='{}'/>".format(col, " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)))
        out.append(f"<rect x='{L + 10 + si * 170}' y='{H - 16}' width='12' height='12' fill='{col}'/><text x='{L + 27 + si * 170}' y='{H - 6}' font-size='11.5'>{E(s['name'])}</text>")
    out.append("</svg>")
    return f"<div class='fig'><div class='figt'>Values in {E(unit)}</div>{''.join(out)}</div>"


def v_circle(seats, attr=False, size=270):
    n = len(seats); cx = cy = size / 2; R = size / 2 - 58
    out = [f"<svg width='{size}' height='{size}' viewBox='0 0 {size} {size}' xmlns='http://www.w3.org/2000/svg'><defs><marker id='ah' markerWidth='7' markerHeight='7' refX='5' refY='3.5' orient='auto'><path d='M0,0 L7,3.5 L0,7 z' fill='#333'/></marker></defs>",
           f"<circle cx='{cx}' cy='{cy}' r='{R}' fill='#f3f7fb' stroke='#1f4e79' stroke-width='2'/>"]
    for i, s in enumerate(seats):
        a = -math.pi / 2 + 2 * math.pi * i / n
        inn = s["face"] == "in"
        r1, r2 = (R + 16, R - 14) if inn else (R - 14, R + 16)
        col = "#1f4e79" if inn else "#c0392b"
        out.append(f"<line x1='{cx + r1 * math.cos(a):.1f}' y1='{cy + r1 * math.sin(a):.1f}' x2='{cx + r2 * math.cos(a):.1f}' y2='{cy + r2 * math.sin(a):.1f}' stroke='{col}' stroke-width='2' marker-end='url(#ah)'/>")
        lx, ly = cx + (R + 32) * math.cos(a), cy + (R + 32) * math.sin(a)
        out.append(f"<text x='{lx:.1f}' y='{ly + 5:.1f}' text-anchor='middle' font-size='15' font-weight='700'>{E(s['name'])}</text>")
        if s.get("attr"):
            out.append(f"<text x='{lx:.1f}' y='{ly + 17:.1f}' text-anchor='middle' font-size='9' fill='#555'>{E(s['attr'])}</text>")
    out.append("</svg>")
    return "<div class='fig'>" + "".join(out) + "<div class='cap'>Clockwise from top. Blue arrow = faces centre (left = clockwise); red = faces outside (left = anticlockwise).</div></div>"


def v_row(seats, facing):
    cells = ""
    for i, s in enumerate(seats):
        f = s.get("face") or ("N" if facing != "south" else "S")
        arrow = "&#8593;" if f == "N" else "&#8595;"
        cells += f"<div class='seat'><div class='ar'>{arrow}</div><div class='nm'>{E(s['name'])}</div>{('<div class=sub>' + E(s['attr']) + '</div>') if s.get('attr') else ''}</div>"
    return f"<div class='row'>{cells}</div><div class='cap'>Left end of the page → right end. Arrow shows facing direction.</div>"


def visual(v, solution=False):
    if not v:
        return ""
    ty = v["type"]
    if ty == "table":
        return v_table(v["headers"], v["rows"])
    if ty == "pie":
        return v_pie(v["labels"], v["values"], v.get("title", ""))
    if ty in ("bar", "line"):
        return v_bar(v["categories"], v["series"], v.get("unit", ""), line=(ty == "line"))
    if not solution:
        return ""
    if ty == "circle":
        return v_circle(v["seats"])
    if ty == "linear":
        return v_row(v["seats"], v.get("facing", "north"))
    if ty == "stack":
        rows = [[l["label"], l["name"]] + ([l["attr"]] if l.get("attr") else []) for l in v["levels"]]
        hdr = ["Position" if v["style"] == "box" else "Floor", "Box" if v["style"] == "box" else "Person"] + (["Attribute"] if v["levels"][0].get("attr") else [])
        return v_table(hdr, rows)
    if ty == "schedule":
        rows = [[r["slot"], r["name"]] + ([r["attr"]] if r.get("attr") else []) for r in v["rows"]]
        return v_table(["Slot", "Person"] + (["Attribute"] if v["rows"][0].get("attr") else []), rows)
    if ty == "floorflat":
        return v_table(["Floor", "Flat-X (west)", "Flat-Y (east)"], [[f["floor"], f["P"], f["Q"]] for f in v["floors"]])
    if ty == "parallel":
        return ("<div class='cap'>Row 1 (faces south):</div>" + v_row([dict(name=n, face="S") for n in v["row1"]], "south") +
                "<div class='cap'>Row 2 (faces north):</div>" + v_row([dict(name=n, face="N") for n in v["row2"]], "north"))
    if ty == "tree":
        return v_table(["Generation", "Members (+ male, − female, ? not given, = married)"], [[g["gen"], "; ".join(g["members"])] for g in v["gens"]])
    if ty == "coords":
        return v_table(["Point"] + list(v["points"].keys()), [["(x, y)"] + [f"({p[0]}, {p[1]})" for p in v["points"].values()]]) + "<div class='cap'>Origin = starting point; East = +x, North = +y.</div>"
    return ""


CSS = """
@page { size: A4; margin: 13mm 12mm 14mm 12mm; }
* { box-sizing: border-box; }
body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 9.8pt; color: #1b1b1b; line-height: 1.38; }
h1 { font-size: 20pt; color: #1f4e79; margin: 0 0 6px; }
.mockhead { border-bottom: 3px solid #1f4e79; margin-bottom: 8px; padding-bottom: 4px; display: flex; justify-content: space-between; align-items: baseline; }
.mockhead .mt { font-size: 15pt; font-weight: 700; color: #1f4e79; }
.mockhead .mm { font-size: 9pt; color: #444; }
.lvl { display: inline-block; padding: 1px 8px; border-radius: 3px; font-size: 8.5pt; font-weight: 700; color: #fff; }
.lvl.e { background: #2e7d32; } .lvl.h { background: #b03a2e; }
h2 { font-size: 12.5pt; background: #1f4e79; color: #fff; padding: 4px 9px; border-radius: 3px; margin: 10px 0 6px; page-break-after: avoid; }
.dir { background: #eef3f8; border-left: 4px solid #1f4e79; padding: 6px 9px; margin: 8px 0 4px; page-break-inside: avoid; }
.dir .dh { font-weight: 700; margin-bottom: 3px; }
.dir p { margin: 3px 0; }
.q { padding: 4px 0 5px; page-break-inside: avoid; border-bottom: 1px dotted #ccc; }
.qn { font-weight: 700; color: #1f4e79; }
.opts { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1px 14px; margin: 2px 0 0 18px; }
.opts.long { grid-template-columns: 1fr; }
table.dt { border-collapse: collapse; margin: 5px 0; font-size: 9pt; }
table.dt th { background: #1f4e79; color: #fff; padding: 2px 7px; font-weight: 600; }
table.dt td { border: 1px solid #b9c7d6; padding: 2px 7px; text-align: center; }
table.dt tr:nth-child(even) td { background: #f3f6fa; }
.fig { display: inline-block; margin: 4px 0; text-align: center; }
.figt { font-size: 9pt; font-weight: 700; color: #333; }
.cap { font-size: 8pt; color: #666; }
.row { display: flex; gap: 4px; flex-wrap: wrap; margin: 3px 0; }
.seat { border: 1.5px solid #1f4e79; border-radius: 4px; min-width: 38px; text-align: center; padding: 1px 4px; }
.seat .ar { color: #1f4e79; line-height: 1; } .seat .nm { font-weight: 700; font-size: 11pt; } .seat .sub { font-size: 7.5pt; color: #444; }
.pb { page-break-before: always; }
.keygrid { border-collapse: collapse; font-size: 9pt; margin: 4px 0 10px; }
.keygrid td { border: 1px solid #b9c7d6; padding: 1px 5px; text-align: center; }
.keygrid td.n { background: #eef3f8; color: #555; } .keygrid td.a { font-weight: 700; }
.sol { padding: 4px 0 5px; border-bottom: 1px dotted #ccc; page-break-inside: avoid; }
.ans { background: #e3f4e1; color: #145a14; font-weight: 700; border-radius: 3px; padding: 0 6px; }
.tm { color: #8a6300; font-size: 8.5pt; }
.steps { margin: 2px 0 0 18px; padding: 0; }
.cover { text-align: left; }
.cover .box { border: 1.5px solid #1f4e79; border-radius: 6px; padding: 10px 14px; margin: 12px 0; background: #fbfdff; }
.toc td { padding: 1px 10px 1px 0; }
.setsol { background: #f6f9fc; border: 1px solid #c9d7e6; border-radius: 5px; padding: 6px 9px; margin: 8px 0 4px; page-break-inside: avoid; }
"""


def opts_html(q):
    letters = "abcde"
    long = any(len(o) > 30 for o in q["options"])
    items = "".join(f"<div>({letters[i]}) {E(o)}</div>" for i, o in enumerate(q["options"]))
    return f"<div class='opts{' long' if long else ''}'>{items}</div>"


def paper_mock(m):
    lv = "<span class='lvl h'>HARD</span>" if m["level"] == "Hard" else "<span class='lvl e'>EXAM LEVEL</span>"
    s = f"<div class='mockhead pb'><span class='mt'>{E(m['title'])}</span><span class='mm'>{lv} &nbsp; 80 questions · 45 minutes · +1 / −0.25</span></div>"
    for sec in m["sections"]:
        s += f"<h2>{E(sec['name'])} (Q{sec['blocks'][0]['qs'][0]['no']}–{sec['blocks'][-1]['qs'][-1]['no']})</h2>"
        for b in sec["blocks"]:
            if b["kind"] == "set":
                a, z = b["qs"][0]["no"], b["qs"][-1]["no"]
                s += f"<div class='dir'><div class='dh'>Directions (Q{a}–{z}): {E(b['directions'].replace('Directions: ', ''))}</div><p>{t(b['intro'])}</p>"
                if b.get("clues"):
                    s += "<p>" + " ".join(E(c) for c in b["clues"]) + "</p>"
                if b["topic"] == "Data interpretation":
                    s += visual(b.get("visual"), solution=False)
                s += "</div>"
            for q in b["qs"]:
                s += f"<div class='q'><span class='qn'>Q{q['no']}.</span> {t(q['stem'])}{opts_html(q)}</div>"
    return s


def key_grid(m):
    qs = [q for sec in m["sections"] for b in sec["blocks"] for q in b["qs"]]
    rows = ""
    for r in range(0, 80, 20):
        rows += "<tr>" + "".join(f"<td class='n'>{q['no']}</td><td class='a'>{q['answer']}</td>" for q in qs[r:r + 20]) + "</tr>"
    return f"<table class='keygrid'>{rows}</table>"


def solution_mock(m):
    lv = "HARD" if m["level"] == "Hard" else "EXAM LEVEL"
    s = f"<div class='mockhead pb'><span class='mt'>{E(m['title'])} — Solutions</span><span class='mm'>{lv}</span></div>"
    s += "<b>Answer key</b>" + key_grid(m)
    for sec in m["sections"]:
        s += f"<h2>{E(sec['name'])}</h2>"
        for b in sec["blocks"]:
            if b["kind"] == "set":
                a, z = b["qs"][0]["no"], b["qs"][-1]["no"]
                s += f"<div class='setsol'><b>Q{a}–{z} · {E(b['sub'])}</b>"
                if b["topic"] == "Puzzle":
                    s += f"<div class='cap'>Solve with the clues in the given order: place the persons whose clue fixes an exact position first, draw both cases for every 'two persons between' clue, and cancel cases with the later clues. Final arrangement:</div>"
                v = b.get("visual")
                if b.get("derived"):
                    s += "<div class='cap'>Derived values:</div>" + v_table(b["derived"]["headers"], b["derived"]["rows"])
                elif v and b["topic"] != "Data interpretation":
                    s += visual(v, solution=True)
                s += "</div>"
            for q in b["qs"]:
                steps = "".join(f"<li>{t(x)}</li>" for x in q["sol"])
                s += (f"<div class='sol'><span class='qn'>Q{q['no']}.</span> <span class='ans'>({q['answer'].lower()}) {E(q['options'][q['ans']])}</span> "
                      f"<span class='tm'>· {E(q['topic'])} · target {q['time']} s</span><ol class='steps'>{steps}</ol></div>")
    return s


def cover(mocks, kind):
    rows = "".join(f"<tr><td>Mock {m['mock_no']:02d}</td><td>{m['level']}</td></tr>" for m in mocks)
    if kind == "paper":
        intro = ("<p>20 full-length predicted mocks for IBPS RRB PO (Officer Scale-I) Prelims, built from the question types, data styles and difficulty of the 2021, 2023, 2024 and 2025 papers. "
                 "Every question is original — none is copied from a past paper — and every answer was computed by a solver (puzzles are checked to have exactly one arrangement).</p>"
                 "<div class='box'><b>How to take a mock</b><ol><li>Set a 45-minute timer for all 80 questions (no sectional timing in RRB PO Prelims).</li>"
                 "<li>Marking: +1 for a correct answer, −0.25 for a wrong one.</li><li>Mocks 1–14 are at exam level; Mocks 15–20 are deliberately harder (mixed-facing seating, floor-flat puzzles, more 'possibility' syllogisms).</li>"
                 "<li>Answer keys are at the end of this file; full solutions are in the separate Solutions PDF.</li></ol></div>")
    else:
        intro = "<p>Answer keys and step-by-step solutions for all 20 mocks. Each question shows the topic and a target solving time. Puzzle and DI sets begin with the final arrangement or derived data table.</p>"
    return f"<div class='cover'><h1>IBPS RRB PO Prelims — 20 Predicted Mocks{' (Solutions)' if kind != 'paper' else ''}</h1>{intro}<table class='toc'>{rows}</table></div>"


def build(files, out_prefix):
    mocks = [json.load(open(f)) for f in files]
    head = f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>{CSS}</style></head><body>"
    paper = head + cover(mocks, "paper") + "".join(paper_mock(m) for m in mocks)
    paper += "<div class='pb'></div><h1>Answer keys</h1>" + "".join(f"<b>Mock {m['mock_no']:02d}</b>" + key_grid(m) for m in mocks) + "</body></html>"
    sol = head + cover(mocks, "sol") + "".join(solution_mock(m) for m in mocks) + "</body></html>"
    open(out_prefix + "_questions.html", "w").write(paper)
    open(out_prefix + "_solutions.html", "w").write(sol)
    for k in ("questions", "solutions"):
        subprocess.run(["google-chrome", "--headless", "--no-sandbox", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={out_prefix}_{k}.pdf", f"{out_prefix}_{k}.html"], check=True, capture_output=True, timeout=600)


if __name__ == "__main__":
    build(sorted(glob.glob(sys.argv[1])), sys.argv[2])
