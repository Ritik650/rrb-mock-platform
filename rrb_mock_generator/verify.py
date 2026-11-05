"""Independent verifier: re-reads every puzzle's TEXT, re-solves it by backtracking with
semantics written separately from the generator, and checks (1) exactly one arrangement,
(2) it equals the published solution, (3) answers of the common question types.
Also runs structural checks on all 1600 questions."""
import json, re, sys, glob, itertools, collections

ORDW = {"immediate": 1, "second": 2, "third": 3, "fourth": 4, "fifth": 5, "sixth": 6, "seventh": 7, "eighth": 8, "ninth": 9, "first": 1}
NUMW = {"no": 0, "none": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12}
ENT = r"(?:[Tt]he one who (?:likes|belongs to|owns|teaches|plays) [A-Za-z]+|[A-Z])"


class Model:
    def __init__(self, kind, names, attrs, n_slots=None, slots=None, rows=None, facing="north"):
        self.kind, self.names, self.attrs = kind, names, attrs
        self.n = len(names)
        self.slots, self.rows, self.facing = slots, rows, facing


def parse_intro(b):
    intro = b["intro"]
    names = re.search(r"– ([A-Z](?:, [A-Z])+) –", intro)
    attrs = re.search(r"Each of them \w+(?: to)? a different \w+ – ([^.]+)\.", intro)
    a = [x.strip() for x in attrs.group(1).split(",")] if attrs else []
    sub = b["sub"]
    if sub.startswith("Parallel"):
        r1 = re.search(r"In Row 1, ([A-Z](?:, [A-Z])+) are seated", intro).group(1).split(", ")
        r2 = re.search(r"In Row 2, ([A-Z](?:, [A-Z])+) are seated", intro).group(1).split(", ")
        return Model("parallel", r1 + r2, a, rows=(r1, r2))
    names = names.group(1).split(", ")
    if sub.startswith("Linear"):
        fac = "mixed" if "Some of them face north" in intro else ("south" if "face south" in intro else "north")
        return Model("linear", names, a, facing=fac)
    if sub.startswith("Circular"):
        return Model("circle", names, a, facing=("mixed" if "face away" in intro else "in"))
    if sub == "Box stack":
        return Model("box", names, a)
    if sub == "Floor puzzle":
        return Model("floor", names, a)
    if sub.startswith("Floor + flat"):
        return Model("floorflat", names, a)
    if "scheduling" in sub:
        DAYS = {"January": 31, "February": 28, "March": 31, "April": 30, "May": 31, "June": 30, "July": 31, "August": 31, "September": 30, "October": 31, "November": 30, "December": 31}
        if sub.startswith("Month-date"):
            m = re.search(r"either (\d+)th or (\d+)th, of \w+ different months – ([^–]+) –", intro)
            d1, d2 = int(m.group(1)), int(m.group(2))
            months = [x.strip() for x in m.group(3).split(",")]
            slots = [dict(label=f"{mo} {d}", month=mo, days=DAYS[mo], date=d) for mo in months for d in (d1, d2)]
        elif sub.startswith("Month"):
            months = re.search(r"\(non-leap\): ([^.]+)\.", intro).group(1).split(", ")
            slots = [dict(label=mo, month=mo, days=DAYS[mo], date=None) for mo in months]
        else:
            ds = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            slots = [dict(label=d, month=d, days=None, date=None) for d in ds]
        return Model("schedule", names, a, slots=slots)
    raise ValueError(sub)


# ------------------------------------------------------------- semantics
class State:
    def __init__(self, M):
        self.M = M
        self.pos, self.face, self.holder = {}, {}, {}

    def who(self, e):
        if len(e) == 1:
            return e
        v = e.split()[-1]
        return self.holder.get(v)


def right_dir(M, S, p):
    if M.kind == "linear":
        f = S.face.get(p, "N" if M.facing != "south" else "S")
        return 1 if f == "N" else -1
    if M.kind == "circle":
        f = S.face.get(p, "in")
        return -1 if f == "in" else 1   # facing centre: right = anticlockwise
    if M.kind == "parallel":
        return -1 if p in M.rows[0] else 1


def compile_clue(M, text):
    """returns (persons_needed, attrs_needed, predicate(S)) ; raises if not understood"""
    t = text.strip()
    n = M.n
    ents = re.findall(ENT, t)

    def req(*es):
        P, A = set(), set()
        for e in es:
            if len(e) == 1:
                P.add(e)
            else:
                A.add(e.split()[-1])
        return P, A

    def need_face(*es):
        return M.kind in ("linear", "circle") and (M.facing == "mixed")

    m = re.fullmatch(rf"({ENT}) sits (?:(immediate) (left|right)|(\w+) to the (left|right)) of ({ENT})\.", t)
    if m and M.kind in ("linear", "circle", "parallel"):
        X, Y = m.group(1), m.group(6)
        k = 1 if m.group(2) else ORDW[m.group(4)]
        side = m.group(3) or m.group(5)

        def f(S, X=X, Y=Y, k=k, side=side):
            x, y = S.who(X), S.who(Y)
            d = right_dir(M, S, y) * (1 if side == "right" else -1)
            if M.kind == "circle":
                return S.pos[x] == (S.pos[y] + k * d) % n
            if M.kind == "parallel":
                return (x in M.rows[0]) == (y in M.rows[0]) and S.pos[x] == S.pos[y] + k * d
            return S.pos[x] == S.pos[y] + k * d
        return req(X, Y) + (f,)
    m = re.fullmatch(rf"The one who faces ({ENT}) sits (?:(immediate) (left|right)|(\w+) to the (left|right)) of ({ENT})\.", t)
    if m:
        X, Y = m.group(1), m.group(6)
        k = 1 if m.group(2) else ORDW[m.group(4)]
        side = m.group(3) or m.group(5)

        def f(S, X=X, Y=Y, k=k, side=side):
            x, y = S.who(X), S.who(Y)
            if (x in M.rows[0]) == (y in M.rows[0]):
                return False
            d = right_dir(M, S, y) * (1 if side == "right" else -1)
            return S.pos[x] == S.pos[y] + k * d
        return req(X, Y) + (f,)
    m = re.fullmatch(rf"Only (\w+) (?:person sits|persons sit) between ({ENT}) and ({ENT})( when counted from the left of ({ENT}))?\.", t)
    if m:
        g = NUMW[m.group(1).lower()]; X, Y = m.group(2), m.group(3)
        if m.group(4):
            def f(S, X=X, Y=Y, g=g):
                x, y = S.who(X), S.who(Y)
                ld = -right_dir(M, S, x)
                return ((S.pos[y] - S.pos[x]) * ld) % n == g + 1
        elif M.kind == "circle":
            def f(S, X=X, Y=Y, g=g):
                d = (S.pos[S.who(X)] - S.pos[S.who(Y)]) % n
                return d in (g + 1, n - g - 1)
        elif M.kind == "parallel":
            def f(S, X=X, Y=Y, g=g):
                x, y = S.who(X), S.who(Y)
                return (x in M.rows[0]) == (y in M.rows[0]) and abs(S.pos[x] - S.pos[y]) == g + 1
        else:
            def f(S, X=X, Y=Y, g=g):
                return abs(S.pos[S.who(X)] - S.pos[S.who(Y)]) == g + 1
        return req(X, Y) + (f,)
    m = re.fullmatch(rf"({ENT}) does not sit adjacent to ({ENT})\.", t) or re.fullmatch(rf"({ENT}) is not an immediate neighbour of ({ENT})\.", t)
    if m:
        X, Y = m.group(1), m.group(2)
        def f(S, X=X, Y=Y):
            d = abs(S.pos[S.who(X)] - S.pos[S.who(Y)])
            return d not in ((1, n - 1) if M.kind == "circle" else (1,))
        return req(X, Y) + (f,)
    m = re.fullmatch(rf"({ENT}) is an immediate neighbour of ({ENT})\.", t)
    if m:
        X, Y = m.group(1), m.group(2)
        return req(X, Y) + ((lambda S, X=X, Y=Y: (S.pos[S.who(X)] - S.pos[S.who(Y)]) % n in (1, n - 1)),)
    m = re.fullmatch(rf"({ENT}) sits opposite to ({ENT})\.", t)
    if m:
        X, Y = m.group(1), m.group(2)
        return req(X, Y) + ((lambda S, X=X, Y=Y: (S.pos[S.who(X)] - S.pos[S.who(Y)]) % n == n // 2),)
    m = re.fullmatch(rf"As many persons sit to the left of ({ENT}) as to the right of ({ENT})\.", t)
    if m:
        X, Y = m.group(1), m.group(2)
        def f(S, X=X, Y=Y):
            x, y = S.who(X), S.who(Y)
            lx = S.pos[x] if right_dir(M, S, x) == 1 else n - 1 - S.pos[x]
            ry = n - 1 - S.pos[y] if right_dir(M, S, y) == 1 else S.pos[y]
            return lx == ry
        return req(X, Y) + (f,)
    m = re.fullmatch(rf"({ENT}) and ({ENT}) face (the same direction|opposite directions)\.", t)
    if m:
        X, Y, same = m.group(1), m.group(2), m.group(3) == "the same direction"
        return req(X, Y) + ((lambda S, X=X, Y=Y, s=same: (S.face[S.who(X)] == S.face[S.who(Y)]) == s),)
    m = re.fullmatch(rf"({ENT}) faces (north|south|the centre|away from the centre)\.", t)
    if m:
        X = m.group(1); v = {"north": "N", "south": "S", "the centre": "in", "away from the centre": "out"}[m.group(2)]
        return req(X) + ((lambda S, X=X, v=v: S.face[S.who(X)] == v),)
    m = re.fullmatch(rf"({ENT}) faces ({ENT})\.", t)
    if m and M.kind == "parallel":
        X, Y = m.group(1), m.group(2)
        return req(X, Y) + ((lambda S, X=X, Y=Y: (S.who(X) in M.rows[0]) != (S.who(Y) in M.rows[0]) and S.pos[S.who(X)] == S.pos[S.who(Y)]),)
    m = re.fullmatch(rf"({ENT}) sits at (?:one of the extreme ends of the row|an extreme end of the row)\.", t)
    if m:
        X = m.group(1); last = (n // 2 - 1) if M.kind == "parallel" else n - 1
        return req(X) + ((lambda S, X=X, l=last: S.pos[S.who(X)] in (0, l)),)
    m = re.fullmatch(rf"({ENT}) does not sit at (?:any of the extreme ends|an extreme end of the row)\.", t)
    if m:
        X = m.group(1); last = (n // 2 - 1) if M.kind == "parallel" else n - 1
        return req(X) + ((lambda S, X=X, l=last: S.pos[S.who(X)] not in (0, l)),)
    m = re.fullmatch(rf"({ENT}) sits at the extreme (left|right) end of the row\.", t) or re.fullmatch(rf"({ENT}) sits (\w+) from the (left|right) end of the row\.", t)
    if m:
        X = m.group(1)
        if m.re.pattern.startswith("(") and "extreme" in t:
            k, side = 1, m.group(2)
        else:
            k, side = ORDW[m.group(2)], m.group(3)
        v = k - 1 if side == "left" else n - k
        return req(X) + ((lambda S, X=X, v=v: S.pos[S.who(X)] == v),)
    # ---------------- box / floor (stack)
    if M.kind in ("box", "floor"):
        # internal coordinate u: 0 = lowest
        B = "(?:[Bb]ox )?"
        m = re.fullmatch(rf"{B}({ENT}) (?:is kept|lives) immediately above {B}({ENT})\.", t)
        if m:
            X, Y = m.group(1), m.group(2)
            return req(X, Y) + ((lambda S, X=X, Y=Y: S.pos[S.who(X)] == S.pos[S.who(Y)] + 1),)
        m = re.fullmatch(rf"{B}({ENT}) (?:is kept|lives) (\w+) (?:boxes|floors) (above|below) {B}({ENT})\.", t)
        if m:
            X, k, d, Y = m.group(1), NUMW[m.group(2).lower()], m.group(3), m.group(4)
            s = 1 if d == "above" else -1
            return req(X, Y) + ((lambda S, X=X, Y=Y, k=k, s=s: S.pos[S.who(X)] == S.pos[S.who(Y)] + s * k),)
        m = re.fullmatch(rf"Only (\w+) (?:box is|boxes are|floor is|floors are) (?:kept )?between {B}({ENT}) and {B}({ENT})\.", t)
        if m:
            g, X, Y = NUMW[m.group(1).lower()], m.group(2), m.group(3)
            return req(X, Y) + ((lambda S, X=X, Y=Y, g=g: abs(S.pos[S.who(X)] - S.pos[S.who(Y)]) == g + 1),)
        m = re.fullmatch(rf"The number of boxes kept above {B}({ENT}) is the same as the number of boxes kept below {B}({ENT})\.", t) or re.fullmatch(rf"As many persons live above ({ENT}) as below ({ENT})\.", t)
        if m:
            X, Y = m.group(1), m.group(2)
            return req(X, Y) + ((lambda S, X=X, Y=Y: (n - 1 - S.pos[S.who(X)]) == S.pos[S.who(Y)]),)
        m = re.fullmatch(rf"{B}({ENT}) is not kept adjacent to {B}({ENT})\.", t) or re.fullmatch(rf"({ENT}) does not live on a floor adjacent to ({ENT})'s floor\.", t)
        if m:
            X, Y = m.group(1), m.group(2)
            return req(X, Y) + ((lambda S, X=X, Y=Y: abs(S.pos[S.who(X)] - S.pos[S.who(Y)]) != 1),)
        m = re.fullmatch(rf"{B}({ENT}) is kept somewhere above {B}({ENT})\.", t) or re.fullmatch(rf"({ENT}) lives on a floor above ({ENT})\.", t)
        if m:
            X, Y = m.group(1), m.group(2)
            return req(X, Y) + ((lambda S, X=X, Y=Y: S.pos[S.who(X)] > S.pos[S.who(Y)]),)
        m = re.fullmatch(rf"{B}({ENT}) is kept at the (top|bottom) of the stack\.", t) or re.fullmatch(rf"({ENT}) lives on the (topmost|lowermost) floor\.", t)
        if m:
            X = m.group(1); v = n - 1 if m.group(2) in ("top", "topmost") else 0
            return req(X) + ((lambda S, X=X, v=v: S.pos[S.who(X)] == v),)
        m = re.fullmatch(rf"{B}({ENT}) is kept at an? (odd|even) numbered position from the top\.", t)
        if m:
            X, r = m.group(1), 1 if m.group(2) == "odd" else 0
            return req(X) + ((lambda S, X=X, r=r: (n - S.pos[S.who(X)]) % 2 == r),)
        m = re.fullmatch(rf"({ENT}) lives on an? (odd|even) numbered floor\.", t)
        if m:
            X, r = m.group(1), 1 if m.group(2) == "odd" else 0
            return req(X) + ((lambda S, X=X, r=r: (S.pos[S.who(X)] + 1) % 2 == r),)
        m = re.fullmatch(rf"Only (\w+) (?:box is|boxes are) kept above {B}({ENT})\.", t)
        if m:
            k, X = NUMW[m.group(1).lower()], m.group(2)
            return req(X) + ((lambda S, X=X, k=k: n - 1 - S.pos[S.who(X)] == k),)
    if M.kind == "floorflat":
        fl = lambda S, p: S.pos[p] // 2
        ft = lambda S, p: S.pos[p] % 2
        m = re.fullmatch(rf"({ENT}) lives immediately above ({ENT})\.", t)
        if m:
            X, Y = m.group(1), m.group(2)
            return req(X, Y) + ((lambda S, X=X, Y=Y: ft(S, X) == ft(S, Y) and fl(S, X) == fl(S, Y) + 1),)
        m = re.fullmatch(rf"({ENT}) lives to the east of ({ENT})\.", t)
        if m:
            X, Y = m.group(1), m.group(2)
            return req(X, Y) + ((lambda S, X=X, Y=Y: fl(S, X) == fl(S, Y) and ft(S, X) == 1 and ft(S, Y) == 0),)
        m = re.fullmatch(rf"Only (\w+) (?:floor is|floors are) between the floors on which ({ENT}) and ({ENT}) live\.", t)
        if m:
            g, X, Y = NUMW[m.group(1).lower()], m.group(2), m.group(3)
            return req(X, Y) + ((lambda S, X=X, Y=Y, g=g: abs(fl(S, X) - fl(S, Y)) == g + 1),)
        m = re.fullmatch(rf"({ENT}) and ({ENT}) live in (the same type of flat|different types of flats)\.", t)
        if m:
            X, Y, same = m.group(1), m.group(2), m.group(3).startswith("the same")
            return req(X, Y) + ((lambda S, X=X, Y=Y, s=same: (ft(S, X) == ft(S, Y)) == s),)
        m = re.fullmatch(rf"({ENT}) lives on a floor above the floor of ({ENT})\.", t)
        if m:
            X, Y = m.group(1), m.group(2)
            return req(X, Y) + ((lambda S, X=X, Y=Y: fl(S, X) > fl(S, Y)),)
        m = re.fullmatch(rf"({ENT}) lives on an? (odd|even) numbered floor\.", t)
        if m:
            X, r = m.group(1), 1 if m.group(2) == "odd" else 0
            return req(X) + ((lambda S, X=X, r=r: (fl(S, X) + 1) % 2 == r),)
        m = re.fullmatch(rf"No one lives to the (west|east) of ({ENT})\.", t)
        if m:
            v, X = (0 if m.group(1) == "west" else 1), m.group(2)
            return req(X) + ((lambda S, X=X, v=v: ft(S, X) == v),)
        m = re.fullmatch(rf"({ENT}) lives on the topmost floor\.", t)
        if m:
            X = m.group(1)
            return req(X) + ((lambda S, X=X: fl(S, X) == n // 2 - 1),)
    if M.kind == "schedule":
        sl = M.slots
        m = re.fullmatch(rf"({ENT}) attends immediately before ({ENT})\.", t)
        if m:
            X, Y = m.group(1), m.group(2)
            return req(X, Y) + ((lambda S, X=X, Y=Y: S.pos[S.who(Y)] - S.pos[S.who(X)] == 1),)
        m = re.fullmatch(rf"Only (\w+) (?:person attends|persons attend) between ({ENT}) and ({ENT}), and ({ENT}) attends before ({ENT})\.", t)
        if m:
            g, X, Y = NUMW[m.group(1).lower()], m.group(2), m.group(3)
            return req(X, Y) + ((lambda S, X=X, Y=Y, g=g: S.pos[S.who(Y)] - S.pos[S.who(X)] == g + 1),)
        m = re.fullmatch(rf"Only (\w+) (?:person attends|persons attend) between ({ENT}) and ({ENT})\.", t)
        if m:
            g, X, Y = NUMW[m.group(1).lower()], m.group(2), m.group(3)
            return req(X, Y) + ((lambda S, X=X, Y=Y, g=g: abs(S.pos[S.who(Y)] - S.pos[S.who(X)]) == g + 1),)
        m = re.fullmatch(rf"({ENT}) and ({ENT}) attend in the same month\.", t)
        if m:
            X, Y = m.group(1), m.group(2)
            return req(X, Y) + ((lambda S, X=X, Y=Y: sl[S.pos[S.who(X)]]["month"] == sl[S.pos[S.who(Y)]]["month"]),)
        m = re.fullmatch(rf"As many persons attend before ({ENT}) as after ({ENT})\.", t)
        if m:
            X, Y = m.group(1), m.group(2)
            return req(X, Y) + ((lambda S, X=X, Y=Y: S.pos[S.who(X)] == n - 1 - S.pos[S.who(Y)]),)
        m = re.fullmatch(rf"({ENT}) attends some time before ({ENT})\.", t)
        if m:
            X, Y = m.group(1), m.group(2)
            return req(X, Y) + ((lambda S, X=X, Y=Y: S.pos[S.who(X)] < S.pos[S.who(Y)]),)
        m = re.fullmatch(rf"({ENT}) attends in a month which has fewer than 31 days\.", t)
        if m:
            X = m.group(1)
            return req(X) + ((lambda S, X=X: sl[S.pos[S.who(X)]]["days"] < 31),)
        m = re.fullmatch(rf"({ENT}) attends in a month having 31 days\.", t)
        if m:
            X = m.group(1)
            return req(X) + ((lambda S, X=X: sl[S.pos[S.who(X)]]["days"] == 31),)
        m = re.fullmatch(rf"({ENT}) attends on an (odd|even) numbered date( of a month having an even number of days)?\.", t)
        if m:
            X, r, ev = m.group(1), 1 if m.group(2) == "odd" else 0, bool(m.group(3))
            return req(X) + ((lambda S, X=X, r=r, ev=ev: sl[S.pos[S.who(X)]]["date"] % 2 == r and (not ev or sl[S.pos[S.who(X)]]["days"] % 2 == 0)),)
        m = re.fullmatch(rf"No one attends before ({ENT})\.", t)
        if m:
            X = m.group(1)
            return req(X) + ((lambda S, X=X: S.pos[S.who(X)] == 0),)
        m = re.fullmatch(rf"({ENT}) attends last\.", t)
        if m:
            X = m.group(1)
            return req(X) + ((lambda S, X=X: S.pos[S.who(X)] == n - 1),)
        m = re.fullmatch(rf"({ENT}) attends on (\w+)\.", t)
        if m:
            X, d = m.group(1), m.group(2)
            return req(X) + ((lambda S, X=X, d=d: sl[S.pos[S.who(X)]]["label"] == d),)
        m = re.fullmatch(rf"Only (\w+) (?:person attends|persons attend) before ({ENT})\.", t)
        if m:
            k, X = NUMW[m.group(1).lower()], m.group(2)
            return req(X) + ((lambda S, X=X, k=k: S.pos[S.who(X)] == k),)
    # attribute direct / negative
    m = re.fullmatch(r"([A-Z]) (?:likes|belongs to|owns|teaches|plays) ([A-Za-z]+)\.", t)
    if m:
        P, v = m.group(1), m.group(2)
        return ({P}, {v}, (lambda S, P=P, v=v: S.holder[v] == P))
    m = re.fullmatch(r"([A-Z]) does not (?:like|belong to|own|teach|play) ([A-Za-z]+) or ([A-Za-z]+)\.", t)
    if m:
        P, v1, v2 = m.groups()
        return ({P}, {v1, v2}, (lambda S, P=P, a=v1, b=v2: S.holder[a] != P and S.holder[b] != P))
    raise ValueError("UNPARSED: " + t)


def solve(M, clues, limit=2):
    comp = [compile_clue(M, c) for c in clues]
    S = State(M)
    names = M.names
    n = M.n
    sols = []
    mixed = M.facing == "mixed" and M.kind in ("linear", "circle")
    faces = (["N", "S"] if M.kind == "linear" else ["in", "out"]) if mixed else [None]
    # position domains
    if M.kind == "parallel":
        m_ = n // 2
        dom = {p: list(range(m_)) for p in names}
    elif M.kind == "floorflat":
        dom = {p: list(range(n)) for p in names}
    else:
        dom = {p: list(range(n)) for p in names}
    if M.kind == "circle":
        dom[names[0]] = [0]
    attrs = M.attrs

    def ok_partial():
        for P, A, f in comp:
            if all(p in S.pos for p in P) and all(a in S.holder for a in A):
                # attribute entities resolve to persons who must be placed (always true once all persons placed)
                try:
                    if not f(S):
                        return False
                except KeyError:
                    continue
        return True

    def used(v, p):
        if M.kind == "parallel":
            row = 0 if p in M.rows[0] else 1
            return any(S.pos[q] == v and ((0 if q in M.rows[0] else 1) == row) for q in S.pos)
        return v in S.pos.values()

    def rec_attr(i):
        if len(sols) >= limit:
            return
        if i == len(attrs):
            sols.append((dict(S.pos), dict(S.face), dict(S.holder)))
            return
        a = attrs[i]
        for p in names:
            if p in S.holder.values():
                continue
            S.holder[a] = p
            if ok_partial():
                rec_attr(i + 1)
            del S.holder[a]

    def rec(i):
        if len(sols) >= limit:
            return
        if i == len(names):
            if mixed and sum(1 for p in names if S.face[p] in ("N", "in")) != n // 2:
                return
            rec_attr(0)
            return
        p = names[i]
        for v in dom[p]:
            if used(v, p):
                continue
            for fc in faces:
                S.pos[p] = v
                if fc:
                    S.face[p] = fc
                if ok_partial():
                    rec(i + 1)
                del S.pos[p]
                if fc:
                    del S.face[p]
    rec(0)
    return sols


def claimed(M, vis):
    """published solution -> (pos, face, holder) in verifier coordinates"""
    pos, face, holder = {}, {}, {}
    ty = vis["type"]
    if ty == "linear":
        for i, s in enumerate(vis["seats"]):
            pos[s["name"]] = i
            if s.get("face"):
                face[s["name"]] = s["face"]
            if s.get("attr"):
                holder[s["attr"]] = s["name"]
    elif ty == "circle":
        seats = vis["seats"]
        k = [s["name"] for s in seats].index(M.names[0])
        n = len(seats)
        for i, s in enumerate(seats):
            pos[s["name"]] = (i - k) % n
            face[s["name"]] = s["face"]
            if s.get("attr"):
                holder[s["attr"]] = s["name"]
        if M.facing != "mixed":
            face = {}
    elif ty == "stack":
        lv = vis["levels"]  # top first
        n = len(lv)
        for i, l in enumerate(lv):
            pos[l["name"]] = n - 1 - i
            if l.get("attr"):
                holder[l["attr"]] = l["name"]
    elif ty == "schedule":
        for i, r in enumerate(vis["rows"]):
            pos[r["name"]] = i
            if r.get("attr"):
                holder[r["attr"]] = r["name"]
    elif ty == "floorflat":
        for f in vis["floors"]:
            pos[f["P"]] = 2 * (f["floor"] - 1); pos[f["Q"]] = 2 * (f["floor"] - 1) + 1
    elif ty == "parallel":
        for i, x in enumerate(vis["row1"]):
            pos[x] = i
        for i, x in enumerate(vis["row2"]):
            pos[x] = i
    return pos, face, holder


def check_question(M, sol, q):
    """recompute answers of common question types; returns True/False/None (not covered)"""
    pos, face, holder = sol
    S = State(M); S.pos, S.face, S.holder = pos, face, holder
    inv_holder = {v: k for k, v in holder.items()}
    ans = q["options"][q["ans"]]
    st = q["stem"]
    n = M.n
    m = re.fullmatch(rf"Who (?:among the following )?sits (?:(immediate) (left|right)|(\w+) to the (left|right)) of ({ENT})\?", st)
    if m and M.kind in ("linear", "circle", "parallel"):
        k = 1 if m.group(1) else ORDW[m.group(3)]; side = m.group(2) or m.group(4)
        y = S.who(m.group(5)) if len(m.group(5)) == 1 else S.who(m.group(5))
        d = right_dir(M, S, y) * (1 if side == "right" else -1)
        target = (pos[y] + k * d) % n if M.kind == "circle" else pos[y] + k * d
        cands = [p for p in M.names if pos[p] == target and (M.kind != "parallel" or (p in M.rows[0]) == (y in M.rows[0]))]
        return cands == [ans]
    m = re.fullmatch(rf"How many persons sit between ([A-Z]) and ([A-Z])( when counted from the left of [A-Z])?\?", st)
    if m:
        x, y = m.group(1), m.group(2)
        if m.group(3):
            g = ((pos[y] - pos[x]) * (-right_dir(M, S, x))) % n - 1
        else:
            g = abs(pos[x] - pos[y]) - 1
        return NUMW[ans.lower()] == g
    m = re.fullmatch(r"What is the position of ([A-Z]) with respect to ([A-Z])\?", st)
    if m:
        x, y = m.group(1), m.group(2)
        mm = re.fullmatch(r"(Immediate|\w+)(?: to the)? (left|right)", ans)
        k = 1 if mm.group(1) == "Immediate" else ORDW[mm.group(1).lower()]
        d = right_dir(M, S, y) * (1 if mm.group(2) == "right" else -1)
        return (pos[x] == ((pos[y] + k * d) % n if M.kind == "circle" else pos[y] + k * d))
    m = re.fullmatch(r"Which box is kept (immediately|\w+ boxes) (above|below) box ([A-Z])\?", st) or re.fullmatch(r"Who lives (immediately|\w+ floors) (above|below) ([A-Z])\?", st)
    if m and M.kind in ("box", "floor"):
        k = 1 if m.group(1) == "immediately" else NUMW[m.group(1).split()[0].lower()]
        s = 1 if m.group(2) == "above" else -1
        return pos[ans] == pos[m.group(3)] + s * k
    m = re.fullmatch(r"How many boxes are kept between box ([A-Z]) and box ([A-Z])\?", st) or re.fullmatch(r"How many persons live between ([A-Z]) and ([A-Z])\?", st)
    if m:
        return NUMW[ans.lower()] == abs(pos[m.group(1)] - pos[m.group(2)]) - 1
    m = re.fullmatch(r"How many boxes are kept above box ([A-Z])\?", st) or re.fullmatch(r"How many persons live above ([A-Z])\?", st)
    if m and M.kind in ("box", "floor"):
        return NUMW[ans.lower()] == n - 1 - pos[m.group(1)]
    m = re.fullmatch(r"Who among the following attends (?:on|in) ([A-Za-z]+(?: \d+)?)\?", st)
    if m:
        lab = m.group(1)
        return M.slots[pos[ans]]["label"] == lab
    m = re.fullmatch(r"How many persons attend between ([A-Z]) and ([A-Z])\?", st)
    if m:
        return NUMW[ans.lower()] == abs(pos[m.group(1)] - pos[m.group(2)]) - 1
    m = re.fullmatch(r"Who attends immediately (before|after) ([A-Z])\?", st)
    if m:
        return pos[ans] == pos[m.group(2)] + (-1 if m.group(1) == "before" else 1)
    m = re.fullmatch(r"On which floor and in which flat does ([A-Z]) live\?", st)
    if m:
        p = pos[m.group(1)]
        return ans == f"Floor {p // 2 + 1}, {'Flat-X' if p % 2 == 0 else 'Flat-Y'}"
    m = re.fullmatch(r"Who lives immediately below ([A-Z])\?", st)
    if m and M.kind == "floorflat":
        return pos[ans] == pos[m.group(1)] - 2
    m = re.fullmatch(r"Who faces ([A-Z])\?", st)
    if m:
        x = m.group(1)
        return pos[ans] == pos[x] and (ans in M.rows[0]) != (x in M.rows[0])
    m = re.fullmatch(r"Which (?:of the following does|colour does|fruit does|car does|subject does|sport does) ([A-Z]) (?:like|own|teach|play|belong to)\?|To which city does ([A-Z]) belong\?", st)
    if m and holder:
        p = m.group(1) or m.group(2)
        return holder.get(ans) == p
    return None


def main(files):
    stats = collections.Counter()
    problems = []
    for f in files:
        mk = json.load(open(f))
        allq = []
        for sec in mk["sections"]:
            for b in sec["blocks"]:
                for q in b["qs"]:
                    allq.append(q)
                    if len(q["options"]) != 5 or len(set(q["options"])) != 5:
                        problems.append((q["id"], "options not 5 distinct"))
                    if not 0 <= q["ans"] < 5:
                        problems.append((q["id"], "bad answer index"))
                if b.get("topic") == "Puzzle":
                    M = parse_intro(b)
                    try:
                        sols = solve(M, b["clues"])
                    except ValueError as e:
                        problems.append((b["id"], str(e))); continue
                    stats["puzzles"] += 1
                    if len(sols) != 1:
                        problems.append((b["id"], f"{len(sols)} solutions")); continue
                    cl = claimed(M, b["visual"])
                    got = sols[0]
                    same = got[0] == cl[0] and (not M.attrs or got[2] == cl[2]) and (M.facing != "mixed" or got[1] == cl[1])
                    if not same:
                        problems.append((b["id"], "solution differs from published")); continue
                    stats["puzzles_ok"] += 1
                    for q in b["qs"]:
                        r = check_question(M, got, q)
                        if r is None:
                            stats["q_unchecked"] += 1
                        elif r:
                            stats["q_ok"] += 1
                        else:
                            problems.append((q["id"], "answer mismatch: " + q["stem"][:80]))
        if len(allq) != 80:
            problems.append((f, f"{len(allq)} questions"))
        stats["questions"] += len(allq)
        stats.update("ans_" + q["answer"] for q in allq)
    return stats, problems


if __name__ == "__main__":
    st, pr = main(sorted(glob.glob(sys.argv[1])))
    print(dict(st))
    print(len(pr), "problems")
    for p in pr[:60]:
        print(p)


# ===================================================================== extra independent checks
import math as _m


def check_ineq(q):
    st = q["stem"]
    stmt = re.search(r"Statement: (.+)", st).group(1)
    c1 = re.search(r"\nI\. (.+)", st).group(1); c2 = re.search(r"\nII\. (.+)", st).group(1)
    edges = []
    for part in stmt.split(";"):
        toks = part.split()
        for i in range(0, len(toks) - 2, 2):
            edges.append((toks[i], toks[i + 1], toks[i + 2]))
    letters = sorted(set([e[0] for e in edges] + [e[2] for e in edges]))
    OPS = {">": lambda a, b: a > b, "<": lambda a, b: a < b, "≥": lambda a, b: a >= b, "≤": lambda a, b: a <= b, "=": lambda a, b: a == b}
    models = []
    val = {}
    k = len(letters)

    def rec(i):
        if i == k:
            models.append(dict(val)); return
        for v in range(k):
            val[letters[i]] = v
            if all(OPS[o](val[a], val[b]) for a, o, b in edges if a in val and b in val):
                rec(i + 1)
            del val[letters[i]]
    rec(0)

    def evalc(c):
        a, o, b = c.split()
        holds = all(OPS[o](m[a], m[b]) for m in models)
        if holds and o in ("≥", "≤"):
            # IBPS convention: '≥' must not actually be strict in every model
            holds = any(m[a] == m[b] for m in models)
        return holds
    t1, t2 = evalc(c1), evalc(c2)
    if t1 and t2: exp = 4
    elif t1: exp = 0
    elif t2: exp = 1
    else:
        a1, o1, b1 = c1.split(); a2, o2, b2 = c2.split()
        both = all(OPS[o1](m[a1], m[b1]) or OPS[o2](m[a2], m[b2]) for m in models) and {a1, b1} == {a2, b2}
        exp = 2 if both else 3
    return exp == q["ans"]


def approx_eval(expr, x):
    e = expr.replace("×", "*").replace("÷", "/").replace("−", "-").replace("²", "**2").replace("³", "**3")
    e = re.sub(r"(\d+(?:\.\d+)?)/(\d+) of ", r"(\1/\2)*", e)
    e = re.sub(r"(\d+(?:\.\d+)?|\?)% of ", r"(\1/100)*", e)
    e = re.sub(r"√(\d+(?:\.\d+)?|\([^)]*\))", r"_sqrt(\1)", e)
    e = re.sub(r"∛(\d+(?:\.\d+)?)", r"_cbrt(\1)", e)
    e = e.replace("?", f"({x})").replace("⁻¹", "**-1")
    l, r = e.split("=")
    env = dict(_sqrt=_m.sqrt, _cbrt=lambda v: v ** (1 / 3))
    return eval(l, env) - eval(r, env)


def check_approx(q):
    expr = q["stem"].split("\n")[1]
    res = []
    for o in q["options"]:
        try:
            res.append(abs(approx_eval(expr, float(o.replace(",", "")))))
        except Exception as ex:
            return None
    best = min(range(5), key=lambda i: res[i])
    return best == q["ans"]


def check_quad(q):
    lines = q["stem"].split("\n")
    def roots(line, v):
        eq = line.split(". ", 1)[1].replace("−", "-").replace("²", "**2")
        lhs, rhs = eq.split("=")
        f = lambda z: eval(lhs.replace(v, f"*({z})").replace("(*", "(").lstrip("*") if False else lhs.replace(v, f"({z})"), {}) - eval(rhs, {})
        # numeric polynomial: sample 3 points to get coefficients
        import numpy as np
        xs = [-1.0, 0.0, 1.0]
        def fz(z):
            s = re.sub(r"(\d)\(", r"\1*(", lhs.replace(v, f"({z})"))
            return eval(s, {}) - eval(rhs, {})
        y = [fz(z) for z in xs]
        a = (y[0] + y[2] - 2 * y[1]) / 2; b = (y[2] - y[0]) / 2; c = y[1]
        r = np.roots([a, b, c])
        return [float(x.real) for x in r]
    xs = roots(lines[1], "x"); ys = roots(lines[2], "y")
    eps = 1e-9
    if min(xs) > max(ys) + eps: exp = 0
    elif min(xs) >= max(ys) - eps: exp = 1
    elif max(xs) < min(ys) - eps: exp = 3
    elif max(xs) <= min(ys) + eps: exp = 4
    else: exp = 2
    return exp == q["ans"]


def check_statements(M, sol, q):
    if not q["stem"].startswith("Which of the following statements is/are true"):
        return None
    pos, face, holder = sol
    S = State(M); S.pos, S.face, S.holder = pos, face, holder
    sts = re.findall(r"\n(I|II|III)\. (.+)", q["stem"])
    truths = []
    for _, s in sts:
        s2 = s
        try:
            P, A, f = compile_clue(M, s2)
            truths.append(bool(f(S)))
            continue
        except ValueError:
            pass
        n = M.n
        m = re.fullmatch(r"([A-Z]) and ([A-Z]) are immediate neighbours\.", s2)
        if m:
            truths.append((pos[m.group(1)] - pos[m.group(2)]) % n in (1, n - 1)); continue
        m = re.fullmatch(r"Box ([A-Z]) is kept above box ([A-Z])\.", s2) or re.fullmatch(r"([A-Z]) lives above ([A-Z])\.", s2)
        if m:
            truths.append(pos[m.group(1)] > pos[m.group(2)]); continue
        m = re.fullmatch(r"([A-Z]) attends on (.+)\.", s2)
        if m:
            truths.append(M.slots[pos[m.group(1)]]["label"] == m.group(2)); continue
        m = re.fullmatch(r"Only (\w+) (?:person lives|persons live) between ([A-Z]) and ([A-Z])\.", s2)
        if m:
            truths.append(abs(pos[m.group(2)] - pos[m.group(3)]) - 1 == NUMW[m.group(1).lower()]); continue
        return None
    tset = tuple(i for i, v in enumerate(truths) if v)
    names = {(): "None is true", (0,): "Only I", (1,): "Only II", (2,): "Only III", (0, 1): "Only I and II", (1, 2): "Only II and III", (0, 2): "Only I and III", (0, 1, 2): "All I, II and III"}
    return names[tset] == q["options"][q["ans"]]


def main2(files):
    st = collections.Counter(); pr = []
    for f in files:
        mk = json.load(open(f))
        for sec in mk["sections"]:
            for b in sec["blocks"]:
                M = parse_intro(b) if b.get("topic") == "Puzzle" else None
                sol = None
                if M:
                    sol = claimed(M, b["visual"])
                for q in b["qs"]:
                    r = None
                    if q["topic"] == "Inequality":
                        r = check_ineq(q); k = "ineq"
                    elif q["topic"] == "Approximation":
                        r = check_approx(q); k = "approx"
                    elif q["topic"] == "Quadratic equations":
                        r = check_quad(q); k = "quad"
                    elif M:
                        r = check_statements(M, sol, q); k = "stmt"
                    if r is None:
                        continue
                    st[k + ("_ok" if r else "_BAD")] += 1
                    if not r:
                        pr.append((q["id"], k, q["stem"][:160], q["options"], q["answer"]))
    return st, pr


if __name__ == "__main__" and len(sys.argv) > 2 and sys.argv[2] == "extra":
    st, pr = main2(sorted(glob.glob(sys.argv[1])))
    print(dict(st)); print(len(pr), "problems")
    for p in pr[:30]:
        print(p)
