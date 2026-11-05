"""Non-puzzle reasoning generators with built-in solvers."""
import itertools, random, math
import numpy as np
from util import *

OPT5 = ["Only conclusion I follows", "Only conclusion II follows", "Either conclusion I or II follows", "Neither conclusion I nor II follows", "Both conclusions I and II follow"]

# =============================================================== SYLLOGISM
TERM_SETS = [
    ["Pens", "Books", "Copies", "Bags", "Files", "Pencils"], ["Doctors", "Nurses", "Teachers", "Clerks", "Lawyers", "Pilots"],
    ["Cars", "Buses", "Trains", "Bikes", "Trucks", "Vans"], ["Roses", "Lilies", "Lotus", "Tulips", "Daisies", "Orchids"],
    ["Rivers", "Lakes", "Ponds", "Seas", "Oceans", "Canals"], ["Phones", "Laptops", "Tablets", "Watches", "Cameras", "Radios"],
    ["Apples", "Mangoes", "Grapes", "Melons", "Plums", "Guavas"], ["Gold", "Silver", "Copper", "Iron", "Zinc", "Nickel"],
    ["Chairs", "Tables", "Sofas", "Beds", "Desks", "Stools"], ["Lions", "Tigers", "Bears", "Wolves", "Foxes", "Deer"],
    ["Dollars", "Euros", "Rupees", "Yens", "Pounds", "Francs"], ["Circles", "Squares", "Cubes", "Cones", "Ovals", "Prisms"],
    ["Routers", "Modems", "Servers", "Cables", "Hubs", "Switches"], ["Bowls", "Plates", "Spoons", "Forks", "Cups", "Mugs"],
]

_SYL = {}


def syl_space(k):
    if k not in _SYL:
        R = 2 ** k
        W = ((np.arange(2 ** R)[:, None] >> np.arange(R)[None, :]) & 1).astype(bool)  # world x region nonempty
        M = ((np.arange(R)[:, None] >> np.arange(k)[None, :]) & 1).astype(bool)     # region x term membership
        valid = np.ones(len(W), dtype=bool)
        for t in range(k):
            valid &= W[:, M[:, t]].any(1)  # each term non-empty
        _SYL[k] = (W[valid], M)
    return _SYL[k]


def s_eval(kind, a, b, W, M):
    A, B = M[:, a], M[:, b]
    if kind == "all":
        return ~W[:, A & ~B].any(1)
    if kind == "no":
        return ~W[:, A & B].any(1)
    if kind == "some":
        return W[:, A & B].any(1)
    if kind == "somenot":
        return W[:, A & ~B].any(1)
    if kind == "fewo":  # only a few A are B
        return W[:, A & B].any(1) & W[:, A & ~B].any(1)
    raise ValueError(kind)


def s_text(kind, A, B):
    return {"all": f"All {A} are {B}.", "no": f"No {A} are {B}.", "some": f"Some {A} are {B}.", "somenot": f"Some {A} are not {B}.", "fewo": f"Only a few {A} are {B}."}[kind]


def gen_syllogism(rng, hard=False):
    for _ in range(300):
        k = rng.choice([3, 4, 4, 4]) if not hard else 4
        W, M = syl_space(k)
        terms = rng.sample(rng.choice(TERM_SETS), k)
        order = list(range(k))
        stmts = []
        kinds = ["all", "all", "some", "some", "no", "fewo", "fewo"] if not hard else ["all", "some", "no", "fewo", "fewo", "fewo"]
        for i in range(k - 1):
            a, b = order[i], order[i + 1]
            if rng.random() < 0.4:
                a, b = b, a
            kd = rng.choice(kinds)
            stmts.append((kd, a, b))
        if sum(1 for s in stmts if s[0] == "no") > 1:
            continue
        mask = np.ones(len(W), dtype=bool)
        for kd, a, b in stmts:
            mask &= s_eval(kd, a, b, W, M)
        if not mask.any():
            continue
        Wv = W[mask]
        # candidate conclusions
        cands = []
        for a, b in itertools.permutations(range(k), 2):
            if any((s[1], s[2]) in ((a, b), (b, a)) for s in stmts) and rng.random() < 0.7:
                continue
            for kd in ("all", "some", "no", "somenot"):
                v = s_eval(kd, a, b, Wv, M)
                definite, possible = v.all(), v.any()
                cands.append(dict(text=s_text(kd, terms[a], terms[b]), follows=bool(definite), kind=kd, a=a, b=b, ptype="def", v=v))
                if not definite:
                    if kd == "all":
                        ptxt = f"All {terms[a]} being {terms[b]} is a possibility."
                    elif kd == "some":
                        ptxt = rng.choice([f"Some {terms[a]} being {terms[b]} is a possibility.", f"Some {terms[a]} can be {terms[b]}."])
                    elif kd == "somenot":
                        ptxt = f"Some {terms[a]} not being {terms[b]} is a possibility."
                    else:
                        ptxt = None
                    if ptxt:
                        cands.append(dict(text=ptxt, follows=bool(possible), kind="p" + kd, a=a, b=b, ptype="pos", v=v))
                if kd == "all":
                    never = not possible
                    cands.append(dict(text=f"All {terms[a]} can never be {terms[b]}.", follows=bool(never), kind="never", a=a, b=b, ptype="def", v=~v))
        # pick conclusion pair
        target = rng.choice(["A", "B", "C", "D", "D", "E", "A", "B"])
        pair = None
        if target == "C":
            # complementary definite pair, neither definite, union always true
            for c1 in cands:
                if c1['ptype'] != "def" or c1['follows'] or c1['kind'] not in ("some", "no", "all", "somenot"):
                    continue
                comp = {"some": "no", "no": "some", "all": "somenot", "somenot": "all"}[c1['kind']]
                for c2 in cands:
                    if c2['kind'] == comp and c2['a'] == c1['a'] and c2['b'] == c1['b'] and not c2['follows'] and (c1['v'] | c2['v']).all():
                        pair = (c1, c2); break
                if pair:
                    break
            if not pair:
                continue
            ans = 2
        else:
            fol = [c for c in cands if c['follows']]
            nfol = [c for c in cands if not c['follows']]
            rng.shuffle(fol); rng.shuffle(nfol)
            need = {"A": (True, False), "B": (False, True), "D": (False, False), "E": (True, True)}[target]
            picks = []
            ok = True
            for nd in need:
                src = fol if nd else nfol
                cand = [c for c in src if c not in picks and not any((c['a'], c['b']) == (p['a'], p['b']) and c['kind'] == p['kind'] for p in picks)]
                if not cand:
                    ok = False; break
                picks.append(cand[0])
            if not ok:
                continue
            # make sure a "neither" pair is not accidentally an either-or pair
            c1, c2 = picks
            if not c1['follows'] and not c2['follows'] and c1['a'] == c2['a'] and c1['b'] == c2['b'] and c1['ptype'] == c2['ptype'] == "def" and (c1['v'] | c2['v']).all():
                continue
            pair = (c1, c2)
            ans = {"A": 0, "B": 1, "D": 3, "E": 4}[target]
        stem = "Statements:\n" + "\n".join(s_text(kd, terms[a], terms[b]) for kd, a, b in stmts) + f"\nConclusions:\nI. {pair[0]['text']}\nII. {pair[1]['text']}"
        sol = [f"I: {'follows' if pair[0]['follows'] else 'does not follow'}" + (" (they form a complementary pair)" if ans == 2 else "") + ".",
               f"II: {'follows' if pair[1]['follows'] else 'does not follow'}."]
        if ans == 2:
            sol = ["Neither conclusion is definite on its own, but the two are complementary (about the same two terms) and one of them must be true ⇒ either I or II follows."]
        return fixed_options_q(stem, OPT5, ans, sol, "Syllogism", "Syllogism", time=40)
    raise RuntimeError("syllogism")


# =============================================================== INEQUALITY
OPT_INEQ = ["Only conclusion I is true", "Only conclusion II is true", "Either conclusion I or II is true", "Neither conclusion I nor II is true", "Both conclusions I and II are true"]


def ineq_relation(edges, x, y):
    """edges: list of (a, op, b). returns '>', '≥', '=', '<', '≤' or None for x vs y"""
    # build directed 'greater-or-equal' graph: a ≥ b with strict flag
    g = {}

    def add(a, b, strict):
        g.setdefault(a, []).append((b, strict))
    for a, op, b in edges:
        if op == ">": add(a, b, True)
        elif op == "≥": add(a, b, False)
        elif op == "<": add(b, a, True)
        elif op == "≤": add(b, a, False)
        elif op == "=": add(a, b, False); add(b, a, False)

    def reach(s, t):
        best = None
        stack = [(s, False)]
        seen = set()
        while stack:
            u, st = stack.pop()
            if (u, st) in seen:
                continue
            seen.add((u, st))
            if u == t and (u, st) != (s, False):
                best = st if best is None else (best or st)
            for v, s2 in g.get(u, []):
                stack.append((v, st or s2))
        return best
    xy = reach(x, y)
    yx = reach(y, x)
    if xy is not None and yx is not None:
        return "="
    if xy is not None:
        return ">" if xy else "≥"
    if yx is not None:
        return "<" if yx else "≤"
    return None


def gen_inequality(rng, hard=False):
    letters = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    for _ in range(500):
        n = rng.randint(6, 8) if not hard else rng.randint(7, 9)
        L = rng.sample(letters, n)
        ops = [rng.choice([">", "≥", "=", "<", "≤", ">", "<", "≥", "≤"]) for _ in range(n - 1)]
        edges = [(L[i], ops[i], L[i + 1]) for i in range(n - 1)]
        # optionally split into statements sharing letters
        if rng.random() < (0.45 if not hard else 0.8):
            cut = rng.randint(2, n - 3)
            s1 = " ".join(x for i in range(cut) for x in (L[i], ops[i])) + " " + L[cut]
            s2 = " ".join(x for i in range(cut, n - 1) for x in (L[i], ops[i])) + " " + L[n - 1]
            if rng.random() < 0.5:
                # reverse s2 for variety
                rev = {">": "<", "<": ">", "≥": "≤", "≤": "≥", "=": "="}
                toks = s2.split()
                toks = toks[::-1]
                toks = [rev.get(t, t) for t in toks]
                s2 = " ".join(toks)
            stmt = f"{s1}; {s2}"
        else:
            stmt = " ".join(x for i in range(n - 1) for x in (L[i], ops[i])) + " " + L[n - 1]
        target = rng.choice(["A", "B", "C", "D", "E", "A", "E", "B"])
        concl = []
        pairs = list(itertools.combinations(L, 2))
        rng.shuffle(pairs)
        info = []
        for x, y in pairs:
            if rng.random() < 0.5:
                x, y = y, x
            r = ineq_relation(edges, x, y)
            info.append((x, y, r))

        def mk(x, y, sign):
            return f"{x} {sign} {y}"

        def truth(r, sign):
            return r == sign
        if target == "C":
            cand = [(x, y, r) for x, y, r in info if r in ("≥", "≤")]
            if not cand:
                continue
            x, y, r = cand[0]
            c1 = mk(x, y, ">" if r == "≥" else "<"); c2 = mk(x, y, "=")
            if rng.random() < 0.5:
                c1, c2 = c2, c1
            ans = 2
            why = [f"{x} {r} {y} from the chain, so neither '{c1}' nor '{c2}' is definite alone, but together they cover '{r}' ⇒ either."]
            concl = [c1, c2]
        else:
            need = {"A": (True, False), "B": (False, True), "D": (False, False), "E": (True, True)}[target]
            picks = []
            used = set()
            for nd in need:
                found = None
                for x, y, r in info:
                    if (x, y) in used or (y, x) in used:
                        continue
                    if nd:
                        if r in (">", "<", "≥", "≤", "="):
                            found = (x, y, r, r); break
                    else:
                        # a false conclusion: either no relation, or a mismatched sign (strict vs non-strict, never a reversed definite)
                        if r is None:
                            found = (x, y, r, rng.choice([">", "<", "≥", "≤"])); break
                        if r == "≥":
                            found = (x, y, r, ">"); break
                        if r == "≤":
                            found = (x, y, r, "<"); break
                if not found:
                    break
                used.add((found[0], found[1]))
                picks.append(found)
            if len(picks) < 2:
                continue
            # avoid accidental either-or
            if not need[0] and not need[1] and {picks[0][0], picks[0][1]} == {picks[1][0], picks[1][1]}:
                continue
            concl = [mk(p[0], p[1], p[3]) for p in picks]
            ans = {"A": 0, "B": 1, "D": 3, "E": 4}[target]
            why = []
            for r_, p in zip(["I", "II"], picks):
                if p[2] is None:
                    why.append(f"{r_}: {p[0]} and {p[1]} are not connected by a one-directional chain ⇒ false.")
                elif p[2] == p[3]:
                    why.append(f"{r_}: chain gives {p[0]} {p[2]} {p[1]} ⇒ true.")
                else:
                    why.append(f"{r_}: chain gives only {p[0]} {p[2]} {p[1]}, not {p[3]} ⇒ false.")
        stem = f"Statement: {stmt}\nConclusions:\nI. {concl[0]}\nII. {concl[1]}"
        return fixed_options_q(stem, OPT_INEQ, ans, why, "Inequality", "Inequality", time=30)
    raise RuntimeError("ineq")


# =============================================================== BLOOD RELATION
class Person:
    def __init__(self, name, sex):
        self.name, self.sex = name, sex  # 'M' 'F' or None (unknown)
        self.parents = []
        self.children = []
        self.spouse = None


def relation(X, Y):
    """returns (male_word, female_word) describing X relative to Y, or None"""
    def sib(a, b):
        return a is not b and a.parents and set(a.parents) == set(b.parents)
    if X.spouse is Y:
        return ("husband", "wife")
    if X in Y.parents:
        return ("father", "mother")
    if Y in X.parents:
        return ("son", "daughter")
    if sib(X, Y):
        return ("brother", "sister")
    for p in Y.parents:
        if X in p.parents:
            return ("grandfather", "grandmother")
    for p in X.parents:
        if Y in p.parents:
            return ("grandson", "granddaughter")
    for p in Y.parents:
        if sib(X, p) or (X.spouse and sib(X.spouse, p)):
            return ("uncle", "aunt")
    for p in X.parents:
        if sib(p, Y) or (Y.spouse and sib(p, Y.spouse)):
            return ("nephew", "niece")
    if Y.spouse and X in Y.spouse.parents:
        return ("father-in-law", "mother-in-law")
    if X.spouse and Y in X.spouse.parents:
        return ("son-in-law", "daughter-in-law")
    if (Y.spouse and sib(X, Y.spouse)) or (X.spouse and sib(X.spouse, Y)):
        return ("brother-in-law", "sister-in-law")
    for p in X.parents:
        for q in Y.parents:
            if sib(p, q):
                return ("cousin", "cousin")
    return None


def word(X, Y):
    r = relation(X, Y)
    if r is None:
        return None
    if r[0] == r[1]:
        return r[0]
    if X.sex is None:
        return "CBD"
    return r[0] if X.sex == "M" else r[1]


def gen_blood_relation(rng, hard=False):
    for _ in range(200):
        names = rng.sample(list("ABCDEFGHJKLMNOPQRSTUVWXYZ"), 12)
        it = iter(names)
        people = []

        def new(sex):
            p = Person(next(it), sex); people.append(p); return p
        g1 = new("M"); g1w = new("F"); g1.spouse, g1w.spouse = g1w, g1
        kids = [new(rng.choice("MF")) for _ in range(rng.choice([2, 3]))]
        for c in kids:
            c.parents = [g1, g1w]; g1.children.append(c); g1w.children.append(c)
        married = rng.sample(kids, rng.choice([1, 2]) if len(kids) > 1 else 1)
        if len(married) == 1 and len(kids) >= 2:
            married = rng.sample(kids, 2)
        unknown_done = False
        for c in married:
            s = new("F" if c.sex == "M" else "M"); s.spouse, c.spouse = c, s
            for _ in range(rng.choice([1, 2])):
                sx = rng.choice("MF")
                ch = new(sx)
                ch.parents = [c, s]; c.children.append(ch); s.children.append(ch)
        if len(people) < 7 or len(people) > 10:
            continue
        # pick one grandchild whose gender will be hidden
        gkids = [p for p in people if p.parents and p.parents[0] in kids or (p.parents and p.parents[1] in kids)]
        hidden = rng.choice(gkids) if gkids and rng.random() < 0.6 else None
        DIRECT = ("husband", "father", "son", "brother")
        root = rng.choice([p for p in people if p is not hidden])
        facts = []
        known = {root}
        remaining = [p for p in people if p not in known]
        rng.shuffle(remaining)
        stuck = False
        while remaining:
            progress = False
            for p in list(remaining):
                anchors = [q for q in known if relation(p, q) and relation(p, q)[0] in DIRECT]
                if p is hidden:
                    anchors = [q for q in anchors if relation(p, q)[0] == "son"]
                if not anchors:
                    continue
                q = rng.choice(anchors)
                facts.append((p, q)); known.add(p); remaining.remove(p); progress = True
            if not progress:
                stuck = True; break
        if stuck:
            continue
        # one gendered fact with the root as subject
        rq = [q for q in people if q is not root and relation(root, q) and relation(root, q)[0] in DIRECT and q is not hidden and (q, root) not in facts]
        if not rq:
            continue
        facts.insert(rng.randrange(len(facts) + 1), (root, rng.choice(rq)))

        def ftxt(p, q):
            r = relation(p, q)
            if p is hidden:
                return f"{p.name} is a child of {q.name}."
            w = r[0] if p.sex == "M" else r[1]
            return f"{p.name} is the {w} of {q.name}."
        texts = [ftxt(p, q) for p, q in facts]
        texts.append("There is no single parent in the family.")
        if hidden:
            hidden.sex = None
        # questions
        qs = []
        pairs = [(a, b) for a in people for b in people if a is not b and word(a, b) not in (None,)]
        rng.shuffle(pairs)
        rel_words = ["father", "mother", "son", "daughter", "brother", "sister", "grandfather", "grandmother", "grandson", "granddaughter", "uncle", "aunt", "nephew", "niece",
                     "father-in-law", "mother-in-law", "son-in-law", "daughter-in-law", "brother-in-law", "sister-in-law", "cousin", "husband", "wife"]
        used = set()
        for a, b in pairs:
            if len(qs) == 3:
                break
            w = word(a, b)
            if (a.name, b.name) in used or any(t.startswith(f"{a.name} is the") and t.endswith(f" of {b.name}.") for t in texts):
                continue
            if w == "CBD":
                correct = "Cannot be determined"
                r = relation(a, b)
                dis = [x.capitalize() for x in r] + [x.capitalize() for x in rng.sample(rel_words, 4)]
            else:
                correct = w.capitalize()
                r = relation(a, b)
                close = [x for x in rel_words if x != w]
                rng.shuffle(close)
                dis = [x.capitalize() for x in close[:5]]
                if rng.random() < 0.3:
                    dis = ["Cannot be determined"] + dis
            q = make_q(f"How is {a.name} related to {b.name}?", correct, dis,
                       f"From the family tree: {a.name} is {b.name}'s {('relative whose gender is not given' if w == 'CBD' else w)}.", "Blood relation", "Family tree", time=40, rng=rng)
            used.add((a.name, b.name)); qs.append(q)
        if len(qs) < 3:
            continue
        last = texts.pop()
        rng.shuffle(texts); texts.append(last)
        sym = lambda q: f"{q.name}({'+' if q.sex == 'M' else ('−' if q.sex == 'F' else '?')})"
        g2 = []
        for c in kids:
            g2.append(sym(c) + (f" = {sym(c.spouse)}" if c.spouse else ""))
        g3 = []
        for c in kids:
            if c.children:
                g3.append(f"children of {c.name}: " + ", ".join(sym(x) for x in c.children))
        tree = [dict(gen=1, members=[f"{sym(g1)} = {sym(g1w)}"]), dict(gen=2, members=g2), dict(gen=3, members=g3)]
        if hidden:
            hidden.sex = "?"
        return dict(kind="set", topic="Blood relation", sub="Family tree", directions="Directions: Study the following information carefully and answer the questions given below.",
                    intro=" ".join(texts), clues=[], visual=dict(type="tree", gens=tree), qs=qs)
    raise RuntimeError("blood")


# =============================================================== DIRECTION
DIRS = {(0, 1): "North", (0, -1): "South", (1, 0): "East", (-1, 0): "West", (1, 1): "North-east", (-1, 1): "North-west", (1, -1): "South-east", (-1, -1): "South-west"}
TRIPLES = {(3, 4): 5, (4, 3): 5, (6, 8): 10, (8, 6): 10, (5, 12): 13, (12, 5): 13, (9, 12): 15, (12, 9): 15, (8, 15): 17, (15, 8): 17}


def sgn(v):
    return (v > 0) - (v < 0)


def gen_direction(rng, hard=False):
    for _ in range(500):
        pts = rng.sample(list("ABCDEFGHJKLMNPQRSTUVW"), 7)
        heading = rng.choice([(0, 1), (1, 0), (0, -1), (-1, 0)])
        hname = DIRS[heading]
        x, y = 0, 0
        coords = {pts[0]: (0, 0)}
        steps = []
        for i in range(1, 6):
            if i > 1:
                turn = rng.choice(["left", "right"])
                hx, hy = heading
                heading = (-hy, hx) if turn == "left" else (hy, -hx)
            dist = rng.choice([2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15])
            x += heading[0] * dist; y += heading[1] * dist
            coords[pts[i]] = (x, y)
            steps.append((turn if i > 1 else None, dist, pts[i], heading))
        # last point: relative to some earlier point
        if len(set(coords.values())) < 6:
            continue
        good = []
        for a, b in itertools.permutations(coords, 2):
            dx = coords[a][0] - coords[b][0]; dy = coords[a][1] - coords[b][1]
            if dx == 0 or dy == 0:
                d = abs(dx) + abs(dy)
            elif (abs(dx), abs(dy)) in TRIPLES:
                d = TRIPLES[(abs(dx), abs(dy))]
            else:
                continue
            good.append((a, b, d, DIRS[(sgn(dx), sgn(dy))]))
        diag = [g for g in good if g[3] not in ("North", "South", "East", "West")]
        if len(diag) < 1 or len(good) < 4:
            continue
        txt = [f"A person starts from point {pts[0]} and walks {steps[0][1]} m towards {DIRS[steps[0][3]]} to reach point {steps[0][2]}."]
        prev = steps[0][2]
        for turn, dist, P, hd in steps[1:]:
            txt.append(f"From point {prev}, he takes a {turn} turn and walks {dist} m to reach point {P}.")
            prev = P
        qs = []
        g1 = rng.choice(diag)
        a, b, d, dr = g1
        qs.append(make_q(f"What is the shortest distance between point {a} and point {b}?", d, num_distractors(d, rng, spread=4) + [d + 2, d + 5, abs(coords[a][0]-coords[b][0]) + abs(coords[a][1]-coords[b][1])],
                         f"{a} = {coords[a]}, {b} = {coords[b]} (taking {pts[0]} as origin, East = +x, North = +y) ⇒ √({abs(coords[a][0]-coords[b][0])}² + {abs(coords[a][1]-coords[b][1])}²) = {d} m.",
                         "Direction", "Distance", time=45, fmt=lambda v: f"{v} m", rng=rng))
        others = [g for g in good if (g[0], g[1]) != (a, b)]
        g2 = rng.choice(others)
        a2, b2, d2, dr2 = g2
        alld = list(DIRS.values())
        qs.append(make_q(f"In which direction is point {a2} with respect to point {b2}?", dr2, [x for x in alld if x != dr2], f"{a2} = {coords[a2]}, {b2} = {coords[b2]} ⇒ {a2} is {dr2} of {b2}.", "Direction", "Direction", time=40, rng=rng))
        g3 = rng.choice([g for g in good if (g[0], g[1]) not in ((a, b), (a2, b2))])
        a3, b3, d3, dr3 = g3
        corr = f"{d3} m, {dr3}"
        dis = [f"{d3} m, {x}" for x in rng.sample([y for y in alld if y != dr3], 2)] + [f"{d3 + rng.choice([1, 2, 3])} m, {dr3}", f"{max(1, d3 - rng.choice([1, 2]))} m, {rng.choice([y for y in alld if y != dr3])}"]
        qs.append(make_q(f"What is the distance and direction of point {a3} with respect to point {b3}?", corr, dis, f"{a3} = {coords[a3]}, {b3} = {coords[b3]} ⇒ {d3} m towards {dr3}.", "Direction", "Distance & direction", time=45, rng=rng))
        return dict(kind="set", topic="Direction", sub="Direction & distance", directions="Directions: Study the following information carefully and answer the questions given below.",
                    intro=" ".join(txt), clues=[], visual=dict(type="coords", points={k: v for k, v in coords.items()}), qs=qs)
    raise RuntimeError("direction")


# =============================================================== CODING-DECODING (sentence -> codes)
WORD_SETS = [
    ["happy", "life", "good", "work", "makes", "people", "smart", "always", "team", "wins", "hard", "great", "future"],
    ["green", "field", "farmer", "grows", "rice", "crop", "rain", "brings", "joy", "every", "season", "new", "harvest"],
    ["train", "runs", "fast", "city", "bus", "slow", "metro", "late", "night", "early", "morning", "goes", "home"],
    ["bank", "gives", "loan", "money", "saves", "rate", "high", "low", "account", "open", "now", "digital", "safe"],
    ["read", "books", "daily", "learn", "new", "skills", "write", "notes", "exam", "pass", "with", "ease", "focus"],
]


def gen_coding(rng, hard=False):
    letters = "abcdefghiklmnoprstuvwyz"
    for _ in range(500):
        vocab = rng.sample(rng.choice(WORD_SETS), 10)
        sents = [rng.sample(vocab, 4) for _ in range(4)]
        used = sorted(set(w for s in sents for w in s))
        if len(used) < 8:
            continue
        occ = {w: frozenset(i for i, s in enumerate(sents) if w in s) for w in used}
        groups = {}
        for w, o in occ.items():
            groups.setdefault(o, []).append(w)
        det = [g[0] for g in groups.values() if len(g) == 1]
        amb = [g for g in groups.values() if len(g) == 2]
        if len(det) < 4 or not amb or any(len(g) > 2 for g in groups.values()):
            continue
        codes = {}
        pool = set()
        while len(pool) < len(used) + 4:
            pool.add(rng.choice(letters) + rng.choice(letters))
        pool = list(pool)
        for w in used:
            codes[w] = pool.pop()
        coded = []
        for s in sents:
            cs = [codes[w] for w in s]
            rng.shuffle(cs)
            coded.append(" ".join(cs))
        intro = "In a certain code language,\n" + "\n".join(f"'{' '.join(s)}' is coded as '{c}'" for s, c in zip(sents, coded))
        qs = []
        # Q1 code for a determined word
        w = rng.choice(det)
        qs.append(make_q(f"What is the code for '{w}'?", codes[w], [codes[x] for x in used if x != w] + pool, f"'{w}' appears in sentences {sorted(i + 1 for i in occ[w])}; the only code common to exactly those sentences is '{codes[w]}'.", "Coding-decoding", "Sentence coding", time=35, rng=rng))
        # Q2 word for a code
        w2 = rng.choice([x for x in det if x != w])
        qs.append(make_q(f"What does the code '{codes[w2]}' stand for?", w2, [x for x in used if x != w2], f"'{codes[w2]}' appears exactly in the sentences containing '{w2}'.", "Coding-decoding", "Sentence coding", time=30, rng=rng))
        # Q3 possible code for a phrase with an ambiguous word
        a1, a2 = rng.choice(amb)
        w3 = rng.choice([x for x in det if x not in (w, w2)] or det)
        correct = f"{codes[a1]} {codes[w3]}"
        dis = [f"{codes[a1]} {codes[x]}" for x in used if x not in (w3, a1, a2)][:2] + [f"{codes[x]} {codes[w3]}" for x in used if x not in (a1, a2, w3)][:2] + [f"{codes[a2]} {codes[w3]}"]
        dis = [d for d in dis if d != correct and d != f"{codes[a2]} {codes[w3]}"]
        qs.append(make_q(f"What may be the possible code for '{a1} {w3}'?", correct, dis, f"'{a1}' is either '{codes[a1]}' or '{codes[a2]}' (it always appears together with '{a2}'); '{w3}' = '{codes[w3]}'. Only '{correct}' is consistent among the options.", "Coding-decoding", "Sentence coding", time=40, rng=rng))
        # Q4 'if X new is coded as' reveals the ambiguous pair
        b1, b2 = rng.choice(amb)
        newc = pool.pop()
        neww = rng.choice(["dream", "light", "power", "smile", "peace", "trust"])
        q4 = make_q(f"If '{b1} {neww}' is coded as '{newc} {codes[b1]}', then what is the code for '{b2}'?", codes[b2], [codes[b1], newc] + [codes[x] for x in det if x != b2], f"'{b1}' and '{b2}' share the codes '{codes[b1]}'/'{codes[b2]}'. The new sentence shows '{b1}' = '{codes[b1]}', so '{b2}' = '{codes[b2]}'.", "Coding-decoding", "Sentence coding", time=40, rng=rng)
        qs.append(q4)
        # Q5 how many codes definitely determined
        nd = len(det)
        qs.append(make_q("How many words' codes can be definitely determined from the given information?", nd, [nd - 1, nd + 1, nd + 2, nd - 2, len(used)], f"Words whose sentence-pattern is unique: {', '.join(sorted(det))} ⇒ {nd}.", "Coding-decoding", "Sentence coding", time=40, fmt=lambda v: numword(v), rng=rng))
        vis = dict(type="table", headers=["Word", "Code"], rows=[[w_, codes[w_]] for w_ in sorted(det)] + [[f"{g[0]} / {g[1]}", f"{codes[g[0]]} / {codes[g[1]]}"] for g in amb])
        return dict(kind="set", topic="Coding-decoding", sub="Sentence coding", directions="Directions: Study the following information carefully and answer the questions given below.", intro=intro, clues=[], visual=vis, qs=qs)
    raise RuntimeError("coding")


# =============================================================== ONE-LINERS
def gen_digit_pairs(rng, hard=False):
    for _ in range(500):
        n = rng.randint(7, 9)
        s = "".join(str(rng.randint(1, 9)) for _ in range(n))
        d = [int(c) for c in s]
        pairs = [(d[i], d[j]) for i in range(n) for j in range(i + 1, n) if abs(d[i] - d[j]) == j - i]
        c = len(pairs)
        if 1 <= c <= 5:
            break
    opts = ["One", "Two", "Three", "Four", "More than four"]
    return fixed_options_q(f"How many such pairs of digits are there in the number '{s}', each of which has as many digits between them in the number as in the numerical series (both forward and backward directions)?",
                           opts, min(c, 5) - 1, [f"Pairs: {', '.join(f'{a}-{b}' for a, b in pairs)} ⇒ {c}.", "Rule: |difference of the two digits| = gap between their positions. Compare each digit only with digits to its right."], "Alphanumeric", "Digit pairs", time=40)


def gen_letter_pairs(rng, hard=False):
    words = ["MONITOR", "PLANETS", "JUSTICE", "FREQUENT", "NATIONAL", "CAPITAL", "STRANGER", "BRIGHTEN", "SHOULDER", "PRODUCTS", "COMPUTER", "DISTANCE", "HOSPITAL", "FORMULAE", "BACKWARD", "QUANTITY", "PAINTERS", "WONDERFUL", "TRIANGLE", "MEDICINE"]
    w = rng.choice(words)
    v = [ord(c) - 64 for c in w]
    n = len(w)
    pairs = [(w[i], w[j]) for i in range(n) for j in range(i + 1, n) if abs(v[i] - v[j]) == j - i]
    c = len(pairs)
    opts = ["None", "One", "Two", "Three", "More than three"]
    return fixed_options_q(f"How many such pairs of letters are there in the word '{w}', each of which has as many letters between them in the word as in the English alphabetical series (both forward and backward directions)?",
                           opts, min(c, 4), [f"Pairs: {', '.join(a + b for a, b in pairs) or 'none'} ⇒ {c}."], "Alphanumeric", "Letter pairs", time=45)


def gen_number_op(rng, hard=False):
    n = 9
    s = [rng.randint(1, 9) for _ in range(n)]
    rule = rng.choice(["odd+1 even-1", "odd-1 even+1", "odd-1 even+2", "odd+2 even-1"])
    def f(x):
        if rule == "odd+1 even-1": return x + 1 if x % 2 else x - 1
        if rule == "odd-1 even+1": return x - 1 if x % 2 else x + 1
        if rule == "odd-1 even+2": return x - 1 if x % 2 else x + 2
        if rule == "odd+2 even-1": return x + 2 if x % 2 else x - 1
    t = [f(x) for x in s]
    if any(x > 9 for x in t):
        t = [x % 10 for x in t]
        rule_txt_extra = " (if the result is 10 or 11, only its unit digit is kept)"
    else:
        rule_txt_extra = ""
    r = {"odd+1 even-1": "1 is added to each odd digit and 1 is subtracted from each even digit",
         "odd-1 even+1": "1 is subtracted from each odd digit and 1 is added to each even digit",
         "odd-1 even+2": "1 is subtracted from each odd digit and 2 is added to each even digit",
         "odd+2 even-1": "2 is added to each odd digit and 1 is subtracted from each even digit"}[rule] + rule_txt_extra
    num = "".join(map(str, s)); new = "".join(map(str, t))
    qt = rng.choice(["sum", "repeat", "third"])
    if qt == "sum":
        a, b = rng.randint(1, 4), rng.randint(1, 4)
        val = t[a - 1] + t[n - b]
        return make_q(f"If in the number '{num}', {r}, then what is the sum of the digit which is {ORD[a]} from the left end and the digit which is {ORD[b]} from the right end of the new number?",
                      val, num_distractors(val, rng, spread=3) + [val + 1, val - 1, val + 2], [f"New number: {new}.", f"{ORD[a]} from left = {t[a-1]}, {ORD[b]} from right = {t[n-b]} ⇒ {val}."], "Alphanumeric", "Number operation", time=40, rng=rng)
    if qt == "repeat":
        from collections import Counter
        cnt = Counter(t)
        rep = sum(1 for k_, v_ in cnt.items() if v_ > 1)
        opts = ["None", "One", "Two", "Three", "More than three"]
        return fixed_options_q(f"If in the number '{num}', {r}, then how many digits appear more than once in the new number?", opts, min(rep, 4), [f"New number: {new}.", f"Repeated digits: {sorted(k_ for k_, v_ in cnt.items() if v_ > 1) or 'none'}."], "Alphanumeric", "Number operation", time=40)
    srt = sorted(set(t), reverse=True)
    if len(srt) < 3:
        return gen_number_op(rng)
    val = srt[2]
    return make_q(f"If in the number '{num}', {r}, then which digit is the third highest in the new number?", val, [x for x in range(10) if x != val], [f"New number: {new}.", f"Distinct digits in descending order: {srt} ⇒ third highest {val}."], "Alphanumeric", "Number operation", time=35, rng=rng)


def gen_letter_shift(rng, hard=False):
    words = ["SNITCHED", "PLANTING", "MOUNTAIN", "CHAPTERS", "BLINKING", "FORECAST", "SPECTRUM", "TRUMPETS", "CLEARING", "HORIZONS", "DIAMONDS", "PROVINCE"]
    w = rng.choice(words)
    rule = rng.choice(["vowel+1 cons-1", "vowel-1 cons+1"])
    V = set("AEIOU")
    def sh(c):
        o = ord(c) - 65
        d = (1 if c in V else -1) if rule == "vowel+1 cons-1" else (-1 if c in V else 1)
        return chr((o + d) % 26 + 65)
    nw = "".join(sh(c) for c in w)
    rt = "each vowel is changed to the next letter and each consonant to the previous letter in the English alphabet" if rule == "vowel+1 cons-1" else "each vowel is changed to the previous letter and each consonant to the next letter in the English alphabet"
    k = rng.randint(2, 4)
    c = nw[-k]
    return make_q(f"If in the word '{w}', {rt}, then which letter will be {ORD[k]} from the right end of the new word?", c, [x for x in "ABCDEFGHIJKLMNOPQRSTUVWXYZ" if x != c and x in nw + "BCDFG"],
                  [f"New word: {nw}.", f"{ORD[k]} from the right = {c}."], "Alphanumeric", "Letter shift", time=35, rng=rng)


def gen_number_arrangement(rng, hard=False):
    """5 three-digit numbers; set of 3 questions"""
    nums = []
    while len(nums) < 5:
        x = rng.randint(213, 987)
        if len(set(str(x))) == 3 and "0" not in str(x) and x not in nums:
            nums.append(x)
    qs = []
    asc = [int("".join(sorted(str(x)))) for x in nums]
    desc = [int("".join(sorted(str(x), reverse=True))) for x in nums]
    i = max(range(5), key=lambda j: asc[j])
    qs.append(make_q("If the digits of each number are arranged in ascending order within the number, which number will be the highest?", nums[i], [x for x in nums if x != nums[i]],
                     [f"New numbers: {', '.join(map(str, asc))} ⇒ highest {asc[i]} (from {nums[i]})."], "Alphanumeric", "Number arrangement", time=35, rng=rng))
    s2 = sorted(nums)
    j = rng.randrange(1, 4)
    v = int(str(s2[j])[0]) + int(str(s2[j])[2])
    qs.append(make_q(f"If the numbers are arranged in ascending order from left to right, what is the sum of the first and the third digit of the number which is {ORD[j + 1]} from the left?", v, num_distractors(v, rng, spread=3) + [v + 1, v + 2, v - 1],
                     [f"Ascending: {', '.join(map(str, s2))}; {ORD[j + 1]} number = {s2[j]} ⇒ {str(s2[j])[0]} + {str(s2[j])[2]} = {v}."], "Alphanumeric", "Number arrangement", time=40, rng=rng))
    k = max(range(5), key=lambda j: int(str(nums[j])[1]) * int(str(nums[j])[2]))
    vals = [int(str(x)[1]) * int(str(x)[2]) for x in nums]
    if vals.count(max(vals)) == 1:
        qs.append(make_q("For which number is the product of the second and third digits the highest?", nums[k], [x for x in nums if x != nums[k]],
                         [f"Products: {', '.join(f'{x}→{p}' for x, p in zip(nums, vals))}."], "Alphanumeric", "Number arrangement", time=35, rng=rng))
    else:
        m = min(range(5), key=lambda j: desc[j])
        qs.append(make_q("If the digits of each number are arranged in descending order within the number, which number will be the lowest?", nums[m], [x for x in nums if x != nums[m]],
                         [f"New numbers: {', '.join(map(str, desc))} ⇒ lowest {desc[m]}."], "Alphanumeric", "Number arrangement", time=35, rng=rng))
    return dict(kind="set", topic="Alphanumeric", sub="Number arrangement", directions="Directions: Study the following numbers carefully and answer the questions given below.",
                intro="  ".join(map(str, nums)), clues=[], visual=None, qs=qs)


# =============================================================== RANKING / COMPARISON
def gen_ranking(rng, hard=False):
    n = rng.choice([6, 7])
    names = sorted(rng.sample(list("ABCDEFGHJKLMPQRSTUVW"), n))
    kind = rng.choice(["h", "w", "m"])
    T = {"h": dict(noun="heights", gt="taller than", top="tallest", unit="cm", sec="The second tallest person is {} cm tall and the second shortest person is {} cm tall.", base=(150, 190)),
         "w": dict(noun="weights", gt="heavier than", top="heaviest", unit="kg", sec="The second heaviest person weighs {} kg and the second lightest person weighs {} kg.", base=(62, 95)),
         "m": dict(noun="marks", gt="scored more marks than", top="highest scorer", unit="marks", sec="The second highest scorer got {} marks and the second lowest scorer got {} marks.", base=(80, 98))}[kind]
    allp = list(itertools.permutations(range(n)))
    for _ in range(200):
        order = list(range(n)); rng.shuffle(order)
        rank = {p: i for i, p in enumerate(order)}
        hi = rng.randint(*T["base"])
        vals = sorted(rng.sample(range(hi - 40, hi), n - 1) + [hi], reverse=True)
        cand = []
        verb = "is " if kind != "m" else ""
        for a, b in itertools.permutations(range(n), 2):
            if rank[a] < rank[b]:
                cand.append((f"{names[a]} {verb}{T['gt']} {names[b]}.", lambda o, a=a, b=b: o.index(a) < o.index(b)))
        for a in range(n):
            k = rank[a]
            if 0 < k < n - 1 and rng.random() < 0.4:
                cand.append((f"Only {numword(k).lower()} {'person' if k == 1 else 'persons'} {'is' if k == 1 and kind != 'm' else ('are' if kind != 'm' else '')} {T['gt']} {names[a]}.".replace("  ", " "), lambda o, a=a, k=k: o.index(a) == k))
            if k != 0 and rng.random() < 0.4:
                cand.append((f"{names[a]} is not the {T['top']}.", lambda o, a=a: o.index(a) != 0))
        rng.shuffle(cand)
        chosen = []
        sp = allp
        for txt, fn in cand:
            new = [o for o in sp if fn(o)]
            if len(new) < len(sp):
                sp = new; chosen.append(txt)
            if len(sp) == 1:
                break
        if len(sp) != 1 or len(chosen) > 8:
            continue
        qs = []
        a = rng.randrange(n)
        cnt = rank[a]
        qs.append(make_q(f"How many persons {'are' if kind != 'm' else ''} {T['gt']} {names[a]}?".replace("  ", " "), cnt, [x for x in range(n) if x != cnt], f"Order (top→bottom): {' > '.join(names[p] for p in order)} ⇒ {cnt}.",
                         "Ranking", "Comparison", time=30, fmt=lambda v: numword(v) if v else "None", rng=rng))
        mid = order[2:n - 2]
        if mid:
            p = rng.choice(mid)
            lo, hi2 = vals[n - 2], vals[1]
            good = rng.randint(lo + 1, hi2 - 1)
            bad = [hi2 + rng.randint(1, 8), lo - rng.randint(1, 8), hi2 + rng.randint(9, 15), lo - rng.randint(9, 15)]
            qs.append(make_q(f"Which of the following may be the {'height' if kind == 'h' else ('weight' if kind == 'w' else 'marks')} of {names[p]}?", good, bad,
                             f"{names[p]} lies strictly between the second from top ({vals[1]}) and the second from bottom ({vals[n - 2]}) ⇒ only {good} fits.", "Ranking", "Comparison", time=30, fmt=lambda v: f"{v} {T['unit']}", rng=rng))
        k = rng.randint(2, n - 2)
        qs.append(make_q(f"Who is {ORD[k + 1]} from the top when the {T['noun']} are arranged in descending order?", names[order[k]], [names[x] for x in range(n) if x != order[k]], f"Order: {' > '.join(names[x] for x in order)}.", "Ranking", "Comparison", time=25, rng=rng))
        intro = f"{numword(n)} persons – {', '.join(names)} – have different {T['noun']}. " + " ".join(chosen) + " " + T["sec"].format(vals[1], vals[n - 2])
        return dict(kind="set", topic="Ranking", sub="Comparison", directions="Directions: Study the following information carefully and answer the questions given below.",
                    intro=intro, clues=[], visual=dict(type="table", headers=["Rank (top→bottom)"] + [str(i + 1) for i in range(n)], rows=[["Person"] + [names[p] for p in order]]), qs=qs[:3])
    raise RuntimeError("ranking")
