"""Puzzle engine: random hidden solution -> true clues -> greedy + minimise until the
solution is unique over the full candidate space (vectorised with numpy) -> 5 questions.
"""
import itertools, random, math
import numpy as np
from util import *

_PERM = {}


def perms(n):
    if n not in _PERM:
        _PERM[n] = np.array(list(itertools.permutations(range(n))), dtype=np.int8)
    return _PERM[n]


def combos_faces(n, k):
    rows = []
    for c in itertools.combinations(range(n), k):
        r = np.zeros(n, dtype=np.int8); r[list(c)] = 1; rows.append(r)
    return np.array(rows, dtype=np.int8)


def kword(k):
    return "immediate" if k == 1 else ORD[k]


# ---------------------------------------------------------------- base
class Layout:
    kind = "base"
    has_face = False
    noun = "persons"

    def __init__(self, names, rng, **kw):
        self.names = names
        self.n = len(names)
        self.rng = rng
        self.kw = kw

    # candidate space
    def space(self):
        raise NotImplementedError

    def nm(self, e):
        """entity -> text. e = ('p', i) or ('a', j)."""
        if e[0] == 'p':
            return self.names[e[1]]
        return "the one who " + ATTR_THE[self.attr_kind].format(self.attr_vals[e[1]])

    def Nm(self, e):
        s = self.nm(e)
        return s[0].upper() + s[1:]


# ---------------------------------------------------------------- generic driver
class Ctx:
    """Holds candidate arrays for the current phase and resolves entities to arrays."""

    def __init__(self, P, F=None, P0=None, F0=None, A=None):
        self.P, self.F, self.P0, self.F0, self.A = P, F, P0, F0, A

    @property
    def N(self):
        return (self.P if self.A is None else self.A).shape[0]

    def take(self, idx):
        if self.A is None:
            return Ctx(self.P[idx], None if self.F is None else self.F[idx])
        return Ctx(None, None, self.P0, self.F0, self.A[idx])

    def pos(self, e):
        if self.A is None:
            return self.P[:, e[1]].astype(np.int16)
        if e[0] == 'p':
            return np.full(self.N, self.P0[e[1]], dtype=np.int16)
        return self.P0[self.A[:, e[1]]].astype(np.int16)

    def face(self, e):
        if self.A is None:
            if self.F is None:
                return np.zeros(self.N, dtype=np.int16)
            return self.F[:, e[1]].astype(np.int16)
        if self.F0 is None:
            return np.zeros(self.N, dtype=np.int16)
        if e[0] == 'p':
            return np.full(self.N, self.F0[e[1]], dtype=np.int16)
        return self.F0[self.A[:, e[1]]].astype(np.int16)


def solve_unique(layout, ctx_full, true_clues, rng, max_clues=14, weights=None):
    """Greedy pick clues until unique, then drop redundant ones. Returns chosen clue list or None."""
    N = ctx_full.N
    alive = np.arange(N)
    chosen = []
    pool = list(true_clues)
    rng.shuffle(pool)
    if weights:
        pool.sort(key=lambda c: -weights.get(c['type'], 1.0) * rng.random())
    tries = 0
    seen = set()
    import re as _re
    while len(alive) > 1 and pool and tries < 400:
        tries += 1
        c = pool.pop(0)
        toks = frozenset(_re.findall(r"\b[A-Z][a-z]*\b", c['text'])) - {"The", "Only", "No", "As", "All"}
        key = (c['type'] if c['type'] not in ("kth", "kabove") else "rel", toks)
        if key in seen:
            continue
        sub = ctx_full.take(alive)
        m = c['fn'](sub)
        if m.all():
            continue
        if not m.any():
            raise AssertionError("true clue eliminated the solution: " + c['text'])
        alive = alive[m]
        chosen.append(c)
        seen.add(key)
    if len(alive) != 1:
        return None
    # full masks for minimisation
    masks = [c['fn'](ctx_full) for c in chosen]
    order = list(range(len(chosen)))
    rng.shuffle(order)
    keep = set(range(len(chosen)))
    for i in order:
        trial = keep - {i}
        if not trial:
            continue
        m = np.ones(N, dtype=bool)
        for j in trial:
            m &= masks[j]
        if m.sum() == 1:
            keep = trial
    final = [chosen[i] for i in sorted(keep)]
    if len(final) > max_clues:
        return None
    return final


# ---------------------------------------------------------------- LINEAR
class Linear(Layout):
    kind = "linear"

    def __init__(self, names, rng, facing="north", **kw):
        super().__init__(names, rng, **kw)
        self.facing = facing  # north | south | mixed
        self.has_face = facing == "mixed"

    def space(self):
        P = perms(self.n)
        if not self.has_face:
            return Ctx(P)
        Fc = combos_faces(self.n, self.n // 2)
        Pr = np.repeat(P, len(Fc), axis=0)
        Fr = np.tile(Fc, (len(P), 1))
        return Ctx(Pr, Fr)

    def rsign(self, f):  # +1 if this person's right is page-right
        if self.facing == "south":
            return -np.ones_like(f)
        return np.where(f == 0, 1, -1)

    def intro(self):
        n = self.n
        names = ", ".join(self.names)
        if self.facing == "mixed":
            fac = f"Some of them face north and some face south (exactly {numword(n//2).lower()} face north)."
        else:
            fac = f"All of them face {self.facing}."
        return f"{numword(n)} persons – {names} – are sitting in a straight row. {fac}"

    def clue_pool(self, sol, ents, attr_phase, rng):
        n = self.n
        pool = []
        P, F = sol['pos'], sol['face']

        def pe(e):
            return P[e[1]] if e[0] == 'p' else P[sol['who'][e[1]]]

        def fe(e):
            if not self.has_face:
                return 0
            return F[e[1]] if e[0] == 'p' else F[sol['who'][e[1]]]

        for X, Y in itertools.permutations(ents, 2):
            if attr_phase and X[0] == 'p' and Y[0] == 'p':
                continue
            px, py, fy = pe(X), pe(Y), fe(Y)
            rs = 1 if self.facing == "north" else (-1 if self.facing == "south" else (1 if fy == 0 else -1))
            d = (px - py) * rs  # +k => X is k-th to the right of Y
            if 1 <= abs(d) <= 4:
                k, side = abs(d), ("right" if d > 0 else "left")

                def f(c, X=X, Y=Y, k=k, side=side):
                    s = self.rsign(c.face(Y)) * (1 if side == "right" else -1)
                    return c.pos(X) == c.pos(Y) + k * s
                txt = f"{self.Nm(X)} sits {kword(k)} {'' if k == 1 else ''}to the {side} of {self.nm(Y)}." if k > 1 else f"{self.Nm(X)} sits immediate {side} of {self.nm(Y)}."
                txt = txt.replace("  ", " ")
                pool.append(dict(type="kth", text=txt, fn=f, w=1.0))
            if X < Y or attr_phase:
                gap = abs(px - py) - 1
                if 1 <= gap <= 4:
                    pool.append(dict(type="between", text=f"Only {numword(gap).lower()} {'person sits' if gap == 1 else 'persons sit'} between {self.nm(X)} and {self.nm(Y)}.",
                                     fn=lambda c, X=X, Y=Y, g=gap: np.abs(c.pos(X) - c.pos(Y)) == g + 1, w=1.3))
                if abs(px - py) == 1:
                    pass
                elif rng.random() < 0.3:
                    pool.append(dict(type="notnbr", text=f"{self.Nm(X)} does not sit adjacent to {self.nm(Y)}.",
                                     fn=lambda c, X=X, Y=Y: np.abs(c.pos(X) - c.pos(Y)) != 1, w=0.6))
                if self.facing == "north" and px == n - 1 - py and X != Y and rng.random() < 0.8:
                    pool.append(dict(type="mirror", text=f"As many persons sit to the left of {self.nm(X)} as to the right of {self.nm(Y)}.",
                                     fn=lambda c, X=X, Y=Y: c.pos(X) == n - 1 - c.pos(Y), w=1.4))
                if self.has_face and not attr_phase:
                    same = fe(X) == fe(Y)
                    pool.append(dict(type="relface", text=f"{self.Nm(X)} and {self.nm(Y)} face {'the same direction' if same else 'opposite directions'}.",
                                     fn=lambda c, X=X, Y=Y, s=same: (c.face(X) == c.face(Y)) == s, w=0.7))
        for X in ents:
            px = pe(X)
            if attr_phase and X[0] == 'p':
                continue
            if px in (0, n - 1):
                pool.append(dict(type="end", text=f"{self.Nm(X)} sits at one of the extreme ends of the row.",
                                 fn=lambda c, X=X: (c.pos(X) == 0) | (c.pos(X) == n - 1), w=0.8))
            else:
                pool.append(dict(type="notend", text=f"{self.Nm(X)} does not sit at any of the extreme ends.",
                                 fn=lambda c, X=X: (c.pos(X) != 0) & (c.pos(X) != n - 1), w=0.4))
            if self.facing == "north" and (px <= 3 or px >= n - 4):
                if px <= 3:
                    k, side, cond = px + 1, "left", (lambda c, X=X, v=px: c.pos(X) == v)
                else:
                    k, side, cond = n - px, "right", (lambda c, X=X, v=px: c.pos(X) == v)
                ftxt = f"{self.Nm(X)} sits at the extreme {side} end of the row." if k == 1 else f"{self.Nm(X)} sits {ORD[k]} from the {side} end of the row."
                pool.append(dict(type="fromend", text=ftxt, fn=cond, w=0.45))
            if self.has_face and not attr_phase:
                d = "north" if fe(X) == 0 else "south"
                pool.append(dict(type="face", text=f"{self.Nm(X)} faces {d}.", fn=lambda c, X=X, v=fe(X): c.face(X) == v, w=0.5))
        if attr_phase:
            pool += attr_direct_clues(self, sol, rng)
        return pool

    # --- question helpers on the solution
    def at(self, sol, X, k, side):
        p = sol['pos'][X]
        rs = 1 if self.facing == "north" else (-1 if self.facing == "south" else (1 if sol['face'][X] == 0 else -1))
        q = p + k * rs * (1 if side == "right" else -1)
        if 0 <= q < self.n:
            return sol['inv'][q]
        return None

    def rel(self, sol, X, Y):
        """position of X with respect to Y"""
        p, q = sol['pos'][X], sol['pos'][Y]
        rs = 1 if self.facing == "north" else (-1 if self.facing == "south" else (1 if sol['face'][Y] == 0 else -1))
        d = (p - q) * rs
        return (abs(d), "right" if d > 0 else "left")

    def between(self, sol, X, Y):
        return abs(sol['pos'][X] - sol['pos'][Y]) - 1


# ---------------------------------------------------------------- CIRCLE
class Circle(Layout):
    kind = "circle"

    def __init__(self, names, rng, facing="in", **kw):
        super().__init__(names, rng, **kw)
        self.facing = facing  # in | mixed
        self.has_face = facing == "mixed"

    def space(self):
        n = self.n
        p = perms(n - 1) + 1
        P = np.concatenate([np.zeros((len(p), 1), dtype=np.int8), p], axis=1)
        if not self.has_face:
            return Ctx(P)
        Fc = combos_faces(n, n // 2)
        return Ctx(np.repeat(P, len(Fc), axis=0), np.tile(Fc, (len(P), 1)))

    def intro(self):
        names = ", ".join(self.names)
        if self.has_face:
            return f"{numword(self.n)} persons – {names} – are sitting around a circular table. {numword(self.n//2)} of them face the centre and the rest face away from the centre."
        return f"{numword(self.n)} persons – {names} – are sitting around a circular table facing the centre."

    def ldir(self, f):  # +1 (clockwise) is LEFT for a centre-facing person
        return np.where(f == 0, 1, -1)

    def clue_pool(self, sol, ents, attr_phase, rng):
        n = self.n
        P, F = sol['pos'], sol['face']
        pool = []

        def pe(e):
            return P[e[1]] if e[0] == 'p' else P[sol['who'][e[1]]]

        def fe(e):
            if not self.has_face:
                return 0
            return F[e[1]] if e[0] == 'p' else F[sol['who'][e[1]]]

        for X, Y in itertools.permutations(ents, 2):
            if attr_phase and X[0] == 'p' and Y[0] == 'p':
                continue
            px, py, fy = pe(X), pe(Y), fe(Y)
            ld = 1 if fy == 0 else -1
            dl = ((px - py) * ld) % n  # X is dl-th to the LEFT of Y
            for k, side in ((dl, "left"), (n - dl, "right")):
                if 1 <= k <= 3:
                    def f(c, X=X, Y=Y, k=k, side=side):
                        s = self.ldir(c.face(Y)) * (1 if side == "left" else -1)
                        return c.pos(X) == (c.pos(Y) + k * s) % n
                    txt = f"{self.Nm(X)} sits {ORD[k]} to the {side} of {self.nm(Y)}." if k > 1 else f"{self.Nm(X)} sits immediate {side} of {self.nm(Y)}."
                    pool.append(dict(type="kth", text=txt, fn=f, w=1.0))
            d = (px - py) % n
            if X < Y or attr_phase:
                if n % 2 == 0 and d == n // 2:
                    pool.append(dict(type="opp", text=f"{self.Nm(X)} sits opposite to {self.nm(Y)}.", fn=lambda c, X=X, Y=Y: (c.pos(X) - c.pos(Y)) % n == n // 2, w=1.1))
                gap = min(d, n - d) - 1
                if 1 <= gap <= 2 and d != n // 2:
                    pool.append(dict(type="between", text=f"Only {numword(gap).lower()} {'person sits' if gap == 1 else 'persons sit'} between {self.nm(X)} and {self.nm(Y)}.",
                                     fn=lambda c, X=X, Y=Y, g=gap: np.isin((c.pos(X) - c.pos(Y)) % n, [g + 1, n - g - 1]), w=0.9))
                if gap >= 1 and rng.random() < 0.25:
                    pool.append(dict(type="notnbr", text=f"{self.Nm(X)} is not an immediate neighbour of {self.nm(Y)}.",
                                     fn=lambda c, X=X, Y=Y: ~np.isin((c.pos(X) - c.pos(Y)) % n, [1, n - 1]), w=0.5))
                if gap == 0:
                    pool.append(dict(type="nbr", text=f"{self.Nm(X)} is an immediate neighbour of {self.nm(Y)}.",
                                     fn=lambda c, X=X, Y=Y: np.isin((c.pos(X) - c.pos(Y)) % n, [1, n - 1]), w=0.6))
                if self.has_face and not attr_phase:
                    same = fe(X) == fe(Y)
                    pool.append(dict(type="relface", text=f"{self.Nm(X)} and {self.nm(Y)} face {'the same direction' if same else 'opposite directions'}.",
                                     fn=lambda c, X=X, Y=Y, s=same: (c.face(X) == c.face(Y)) == s, w=0.8))
            # counted from the left of X
            fx = fe(X)
            ldx = 1 if fx == 0 else -1
            g = ((py - px) * ldx) % n - 1
            if 1 <= g <= 3 and rng.random() < 0.5:
                pool.append(dict(type="betweenL", text=f"Only {numword(g).lower()} {'person sits' if g == 1 else 'persons sit'} between {self.nm(X)} and {self.nm(Y)} when counted from the left of {self.nm(X)}.",
                                 fn=lambda c, X=X, Y=Y, g=g: ((c.pos(Y) - c.pos(X)) * self.ldir(c.face(X))) % n == g + 1, w=1.0))
        if self.has_face and not attr_phase:
            for X in ents:
                v = fe(X)
                pool.append(dict(type="face", text=f"{self.Nm(X)} faces {'the centre' if v == 0 else 'away from the centre'}.", fn=lambda c, X=X, v=v: c.face(X) == v, w=0.55))
        if attr_phase:
            pool += attr_direct_clues(self, sol, rng)
        return pool

    def at(self, sol, X, k, side):
        ld = 1 if (not self.has_face or sol['face'][X] == 0) else -1
        s = ld * (1 if side == "left" else -1)
        return sol['inv'][(sol['pos'][X] + k * s) % self.n]

    def rel(self, sol, X, Y):
        n = self.n
        ld = 1 if (not self.has_face or sol['face'][Y] == 0) else -1
        dl = ((sol['pos'][X] - sol['pos'][Y]) * ld) % n
        if dl <= n // 2:
            return (dl, "left")
        return (n - dl, "right")

    def between(self, sol, X, Y):  # counted from the left of X
        n = self.n
        ld = 1 if (not self.has_face or sol['face'][X] == 0) else -1
        return ((sol['pos'][Y] - sol['pos'][X]) * ld) % n - 1


# ---------------------------------------------------------------- STACK (boxes / floors)
class Stack(Layout):
    """value u = level, 0 = lowest.  box: position from top = n - u.  floor: floor no = u + 1"""
    kind = "stack"

    def __init__(self, names, rng, style="box", **kw):
        super().__init__(names, rng, **kw)
        self.style = style

    def space(self):
        return Ctx(perms(self.n))

    def intro(self):
        names = ", ".join(self.names)
        if self.style == "box":
            return f"{numword(self.n)} boxes – {names} – are kept one above the other in a single stack. No other box is kept in the stack."
        return f"{numword(self.n)} persons – {names} – live on {numword(self.n).lower()} different floors of a building. The lowermost floor is numbered 1, the floor above it 2, and so on up to the topmost floor numbered {self.n}. Only one person lives on each floor."

    def obj(self, X):
        return f"box {self.nm(X)}" if (self.style == "box" and X[0] == 'p') else self.nm(X)

    def Obj(self, X):
        s = self.obj(X)
        return s[0].upper() + s[1:]

    def clue_pool(self, sol, ents, attr_phase, rng):
        n = self.n
        U = sol['pos']
        pool = []
        box = self.style == "box"

        def ue(e):
            return U[e[1]] if e[0] == 'p' else U[sol['who'][e[1]]]
        for X, Y in itertools.permutations(ents, 2):
            if attr_phase and X[0] == 'p' and Y[0] == 'p':
                continue
            ux, uy = ue(X), ue(Y)
            d = ux - uy
            if 1 <= d <= 4:
                if box:
                    txt = f"{self.Obj(X)} is kept immediately above {self.obj(Y)}." if d == 1 else f"{self.Obj(X)} is kept {numword(d).lower()} boxes above {self.obj(Y)}."
                else:
                    txt = f"{self.Obj(X)} lives immediately above {self.obj(Y)}." if d == 1 else f"{self.Obj(X)} lives {numword(d).lower()} floors above {self.obj(Y)}."
                pool.append(dict(type="kabove", text=txt, fn=lambda c, X=X, Y=Y, d=d: c.pos(X) == c.pos(Y) + d, w=1.0))
                if d >= 2 and rng.random() < 0.5:
                    txt = (f"{self.Obj(Y)} is kept {numword(d).lower()} boxes below {self.obj(X)}." if box else f"{self.Obj(Y)} lives {numword(d).lower()} floors below {self.obj(X)}.")
                    pool.append(dict(type="kabove", text=txt, fn=lambda c, X=X, Y=Y, d=d: c.pos(X) == c.pos(Y) + d, w=0.8))
            if X < Y or attr_phase:
                gap = abs(d) - 1
                if 1 <= gap <= 5:
                    noun = ("box is" if gap == 1 else "boxes are") if box else ("floor is" if gap == 1 else "floors are")
                    verb = "kept " if box else ""
                    pool.append(dict(type="between", text=f"Only {numword(gap).lower()} {noun} {verb}between {self.obj(X)} and {self.obj(Y)}.".replace("floor is between", "floor is between").replace("floors are between", "floors are between"),
                                     fn=lambda c, X=X, Y=Y, g=gap: np.abs(c.pos(X) - c.pos(Y)) == g + 1, w=1.3))
                if (n - 1 - ux) == uy:
                    pool.append(dict(type="mirror", text=(f"The number of boxes kept above {self.obj(X)} is the same as the number of boxes kept below {self.obj(Y)}." if box else f"As many persons live above {self.obj(X)} as below {self.obj(Y)}."),
                                     fn=lambda c, X=X, Y=Y: (n - 1 - c.pos(X)) == c.pos(Y), w=1.3))
                if abs(d) > 1 and rng.random() < 0.25:
                    pool.append(dict(type="notadj", text=(f"{self.Obj(X)} is not kept adjacent to {self.obj(Y)}." if box else f"{self.Obj(X)} does not live on a floor adjacent to {self.obj(Y)}'s floor."),
                                     fn=lambda c, X=X, Y=Y: np.abs(c.pos(X) - c.pos(Y)) != 1, w=0.5))
            if d > 1 and rng.random() < 0.35:
                txt = f"{self.Obj(X)} is kept somewhere above {self.obj(Y)}." if box else f"{self.Obj(X)} lives on a floor above {self.obj(Y)}."
                pool.append(dict(type="anyabove", text=txt, fn=lambda c, X=X, Y=Y: c.pos(X) > c.pos(Y), w=0.6))
        for X in ents:
            if attr_phase and X[0] == 'p':
                continue
            ux = ue(X)
            if ux == n - 1:
                pool.append(dict(type="end", text=(f"{self.Obj(X)} is kept at the top of the stack." if box else f"{self.Obj(X)} lives on the topmost floor."), fn=lambda c, X=X: c.pos(X) == n - 1, w=0.5))
            if ux == 0:
                pool.append(dict(type="end", text=(f"{self.Obj(X)} is kept at the bottom of the stack." if box else f"{self.Obj(X)} lives on the lowermost floor."), fn=lambda c, X=X: c.pos(X) == 0, w=0.5))
            if box:
                ft = n - ux
                par = "an odd" if ft % 2 else "an even"
                pool.append(dict(type="parity", text=f"{self.Obj(X)} is kept at {par} numbered position from the top.", fn=lambda c, X=X, r=ft % 2: (n - c.pos(X)) % 2 == r, w=0.55))
                above = n - 1 - ux
                if 1 <= above <= 4:
                    pool.append(dict(type="countabove", text=f"Only {numword(above).lower()} {'box is' if above == 1 else 'boxes are'} kept above {self.obj(X)}.", fn=lambda c, X=X, a=above: (n - 1 - c.pos(X)) == a, w=0.5))
            else:
                fl = ux + 1
                pool.append(dict(type="parity", text=f"{self.Obj(X)} lives on {'an odd' if fl % 2 else 'an even'} numbered floor.", fn=lambda c, X=X, r=fl % 2: (c.pos(X) + 1) % 2 == r, w=0.55))
        if attr_phase:
            pool += attr_direct_clues(self, sol, rng)
        return pool


# ---------------------------------------------------------------- SCHEDULE (months / dates / days)
MONTH_DAYS = {"January": 31, "February": 28, "March": 31, "April": 30, "May": 31, "June": 30, "July": 31, "August": 31, "September": 30, "October": 31, "November": 30, "December": 31}
MONTHS = list(MONTH_DAYS)


class Schedule(Layout):
    kind = "schedule"

    def __init__(self, names, rng, slots, mode, event="attend a seminar", **kw):
        super().__init__(names, rng, **kw)
        self.slots = slots  # list of dicts {label, month, mi, days, date}
        self.mode = mode
        self.event = event

    def space(self):
        return Ctx(perms(self.n))

    def intro(self):
        names = ", ".join(self.names)
        if self.mode == "monthdate":
            ms = sorted(set(s['month'] for s in self.slots), key=MONTHS.index)
            ds = sorted(set(s['date'] for s in self.slots))
            return (f"{numword(self.n)} persons – {names} – {self.event} on two different dates, either {ds[0]}th or {ds[1]}th, of {numword(len(ms)).lower()} different months – "
                    f"{', '.join(ms)} – of the same year (non-leap). Only one person attends on each date.")
        if self.mode == "months":
            ms = [s['month'] for s in self.slots]
            return f"{numword(self.n)} persons – {names} – {self.event} in {numword(self.n).lower()} different months of the same year (non-leap): {', '.join(ms)}. Only one person is in each month."
        days = [s['label'] for s in self.slots]
        return f"{numword(self.n)} persons – {names} – {self.event} on {numword(self.n).lower()} different days of the same week, starting from {days[0]} and ending on {days[-1]}."

    def clue_pool(self, sol, ents, attr_phase, rng):
        n = self.n
        S = sol['pos']
        sl = self.slots
        mi = np.array([s['mi'] for s in sl]); days = np.array([s['days'] for s in sl]); date = np.array([s['date'] for s in sl])
        pool = []
        V = "attends" if self.mode != "days" else "attends"

        def se(e):
            return S[e[1]] if e[0] == 'p' else S[sol['who'][e[1]]]
        for X, Y in itertools.permutations(ents, 2):
            if attr_phase and X[0] == 'p' and Y[0] == 'p':
                continue
            sx, sy = se(X), se(Y)
            if sy - sx == 1:
                pool.append(dict(type="adj", text=f"{self.Nm(X)} {V} immediately before {self.nm(Y)}.", fn=lambda c, X=X, Y=Y: c.pos(Y) - c.pos(X) == 1, w=1.0))
            if 2 <= sy - sx <= 5:
                g = sy - sx - 1
                pool.append(dict(type="beforek", text=f"Only {numword(g).lower()} {'person attends' if g == 1 else 'persons attend'} between {self.nm(X)} and {self.nm(Y)}, and {self.nm(X)} attends before {self.nm(Y)}.",
                                 fn=lambda c, X=X, Y=Y, g=g: c.pos(Y) - c.pos(X) == g + 1, w=1.0))
            if X < Y or attr_phase:
                g = abs(sx - sy) - 1
                if 1 <= g <= 5:
                    pool.append(dict(type="between", text=f"Only {numword(g).lower()} {'person attends' if g == 1 else 'persons attend'} between {self.nm(X)} and {self.nm(Y)}.",
                                     fn=lambda c, X=X, Y=Y, g=g: np.abs(c.pos(X) - c.pos(Y)) == g + 1, w=1.2))
                if self.mode == "monthdate" and mi[sx] == mi[sy]:
                    pool.append(dict(type="samemonth", text=f"{self.Nm(X)} and {self.nm(Y)} attend in the same month.", fn=lambda c, X=X, Y=Y: mi[c.pos(X)] == mi[c.pos(Y)], w=1.0))
                if sx == n - 1 - sy:
                    pool.append(dict(type="mirror", text=f"As many persons attend before {self.nm(X)} as after {self.nm(Y)}.", fn=lambda c, X=X, Y=Y: c.pos(X) == n - 1 - c.pos(Y), w=1.3))
            if sy - sx >= 2 and rng.random() < 0.3:
                pool.append(dict(type="anybefore", text=f"{self.Nm(X)} attends some time before {self.nm(Y)}.", fn=lambda c, X=X, Y=Y: c.pos(X) < c.pos(Y), w=0.6))
        for X in ents:
            if attr_phase and X[0] == 'p':
                continue
            sx = se(X)
            if self.mode in ("monthdate", "months"):
                dd = days[sx]
                if dd != 31:
                    txt = f"{self.Nm(X)} attends in a month which has fewer than 31 days."
                    pool.append(dict(type="mprop", text=txt, fn=lambda c, X=X: days[c.pos(X)] != 31, w=1.0))
                else:
                    pool.append(dict(type="mprop", text=f"{self.Nm(X)} attends in a month having 31 days.", fn=lambda c, X=X: days[c.pos(X)] == 31, w=0.7))
                if self.mode == "monthdate":
                    dt = date[sx]
                    pool.append(dict(type="dprop", text=f"{self.Nm(X)} attends on an {'odd' if dt % 2 else 'even'} numbered date.", fn=lambda c, X=X, r=dt % 2: date[c.pos(X)] % 2 == r, w=0.7))
                    if dd != 31 and rng.random() < 0.5:
                        pool.append(dict(type="mdprop", text=f"{self.Nm(X)} attends on an {'odd' if dt % 2 else 'even'} numbered date of a month having an even number of days.",
                                         fn=lambda c, X=X, r=dt % 2: (date[c.pos(X)] % 2 == r) & (days[c.pos(X)] % 2 == 0), w=1.2))
            if sx == 0:
                pool.append(dict(type="end", text=f"No one attends before {self.nm(X)}.", fn=lambda c, X=X: c.pos(X) == 0, w=0.4))
            if sx == n - 1:
                pool.append(dict(type="end", text=f"{self.Nm(X)} attends last.", fn=lambda c, X=X: c.pos(X) == n - 1, w=0.4))
            if self.mode == "days" and rng.random() < 0.6:
                lab = sl[sx]['label']
                pool.append(dict(type="direct", text=f"{self.Nm(X)} attends on {lab}.", fn=lambda c, X=X, v=sx: c.pos(X) == v, w=0.25))
            if 1 <= sx <= 4 and rng.random() < 0.5:
                pool.append(dict(type="countbefore", text=f"Only {numword(sx).lower()} {'person attends' if sx == 1 else 'persons attend'} before {self.nm(X)}.", fn=lambda c, X=X, v=sx: c.pos(X) == v, w=0.45))
        if attr_phase:
            pool += attr_direct_clues(self, sol, rng)
        return pool


# ---------------------------------------------------------------- FLOOR + FLAT
class FloorFlat(Layout):
    """u in 0..2F-1 ; floor = u//2 (0-based), flat = u%2 (0 = Flat-X west, 1 = Flat-Y east)"""
    kind = "floorflat"

    def space(self):
        return Ctx(perms(self.n))

    def intro(self):
        F = self.n // 2
        return (f"{numword(self.n)} persons – {', '.join(self.names)} – live in a {F}-storey building. The lowermost floor is numbered 1 and the topmost is numbered {F}. "
                f"Each floor has two flats: Flat-X on the west and Flat-Y on the east. Flat-X of floor 2 is immediately above Flat-X of floor 1, and so on. Only one person lives in each flat.")

    def clue_pool(self, sol, ents, attr_phase, rng):
        n = self.n; Fl = n // 2
        U = sol['pos']
        pool = []
        fl = lambda u: u // 2
        ft = lambda u: u % 2

        def ue(e):
            return U[e[1]] if e[0] == 'p' else U[sol['who'][e[1]]]
        FT = ["Flat-X", "Flat-Y"]
        for X, Y in itertools.permutations(ents, 2):
            if attr_phase and X[0] == 'p' and Y[0] == 'p':
                continue
            ux, uy = ue(X), ue(Y)
            if ft(ux) == ft(uy) and fl(ux) - fl(uy) == 1:
                pool.append(dict(type="above1", text=f"{self.Nm(X)} lives immediately above {self.nm(Y)}.", fn=lambda c, X=X, Y=Y: (c.pos(X) - c.pos(Y)) == 2, w=1.0))
            if fl(ux) == fl(uy) and ft(ux) == 1 and ft(uy) == 0:
                pool.append(dict(type="east", text=f"{self.Nm(X)} lives to the east of {self.nm(Y)}.", fn=lambda c, X=X, Y=Y: (c.pos(X) - c.pos(Y) == 1) & (c.pos(X) % 2 == 1), w=1.0))
            if X < Y or attr_phase:
                d = abs(fl(ux) - fl(uy))
                if d >= 2:
                    g = d - 1
                    pool.append(dict(type="between", text=f"Only {numword(g).lower()} {'floor is' if g == 1 else 'floors are'} between the floors on which {self.nm(X)} and {self.nm(Y)} live.",
                                     fn=lambda c, X=X, Y=Y, g=g: np.abs(c.pos(X) // 2 - c.pos(Y) // 2) == g + 1, w=1.1))
                same = ft(ux) == ft(uy)
                if rng.random() < 0.5:
                    pool.append(dict(type="type", text=f"{self.Nm(X)} and {self.nm(Y)} live in {'the same type of flat' if same else 'different types of flats'}.",
                                     fn=lambda c, X=X, Y=Y, s=same: ((c.pos(X) % 2) == (c.pos(Y) % 2)) == s, w=0.8))
            if fl(ux) - fl(uy) >= 1 and rng.random() < 0.4:
                pool.append(dict(type="anyabove", text=f"{self.Nm(X)} lives on a floor above the floor of {self.nm(Y)}.", fn=lambda c, X=X, Y=Y: c.pos(X) // 2 > c.pos(Y) // 2, w=0.7))
        for X in ents:
            if attr_phase and X[0] == 'p':
                continue
            ux = ue(X)
            f1 = fl(ux) + 1
            pool.append(dict(type="parity", text=f"{self.Nm(X)} lives on {'an odd' if f1 % 2 else 'an even'} numbered floor.", fn=lambda c, X=X, r=f1 % 2: (c.pos(X) // 2 + 1) % 2 == r, w=0.7))
            pool.append(dict(type="flat", text=(f"No one lives to the west of {self.nm(X)}." if ft(ux) == 0 else f"No one lives to the east of {self.nm(X)}."), fn=lambda c, X=X, v=ft(ux): c.pos(X) % 2 == v, w=0.7))
            if fl(ux) == Fl - 1 and rng.random() < 0.5:
                pool.append(dict(type="end", text=f"{self.Nm(X)} lives on the topmost floor.", fn=lambda c, X=X: c.pos(X) // 2 == Fl - 1, w=0.5))
        if attr_phase:
            pool += attr_direct_clues(self, sol, rng)
        return pool


# ---------------------------------------------------------------- PARALLEL ROWS
class Parallel(Layout):
    """persons 0..m-1 in Row 1 (face south), m..2m-1 in Row 2 (face north). pos = page-left -> right."""
    kind = "parallel"

    def space(self):
        m = self.n // 2
        p = perms(m)
        A = np.repeat(p, len(p), axis=0)
        B = np.tile(p, (len(p), 1))
        return Ctx(np.concatenate([A, B], axis=1))

    def intro(self):
        m = self.n // 2
        r1 = ", ".join(self.names[:m]); r2 = ", ".join(self.names[m:])
        return (f"{numword(self.n)} persons are sitting in two parallel rows of {numword(m).lower()} each, with equal distance between adjacent persons. "
                f"In Row 1, {r1} are seated and all of them face south. In Row 2, {r2} are seated and all of them face north. Each person in one row faces exactly one person of the other row.")

    def row(self, i):
        return 0 if i < self.n // 2 else 1

    def rs(self, i):  # +1 if this person's right is page-right
        return -1 if self.row(i) == 0 else 1

    def clue_pool(self, sol, ents, attr_phase, rng):
        m = self.n // 2
        P = sol['pos']
        pool = []
        persons = [e for e in ents if e[0] == 'p']
        for X, Y in itertools.permutations(persons, 2):
            x, y = X[1], Y[1]
            if self.row(x) == self.row(y):
                d = (P[x] - P[y]) * self.rs(y)
                if 1 <= abs(d) <= 3:
                    k, side = abs(d), ("right" if d > 0 else "left")
                    txt = f"{self.Nm(X)} sits {ORD[k]} to the {side} of {self.nm(Y)}." if k > 1 else f"{self.Nm(X)} sits immediate {side} of {self.nm(Y)}."
                    pool.append(dict(type="kth", text=txt, fn=lambda c, X=X, Y=Y, k=k, s=(1 if side == 'right' else -1) * self.rs(y): c.pos(X) == c.pos(Y) + k * s, w=1.0))
                if x < y:
                    g = abs(P[x] - P[y]) - 1
                    if 1 <= g <= 3:
                        pool.append(dict(type="between", text=f"Only {numword(g).lower()} {'person sits' if g == 1 else 'persons sit'} between {self.nm(X)} and {self.nm(Y)}.",
                                         fn=lambda c, X=X, Y=Y, g=g: np.abs(c.pos(X) - c.pos(Y)) == g + 1, w=1.0))
            else:
                if P[x] == P[y] and x < y:
                    pool.append(dict(type="faces", text=f"{self.Nm(X)} faces {self.nm(Y)}.", fn=lambda c, X=X, Y=Y: c.pos(X) == c.pos(Y), w=0.6))
                # the one who faces X sits k-th to the side of Y  (Y in the other row than X)
                d = (P[x] - P[y]) * self.rs(y)
                if 1 <= abs(d) <= 3:
                    k, side = abs(d), ("right" if d > 0 else "left")
                    pos_txt = f"{ORD[k]} to the {side} of" if k > 1 else f"immediate {side} of"
                    pool.append(dict(type="facerel", text=f"The one who faces {self.nm(X)} sits {pos_txt} {self.nm(Y)}.",
                                     fn=lambda c, X=X, Y=Y, k=k, s=(1 if side == 'right' else -1) * self.rs(y): c.pos(X) == c.pos(Y) + k * s, w=1.3))
        for X in persons:
            x = X[1]
            if P[x] in (0, m - 1):
                pool.append(dict(type="end", text=f"{self.Nm(X)} sits at an extreme end of the row.", fn=lambda c, X=X: (c.pos(X) == 0) | (c.pos(X) == m - 1), w=0.6))
            elif rng.random() < 0.5:
                pool.append(dict(type="notend", text=f"{self.Nm(X)} does not sit at an extreme end of the row.", fn=lambda c, X=X: (c.pos(X) != 0) & (c.pos(X) != m - 1), w=0.4))
        return pool


# ---------------------------------------------------------------- attributes
def attr_direct_clues(L, sol, rng):
    pool = []
    who = sol['who']  # attr index -> person
    for a, p in enumerate(who):
        if rng.random() < 0.35:
            pool.append(dict(type="adirect", text=f"{L.names[p]} {ATTR_VERB[L.attr_kind]} {L.attr_vals[a]}.", fn=lambda c, a=a, p=p: c.A[:, a] == p, w=0.3))
        others = [b for b in range(L.n) if b != a]
        b1, b2 = rng.sample(others, 2)
        verb = ATTR_VERB[L.attr_kind]
        neg = {"likes": "does not like", "belongs to": "does not belong to", "owns": "does not own", "teaches": "does not teach", "plays": "does not play"}[verb]
        pool.append(dict(type="aneg", text=f"{L.names[p]} {neg} {L.attr_vals[b1]} or {L.attr_vals[b2]}.", fn=lambda c, p=p, b1=b1, b2=b2: (c.A[:, b1] != p) & (c.A[:, b2] != p), w=0.5))
    return pool


# ---------------------------------------------------------------- build a set
def solution_dict(layout, P0, F0=None, who=None):
    n = layout.n
    inv = [0] * n
    for i, p in enumerate(P0):
        inv[int(p)] = i
    return dict(pos=[int(x) for x in P0], face=None if F0 is None else [int(x) for x in F0], inv=inv, who=who)


def generate_arrangement(layout, rng, attr_kind=None, difficulty=1, weights=None, max_clues=None):
    n = layout.n
    ctx = layout.space()
    for attempt in range(40):
        i = rng.randrange(ctx.N)
        P0 = ctx.P[i].copy(); F0 = None if ctx.F is None else ctx.F[i].copy()
        sol = solution_dict(layout, P0, F0)
        ents = [('p', j) for j in range(n)]
        pool = layout.clue_pool(sol, ents, False, rng)
        w = dict(weights or {})
        weak = ("notnbr", "notadj", "anyabove", "anybefore", "parity", "mprop", "dprop", "mdprop", "type", "relface", "face", "flat", "notend", "samemonth", "nbr")
        for t in weak:
            w[t] = w.get(t, 1.0) * (1.6 if difficulty == 1 else 2.3)
        for t in ("mirror", "beforek", "direct", "fromend", "countbefore"):
            w[t] = w.get(t, 1.0) * 0.75
        if difficulty >= 2:
            for t in ("end", "fromend", "face", "direct", "countbefore", "countabove", "flat"):
                w[t] = w.get(t, 1.0) * 0.45
            for t in ("between", "mirror", "betweenL", "facerel", "mdprop", "relface"):
                w[t] = w.get(t, 1.0) * 1.5
        for c in pool:
            c['w'] = c['w'] * w.get(c['type'], 1.0)
        pool.sort(key=lambda c: -c['w'] * rng.random())
        mc = max_clues or (12 if difficulty == 1 else 14)
        chosen = solve_unique(layout, ctx, pool, rng, max_clues=mc)
        if chosen is None:
            continue
        aclues = []
        if attr_kind:
            layout.attr_kind = attr_kind
            layout.attr_vals = rng.sample(ATTRS[attr_kind], n)
            who = list(rng.sample(range(n), n))  # attr a -> person
            sol['who'] = who
            A = perms(n)
            actx = Ctx(None, None, P0, F0, A)
            ents2 = [('p', j) for j in range(n)] + [('a', j) for j in range(n)]
            apool = layout.clue_pool(sol, ents2, True, rng)
            apool.sort(key=lambda c: -c['w'] * rng.random())
            aclues = solve_unique(layout, actx, apool, rng, max_clues=12)
            if aclues is None:
                continue
            # attr -> person map; person -> attr
            sol['attr_of'] = {who[a]: a for a in range(n)}
        return sol, chosen, aclues
    raise RuntimeError("could not build puzzle")


def interleave(rng, a, b):
    """merge attribute clues into person clues while keeping relative order"""
    out = list(a)
    for c in b:
        pos = rng.randint(min(2, len(out)), len(out))
        out.insert(pos, c)
    return out
