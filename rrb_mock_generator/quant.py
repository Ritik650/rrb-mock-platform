"""Quantitative aptitude generators. Every number is built backwards from a clean answer."""
import random, math, itertools
from fractions import Fraction as Fr
from util import *

SUP2 = "²"; SUP3 = "³"


def noisy(rng, v, kind="dec"):
    """display an integer as a slightly-off decimal that rounds back to v (noise <= 1.5% of v)"""
    if v == 0:
        return "0"
    cap = min(0.25, abs(v) * 0.015)
    choices = [d for d in (0.01, 0.02, 0.03, 0.05, 0.08, 0.1, 0.12, 0.15, 0.18, 0.2, 0.22, 0.25) if d <= max(cap, 0.01)]
    d = rng.choice(choices)
    if rng.random() < 0.5:
        d = -d
    return f"{v + d:.2f}"


def _approx_eval(expr, x):
    import re as _re
    e = expr.replace("×", "*").replace("÷", "/").replace("−", "-").replace("²", "**2").replace("³", "**3")
    e = _re.sub(r"(\d+(?:\.\d+)?)/(\d+) of ", r"(\1/\2)*", e)
    e = _re.sub(r"(\d+(?:\.\d+)?|\?)% of ", r"(\1/100)*", e)
    e = _re.sub(r"√(\d+(?:\.\d+)?)", r"_sqrt(\1)", e)
    e = _re.sub(r"∛(\d+(?:\.\d+)?)", r"_cbrt(\1)", e)
    e = e.replace("?", f"({x})")
    l, r = e.split("=")
    env = dict(_sqrt=math.sqrt, _cbrt=lambda v: v ** (1 / 3))
    return eval(l, env) - eval(r, env)


def spaced(ans, rng, rel=0.12, step=None, k=4):
    out = set()
    step = step or max(1, int(round(abs(ans) * rel / 2)))
    cands = [ans + step * m for m in (-3, -2, -1, 1, 2, 3, 4) if ans + step * m > 0]
    rng.shuffle(cands)
    for c in cands:
        out.add(c)
        if len(out) == k:
            break
    return list(out)


# =================================================================== APPROXIMATION
def gen_approx(rng, hard=False):
    for _ in range(400):
        t = rng.randint(1, 8)
        if t == 1:  # a% of b + c^2 - ? = d * e
            a = rng.choice([10, 15, 20, 25, 30, 35, 40, 45, 60, 75]); b = rng.choice(range(200, 1700, 20)); c = rng.randint(11, 25); d = rng.randint(11, 30); e = rng.randint(6, 19)
            if (a * b) % 100:
                continue
            ans = a * b // 100 + c * c - d * e
            if ans <= 5:
                continue
            stem = f"{noisy(rng, a)}% of {noisy(rng, b)} + {noisy(rng, c)}{SUP2} − ? = {noisy(rng, d)} × {noisy(rng, e)}"
            work = [f"≈ {a}% of {b} + {c}² − ? = {d} × {e}", f"{a * b // 100} + {c * c} − ? = {d * e} ⇒ ? = {ans}"]
        elif t == 2:  # sqrt(x) * y / z + ? = w
            r = rng.randint(12, 32); y = rng.choice([24, 36, 45, 48, 60, 72, 84, 96, 120]); z = rng.choice([4, 6, 8, 12])
            if (r * y) % z:
                continue
            base = r * y // z
            ans = rng.randint(20, 300)
            w = base + ans
            stem = f"√{noisy(rng, r * r)} × {noisy(rng, y)} ÷ {noisy(rng, z)} + ? = {noisy(rng, w)}"
            work = [f"≈ √{r * r} × {y} ÷ {z} + ? = {w}", f"{r} × {y} ÷ {z} = {base} ⇒ ? = {w} − {base} = {ans}"]
        elif t == 3:  # (a + ?) / b * c = d
            b = rng.choice([12, 14, 15, 16, 18, 21, 24, 25, 28, 32, 35, 36, 42, 45]); c = rng.choice([x for x in range(3, 30) if x != b])
            g = math.gcd(b, c); bb, cc = b // g, c // g
            k = rng.randint(10, 60)
            total = bb * k * rng.randint(1, 3)
            a = rng.randint(total // 3, total - 10) if total > 40 else None
            if not a:
                continue
            ans = total - a
            d = total * cc // bb
            if total * cc % bb:
                continue
            stem = f"({noisy(rng, a)} + ?) ÷ {noisy(rng, b)} × {noisy(rng, c)} = {noisy(rng, d)}"
            work = [f"≈ ({a} + ?) × {c}/{b} = {d}", f"{a} + ? = {d} × {b}/{c} = {total} ⇒ ? = {ans}"]
        elif t == 4:  # x^3 - y^2 + ? = z * w
            x = rng.randint(5, 13); y = rng.randint(11, 29); z = rng.randint(12, 40); w = rng.randint(8, 25)
            ans = z * w - x ** 3 + y * y
            if not 10 < ans < 2000:
                continue
            stem = f"{noisy(rng, x)}{SUP3} − {noisy(rng, y)}{SUP2} + ? = {noisy(rng, z)} × {noisy(rng, w)}"
            work = [f"≈ {x}³ − {y}² + ? = {z} × {w}", f"{x ** 3} − {y * y} + ? = {z * w} ⇒ ? = {ans}"]
        elif t == 5:  # ?% of a + b = c% of d
            a = rng.choice([200, 300, 400, 500, 600, 800, 900, 1200]); c = rng.choice([10, 15, 20, 25, 30, 40, 45, 60]); d = rng.choice([400, 500, 600, 800, 1000, 1200, 1500, 1600])
            ansp = rng.choice([5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50])
            b = c * d // 100 - ansp * a // 100
            if b <= 0 or (c * d) % 100 or (ansp * a) % 100:
                continue
            ans = ansp
            stem = f"?% of {noisy(rng, a)} + {noisy(rng, b)} = {noisy(rng, c)}% of {noisy(rng, d)}"
            work = [f"≈ ?% of {a} + {b} = {c}% of {d} = {c * d // 100}", f"?% of {a} = {c * d // 100 - b} ⇒ ? = {ans}"]
        elif t == 6:  # cbrt(x) + sqrt(y) = ?^2 - z
            p = rng.randint(4, 12); q = rng.randint(11, 35); ans = rng.randint(8, 20)
            z = ans * ans - p - q
            if z <= 0:
                continue
            stem = f"∛{noisy(rng, p ** 3)} + √{noisy(rng, q * q)} = ?{SUP2} − {noisy(rng, z)}"
            work = [f"≈ ∛{p ** 3} + √{q * q} = ?² − {z}", f"{p} + {q} + {z} = {ans * ans} ⇒ ? = {ans}"]
        elif t == 7:  # a/b of c + d% of e = ?
            b = rng.choice([3, 4, 5, 6, 7, 8, 9]); a = rng.randint(1, b - 1); c = b * rng.randint(20, 120)
            dd = rng.choice([10, 20, 25, 30, 40, 50, 60, 75]); e = rng.choice(range(100, 1600, 20))
            if (dd * e) % 100:
                continue
            ans = a * c // b + dd * e // 100
            stem = f"{a}/{b} of {noisy(rng, c)} + {noisy(rng, dd)}% of {noisy(rng, e)} = ?"
            work = [f"≈ {a}/{b} × {c} + {dd}% of {e}", f"{a * c // b} + {dd * e // 100} = {ans}"]
        else:  # (a * b) + (c * d) = e^2 + ?
            a, b, c, d = rng.randint(3, 15), rng.randint(11, 40), rng.randint(3, 15), rng.randint(11, 40); e = rng.randint(8, 25)
            ans = a * b + c * d - e * e
            if ans <= 5:
                continue
            stem = f"({noisy(rng, a)} × {noisy(rng, b)}) + ({noisy(rng, c)} × {noisy(rng, d)}) = {noisy(rng, e)}{SUP2} + ?"
            work = [f"≈ {a} × {b} + {c} × {d} = {e}² + ?", f"{a * b} + {c * d} − {e * e} = {ans}"]
        step = max(2, int(round(ans * 0.12))) if ans > 20 else rng.choice([2, 3, 5])
        dis = spaced(ans, rng, step=step)
        # exact-decimal check: the intended answer must be the closest option by a clear margin
        try:
            res = {o: abs(_approx_eval(stem, o)) for o in [ans] + dis}
        except Exception:
            continue
        others = sorted(v for o, v in res.items() if o != ans)
        if not res[ans] * 2.5 < others[0]:
            continue
        stem = "What approximate value should come in place of the question mark (?)\n" + stem
        return make_q(stem, ans, dis, work + ["Round every number to the nearest whole first; the options are far apart."], "Approximation", "Approximation", time=35, rng=rng)
    raise RuntimeError("approx")


# =================================================================== QUADRATIC
QOPT = ["x > y", "x ≥ y", "x = y or relationship can't be established", "x < y", "x ≤ y"]


def poly_text(a, b, c, v):
    def term(coef, s, first=False):
        if coef == 0:
            return ""
        sign = "−" if coef < 0 else "+"
        mag = abs(coef)
        body = f"{'' if mag == 1 and s else mag}{s}"
        return (("− " if coef < 0 else "") + body) if first else f" {sign} {body}"
    return (term(a, f"{v}{SUP2}", True) + term(b, v) + term(c, "")) + " = 0"


def rel_of(xs, ys):
    if min(xs) > max(ys): return 0
    if min(xs) >= max(ys): return 1
    if max(xs) < min(ys): return 3
    if max(xs) <= min(ys): return 4
    return 2


def gen_quadratic(rng, hard=False):
    target = rng.choice([0, 1, 2, 3, 4, 0, 3, 1, 4])
    for _ in range(2000):
        def eq(v):
            kind = rng.random()
            if kind < 0.55 or not hard and kind < 0.7:
                r1, r2 = rng.randint(-15, 18), rng.randint(-15, 18)
                if r1 == 0 or r2 == 0 or r1 == -r2:
                    return None
                a, b, c = 1, -(r1 + r2), r1 * r2
                return [Fr(r1), Fr(r2)], poly_text(a, b, c, v), f"{poly_text(a, b, c, v)} ⇒ ({v} {'−' if r1>=0 else '+'} {abs(r1)})({v} {'−' if r2>=0 else '+'} {abs(r2)}) = 0"
            if kind < 0.9:
                a = rng.choice([2, 3, 4, 5, 6])
                p = rng.randint(-9, 12); q = rng.randint(-12, 15)
                if p == 0 or q == 0:
                    return None
                # (a v - p)(v - q) = a v^2 - (aq + p) v + pq
                A, B, C = a, -(a * q + p), p * q
                g = math.gcd(math.gcd(A, abs(B)), abs(C))
                return [Fr(p, a), Fr(q)], poly_text(A // g, B // g, C // g, v), f"Split the middle term: ({a}{v} {'−' if p>=0 else '+'} {abs(p)})({v} {'−' if q>=0 else '+'} {abs(q)}) = 0"
            r = rng.randint(3, 15)
            return [Fr(r), Fr(-r)], f"{v}{SUP2} = {r * r}", f"{v} = ±{r}"
        ex = eq("x"); ey = eq("y")
        if not ex or not ey:
            continue
        xs, xt, xw = ex; ys, yt, yw = ey
        r = rel_of(xs, ys)
        if r != target:
            continue
        fs = lambda L: ", ".join(frac_str(v) if v.denominator != 1 else str(v.numerator) for v in sorted(set(L), reverse=True))
        stem = f"In the following question, two equations are given. Solve both and find the relationship between x and y.\nI. {xt}\nII. {yt}"
        sol = [xw + f" ⇒ x = {fs(xs)}", yw + f" ⇒ y = {fs(ys)}", "Compare: " + QOPT[r] + "."]
        return fixed_options_q(stem, QOPT, r, sol, "Quadratic equations", "Quadratic", time=35)
    raise RuntimeError("quad")


# =================================================================== SERIES
PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47]


def series_pattern(rng, hard=False):
    """returns (terms, description) with 7 terms"""
    t = rng.randint(1, 11)
    n = 7
    if t == 1:
        a = rng.randint(5, 200); d = rng.randint(3, 15); dd = rng.randint(2, 11) * rng.choice([1, 1, -1])
        s = [a]; diff = d
        for i in range(n - 1):
            s.append(s[-1] + diff); diff += dd
        desc = f"Differences change by {dd:+d} each step ({d}, {d + dd}, {d + 2 * dd}, …)"
    elif t == 2:
        a = rng.randint(2, 12); c0 = rng.choice([0, 1, 1, 2, -1])
        s = [a]
        for i in range(1, n):
            s.append(s[-1] * i + i + c0)
        desc = f"×1 + {1 + c0}, ×2 + {2 + c0}, ×3 + {3 + c0}, … (multiply by n, then add n{'+' + str(c0) if c0 > 0 else ('−1' if c0 < 0 else '')})"
    elif t == 3:
        a = rng.randint(5, 150); k = rng.randint(2, 5)
        s = [a]
        for i in range(n - 1):
            s.append(s[-1] + (k + i) ** 2)
        desc = f"Differences are consecutive squares: {k}², {k + 1}², {k + 2}², …"
    elif t == 4:
        a = rng.randint(100, 1500); k = rng.randint(4, 9)
        s = [a]
        for i in range(n - 1):
            s.append(s[-1] + (k - i) ** 3 if k - i > 0 else s[-1] + 1)
        if k - (n - 2) <= 0:
            return None
        desc = f"Differences are cubes in decreasing order: {k}³, {k - 1}³, …"
    elif t == 5:
        a = rng.randint(10, 120); st = rng.randint(0, 4)
        s = [a]
        for i in range(n - 1):
            s.append(s[-1] + PRIMES[st + i])
        desc = "Differences are consecutive prime numbers"
    elif t == 6:
        a = rng.randint(50, 300); p = rng.randint(15, 45); q = rng.randint(7, p - 3)
        s = [a]
        for i in range(n - 1):
            s.append(s[-1] + (p if i % 2 == 0 else -q))
        desc = f"Alternately +{p} and −{q}"
    elif t == 7:
        m = rng.randint(5, 8); a = rng.choice([1, 2, 3, 4, 5, 1.5, 2.5])
        s = [a]
        for i in range(n - 1):
            if m - i < 1:
                return None
            s.append(s[-1] * (m - i))
        n7 = len(s)
        desc = f"×{m}, ×{m - 1}, ×{m - 2}, … (multiplier falls by 1)"
    elif t == 8:
        a = rng.randint(5, 80); d = rng.randint(2, 9)
        s = [a]
        for i in range(n - 1):
            s.append(s[-1] + d * 2 ** i)
        desc = f"Differences double: {d}, {2 * d}, {4 * d}, …"
    elif t == 9:
        a = rng.choice([8, 12, 16, 20, 24, 32, 40, 48, 64])
        s = [a]
        for i in range(n - 1):
            s.append(s[-1] * Fr(i + 1, 2))
        if any(Fr(x).denominator not in (1, 2) for x in s):
            return None
        s = [float(x) for x in s]
        desc = "×0.5, ×1, ×1.5, ×2, ×2.5, … (multiplier rises by 0.5)"
    elif t == 10:
        a = rng.randint(3, 20); m = rng.choice([2, 3]); c = rng.choice([1, 2, 3, -1, -2])
        s = [a]
        for i in range(n - 1):
            s.append(s[-1] * m + c)
        desc = f"×{m} {'+' if c > 0 else '−'} {abs(c)} each time"
    else:
        k = rng.randint(2, 6); c = rng.choice([1, -1, 2, 3])
        if rng.random() < 0.5:
            s = [(k + i) ** 2 + c for i in range(n)]; desc = f"Terms are n² {'+' if c > 0 else '−'} {abs(c)} for n = {k}, {k + 1}, {k + 2}, …"
        else:
            s = [(k + i) ** 3 - c for i in range(n)]; desc = f"Terms are n³ {'−' if c > 0 else '+'} {abs(c)} for n = {k}, {k + 1}, {k + 2}, …"
    s = [int(x) if float(x) == int(x) else x for x in s]
    if len(set(s)) < len(s):
        return None
    if max(abs(x) for x in s) > 50000 or min(s) < 0:
        return None
    return s, desc


def gen_series(rng, hard=False, wrong=False):
    for _ in range(500):
        r = series_pattern(rng, hard)
        if not r:
            continue
        s, desc = r
        if wrong:
            terms = list(s)
            idx = rng.randint(2, 5)
            delta = rng.choice([1, 2, 3, 4, 5, 6, 10]) * rng.choice([1, -1])
            if isinstance(terms[idx], float):
                delta = rng.choice([0.5, 1, 1.5])
            bad = terms[idx] + delta
            terms[idx] = bad
            shown = ", ".join(fmt_num(x) for x in terms)
            opts = [terms[i] for i in rng.sample([i for i in range(7) if i != idx], 4)]
            return make_q(f"Find the wrong number in the following number series.\n{shown}", bad, opts, [desc + ".", f"The term in position {idx + 1} should be {fmt_num(s[idx])}, not {fmt_num(bad)}."],
                          "Number series", "Wrong number", time=40, fmt=fmt_num, rng=rng)
        L = 6
        terms = s[:L]
        idx = rng.randint(1, L - 1) if rng.random() < 0.6 else L - 1
        ans = terms[idx]
        shown = ", ".join("?" if i == idx else fmt_num(x) for i, x in enumerate(terms))
        if isinstance(ans, float):
            dis = [ans + d for d in (-3, -1.5, 1.5, 3, 4.5)]
        else:
            step = max(1, int(abs(ans) * 0.06)) if abs(ans) > 30 else rng.choice([1, 2, 3])
            dis = spaced(ans, rng, step=step)
        return make_q(f"What value should come in place of the question mark (?) in the following number series?\n{shown}", ans, dis, [desc + ".", f"Missing term = {fmt_num(ans)}."],
                      "Number series", "Missing number", time=35, fmt=fmt_num, rng=rng)
    raise RuntimeError("series")


# =================================================================== DI helpers
def clean(fr, dp=2):
    """True if a Fraction has a finite decimal with <= dp places"""
    fr = Fr(fr)
    v = fr * 10 ** dp
    return v.denominator == 1


def show(fr):
    fr = Fr(fr)
    if fr.denominator == 1:
        return str(fr.numerator)
    return fmt_num(round(float(fr), 2))


def pct_change_q(rng, a, b, la, lb, topic, sub):
    """a is what % more/less than b"""
    ch = (Fr(a) - Fr(b)) / Fr(b) * 100
    if not clean(ch):
        return None
    word = "more" if ch > 0 else "less"
    val = abs(ch)
    dis = [val + d for d in (-10, -5, 5, 10, 12.5, -12.5, 2.5, -2.5, 15, 20, 7.5) if val + d > 0]
    return make_q(f"{la} is what percent {'more' if ch > 0 else 'less'} than {lb}?", val, dis, [f"({a} − {b})/{b} × 100 = {show(ch)}% ⇒ {show(val)}% {word}."], topic, sub, time=45, fmt=lambda v: f"{show(Fr(v).limit_denominator(1000))}%", rng=rng)


def ratio_q(rng, a, b, la, lb, topic, sub, strict=True):
    g = math.gcd(int(a), int(b))
    if strict and max(int(a) // g, int(b) // g) > 30:
        return diff_q(rng, int(a), int(b), la, lb, topic, sub)
    corr = f"{int(a)//g}:{int(b)//g}"
    dis = set()
    for _ in range(40):
        x = int(a) // g + rng.randint(-3, 3); y = int(b) // g + rng.randint(-3, 3)
        if x > 0 and y > 0 and math.gcd(x, y) == 1 and f"{x}:{y}" != corr:
            dis.add(f"{x}:{y}")
    return make_q(f"What is the ratio of {la} to {lb}?", corr, list(dis), [f"{a} : {b} = {corr}."], topic, sub, time=40, rng=rng)


def avg_q(rng, vals, label, topic, sub):
    s = sum(vals)
    av = Fr(s, len(vals))
    if not clean(av, 1):
        return None
    dis = [av + d for d in (-8, -4, 4, 6, 10, -10)]
    return make_q(f"What is the average of {label}?", av, dis, [f"({' + '.join(map(str, vals))})/{len(vals)} = {show(av)}."], topic, sub, time=40, fmt=lambda v: show(v), rng=rng)


def diff_q(rng, a, b, la, lb, topic, sub):
    d = abs(a - b)
    return make_q(f"What is the difference between {la} and {lb}?", d, spaced(d, rng, step=max(2, int(d * 0.1))), [f"|{a} − {b}| = {d}."], topic, sub, time=35, rng=rng)


ENT = [("companies", ["A", "B", "C", "D", "E"]), ("stores", ["P", "Q", "R", "S", "T"]), ("colleges", ["J", "K", "L", "M", "N"]), ("cities", ["Pune", "Agra", "Kota", "Durg", "Ooty"])]


# --- DI 1: table: total + % of type-1 (two types)
def di_table_pct(rng, hard=False):
    ctx = rng.choice([
        dict(grp="companies", one="company", item="laptops", t1="sold online", t2="sold offline", prep="by", split="Of the laptops sold online by {L}, the ratio of those bought by men to those bought by women is {a}:{b}. How many were bought by men?"),
        dict(grp="colleges", one="college", item="students", t1="in the master's programme", t2="in the bachelor's programme", prep="of", split="Among the students in the master's programme of college {L}, the ratio of boys to girls is {a}:{b}. How many boys are there in that programme?"),
        dict(grp="stores", one="store", item="items", t1="sold on weekdays", t2="sold on weekends", prep="by", split="Of the items sold on weekdays by store {L}, the ratio of cash payments to card payments is {a}:{b}. How many items were paid for in cash?"),
        dict(grp="banks", one="bank", item="loans", t1="given for housing", t2="given for other purposes", prep="by", split="Of the loans given for housing by bank {L}, the ratio of loans to men to loans to women is {a}:{b}. How many housing loans were given to men?")])
    grp, item, t1, t2, pr, one = ctx["grp"], ctx["item"], ctx["t1"], ctx["t2"], ctx["prep"], ctx["one"]
    labs = ["A", "B", "C", "D", "E"]
    for _ in range(500):
        tot = [rng.choice(range(400, 2001, 40)) for _ in labs]
        pc = [rng.choice([20, 25, 30, 35, 40, 45, 55, 60, 65, 70, 75]) for _ in labs]
        v1 = [Fr(t * p, 100) for t, p in zip(tot, pc)]
        if any(v.denominator != 1 for v in v1):
            continue
        v1 = [int(v) for v in v1]; v2 = [t - a for t, a in zip(tot, v1)]
        qs = []
        i, j = rng.sample(range(5), 2)
        q = pct_change_q(rng, v2[i], v1[j], f"The number of {item} {t2} {pr} {one} {labs[i]}", f"the number of {item} {t1} {pr} {one} {labs[j]}", "Data interpretation", "Table DI")
        if q is None:
            continue
        qs.append(q)
        a, b = rng.sample(range(5), 2)
        qs.append(ratio_q(rng, v1[a] + v1[b], v2[a] + v2[b], f"the total {item} {t1} {pr} {grp} {labs[a]} and {labs[b]} together", f"the total {item} {t2} {pr} them", "Data interpretation", "Table DI"))
        sel = rng.sample(range(5), 3)
        q = avg_q(rng, [v2[k] for k in sel], f"the number of {item} {t2} {pr} {grp} {', '.join(labs[k] for k in sel)}", "Data interpretation", "Table DI")
        if q is None:
            continue
        qs.append(q)
        e = rng.randrange(5)
        inc = rng.choice([10, 20, 25, 40, 50])
        totF = Fr(tot[e] * (100 + inc), 100)
        given = rng.randint(1, 6) * 20 + v1[e]
        v1F = given - v1[e]
        if totF.denominator != 1 or v1F <= 0 or v1F >= totF:
            continue
        ansF = int(totF) - v1F
        qs.append(make_q(f"The total number of {item} of {one} F is {inc}% more than that of {one} {labs[e]}, and the number of {item} {t1} {pr} {labs[e]} and F together is {given}. Find the number of {item} {t2} {pr} F.", ansF, spaced(ansF, rng, step=max(5, ansF // 10)),
                         [f"Total of F = {tot[e]} × {100 + inc}/100 = {int(totF)}.", f"{t1.capitalize()} {pr} F = {given} − {v1[e]} = {v1F}.", f"{t2.capitalize()} {pr} F = {int(totF)} − {v1F} = {ansF}."], "Data interpretation", "Table DI", time=60, rng=rng))
        a, b = rng.sample(range(5), 2)
        mr = rng.choice([(3, 2), (4, 3), (5, 3), (7, 5), (2, 1), (5, 4), (3, 1), (7, 3)])
        if v1[a] % (mr[0] + mr[1]):
            qs.append(diff_q(rng, v1[a], v2[b], f"the number of {item} {t1} {pr} {one} {labs[a]}", f"the number of {item} {t2} {pr} {one} {labs[b]}", "Data interpretation", "Table DI"))
        else:
            m_ = v1[a] * mr[0] // (mr[0] + mr[1])
            qs.append(make_q(ctx["split"].format(L=labs[a], a=mr[0], b=mr[1]), m_, spaced(m_, rng, step=max(4, m_ // 10)),
                             [f"{t1.capitalize()} {pr} {labs[a]} = {v1[a]}; {v1[a]} × {mr[0]}/{mr[0] + mr[1]} = {m_}."], "Data interpretation", "Table DI", time=40, rng=rng))
        rng.shuffle(qs)
        vis = dict(type="table", headers=[one.capitalize(), f"Total {item}", f"% of {item} {t1}"], rows=[[l, t, f"{p}%"] for l, t, p in zip(labs, tot, pc)])
        intro = f"The table below shows the total number of {item} of five {grp} (A–E) and the percentage of those {item} {t1}. The remaining {item} are {t2}."
        return dict(kind="set", topic="Data interpretation", sub="Table DI", directions="Directions: Study the following table carefully and answer the questions given below.", intro=intro, clues=[], visual=vis, qs=qs[:5],
                    derived=dict(headers=["", f"{t1}", f"{t2}"], rows=[[l, a, b] for l, a, b in zip(labs, v1, v2)]))
    raise RuntimeError("di table")


# --- DI 2: pie chart (total + percentages) with second-level split
def di_pie(rng, hard=False):
    ctx = rng.choice([("employees", "departments", ["HR", "IT", "Sales", "Finance", "Admin", "Legal"], "female"), ("books sold", "genres", ["Fiction", "Science", "History", "Comics", "Poetry", "Travel"], "hardcover"),
                      ("students", "streams", ["Arts", "Science", "Commerce", "Law", "Design", "Medical"], "girls"), ("cars sold", "brands", ["Alto", "Nexo", "Verto", "Zeta", "Kwid", "Fino"], "petrol")])
    item, grp, cats, sub_ = ctx
    for _ in range(500):
        k = 6 if hard else 5
        cs = cats[:k]
        pcts = None
        for __ in range(200):
            p = [rng.choice([8, 10, 12, 12.5, 14, 15, 16, 18, 20, 22, 24, 25, 28, 30]) for _ in range(k - 1)]
            last = 100 - sum(p)
            if 6 <= last <= 32:
                pcts = p + [last]; break
        if not pcts:
            continue
        total = rng.choice([2400, 3200, 3600, 4000, 4800, 5000, 6000, 7200, 8000])
        vals = [Fr(total) * Fr(str(x)) / 100 for x in pcts]
        if any(v.denominator != 1 for v in vals):
            continue
        vals = [int(v) for v in vals]
        fr = [rng.choice([Fr(1, 2), Fr(2, 5), Fr(3, 5), Fr(1, 4), Fr(3, 4), Fr(3, 8), Fr(5, 8), Fr(2, 3), Fr(1, 3)]) for _ in cs]
        sv = [v * f for v, f in zip(vals, fr)]
        if any(x.denominator != 1 for x in sv):
            continue
        sv = [int(x) for x in sv]
        qs = []
        a, b = rng.sample(range(k), 2)
        qs.append(ratio_q(rng, vals[a], vals[b], f"the number of {item} in {cs[a]}", f"that in {cs[b]}", "Data interpretation", "Pie chart DI"))
        a = rng.randrange(k)
        ang = Fr(str(pcts[a])) * Fr(36, 10)
        qs.append(make_q(f"What is the central angle (in degrees) corresponding to {cs[a]}?", ang, [ang + d for d in (-18, -9, 9, 18, 27, 36)], [f"{pcts[a]}% × 3.6 = {show(ang)}°."], "Data interpretation", "Pie chart DI", time=30, fmt=lambda v: f"{show(v)}°", rng=rng))
        a, b = rng.sample(range(k), 2)
        q = pct_change_q(rng, vals[a], vals[b], f"The number of {item} in {cs[a]}", f"that in {cs[b]}", "Data interpretation", "Pie chart DI")
        if q is None:
            continue
        qs.append(q)
        sel = rng.sample(range(k), 3)
        tot_sub = sum(sv[i] for i in sel)
        qs.append(make_q(f"In {', '.join(cs[i] for i in sel[:-1])} and {cs[sel[-1]]}, the fraction of {item} that are {sub_} is {', '.join(frac_str(fr[i]) for i in sel[:-1])} and {frac_str(fr[sel[-1]])} respectively. Find the total number of {sub_} {item} in these three.",
                         tot_sub, spaced(tot_sub, rng, step=max(10, tot_sub // 12)), [" + ".join(f"{vals[i]} × {frac_str(fr[i])}" for i in sel) + f" = {tot_sub}."], "Data interpretation", "Pie chart DI", time=55, rng=rng))
        a = rng.randrange(k)
        inc = rng.choice([10, 20, 25, 30, 40, 50])
        newv = Fr(vals[a] * (100 + inc), 100)
        others = total - vals[a]
        newtot = others + newv
        if newv.denominator != 1:
            continue
        ch = (newv / newtot) * 100
        if clean(ch):
            qs.append(make_q(f"If the number of {item} in {cs[a]} increases by {inc}% and the others stay the same, what percentage of the new total will {cs[a]} be?", ch, [ch + d for d in (-4, -2, 2, 3, 5)],
                             [f"New {cs[a]} = {int(newv)}; new total = {int(newtot)}; {int(newv)}/{int(newtot)} × 100 = {show(ch)}%."], "Data interpretation", "Pie chart DI", time=55, fmt=lambda v: f"{show(v)}%", rng=rng))
        else:
            sel = rng.sample(range(k), 2)
            qs.append(diff_q(rng, vals[sel[0]] + vals[sel[1]], vals[a], f"the total {item} in {cs[sel[0]]} and {cs[sel[1]]} together", f"the {item} in {cs[a]}", "Data interpretation", "Pie chart DI"))
        rng.shuffle(qs)
        intro = f"The pie chart shows the percentage distribution of {total} {item} among {k} {grp}."
        vis = dict(type="pie", labels=cs, values=pcts, unit="%", title=f"Distribution of {item} (total = {total})")
        return dict(kind="set", topic="Data interpretation", sub="Pie chart DI", directions="Directions: Study the following pie chart carefully and answer the questions given below.", intro=intro, clues=[], visual=vis, qs=qs[:5],
                    derived=dict(headers=[grp[:-1].capitalize(), "%", "Number"], rows=[[c, f"{p}%", v] for c, p, v in zip(cs, pcts, vals)]))
    raise RuntimeError("pie")


# --- DI 3: bar / line chart: two series over 5 categories
def di_bar(rng, hard=False, line=False):
    ctx = rng.choice([("years", ["2019", "2020", "2021", "2022", "2023"], "production", "sales", "units (in hundreds)"),
                      ("shops", ["P", "Q", "R", "S", "T"], "pens sold", "pencils sold", "number"),
                      ("factories", ["F1", "F2", "F3", "F4", "F5"], "cars produced", "cars sold", "number"),
                      ("days", ["Mon", "Tue", "Wed", "Thu", "Fri"], "online orders", "offline orders", "number")])
    grp, cats, s1, s2, unit = ctx
    for _ in range(500):
        A = [rng.choice(range(40, 161, 4)) for _ in cats]
        B = [rng.choice(range(24, 141, 4)) for _ in cats]
        if line and grp != "years":
            pass
        qs = []
        i = rng.randrange(5)
        q = pct_change_q(rng, A[i], B[i], f"The {s1} in {cats[i]}", f"the {s2} in {cats[i]}", "Data interpretation", "Bar graph DI")
        if q is None:
            continue
        qs.append(q)
        sel = rng.sample(range(5), 4)
        q = avg_q(rng, [B[k] for k in sel], f"the {s2} in {', '.join(cats[k] for k in sel)}", "Data interpretation", "Bar graph DI")
        if q is None:
            continue
        qs.append(q)
        a, b = rng.sample(range(5), 2)
        qs.append(ratio_q(rng, A[a] + B[a], A[b] + B[b], f"the total ({s1} + {s2}) in {cats[a]}", f"that in {cats[b]}", "Data interpretation", "Bar graph DI"))
        a, b = rng.sample(range(5), 2)
        r1, r2 = rng.choice([(1, 3), (1, 4), (2, 3), (3, 5), (1, 1)])
        x = Fr(A[a] * r1, r1 + r2)
        if x.denominator != 1:
            qs.append(diff_q(rng, sum(A), sum(B), f"the total {s1} in all five {grp}", f"the total {s2}", "Data interpretation", "Bar graph DI"))
        else:
            pc = rng.choice([10, 20, 25, 50])
            y = Fr(B[b] * (100 + pc), 100)
            if y.denominator != 1:
                continue
            tot = int(x) + int(y)
            qs.append(make_q(f"{frac_str(Fr(r1, r1 + r2))} of the {s1} in {cats[a]} took place on weekends. If the {s2} in {cats[b]} rise by {pc}%, find the sum of the weekend {s1} in {cats[a]} and the new {s2} in {cats[b]}.",
                             tot, spaced(tot, rng, step=max(3, tot // 12)), [f"{A[a]} × {frac_str(Fr(r1, r1 + r2))} = {int(x)}; {B[b]} × {100 + pc}/100 = {int(y)}; sum = {tot}."], "Data interpretation", "Bar graph DI", time=55, rng=rng))
        mx = max(range(5), key=lambda k: A[k] - B[k])
        diffs = [A[k] - B[k] for k in range(5)]
        if diffs.count(max(diffs)) == 1:
            qs.append(make_q(f"In which of the {grp} is the difference between {s1} and {s2} (first minus second) the maximum?", cats[mx], [c for c in cats if c != cats[mx]],
                             [", ".join(f"{c}: {d}" for c, d in zip(cats, diffs)) + f" ⇒ {cats[mx]}."], "Data interpretation", "Bar graph DI", time=40, rng=rng))
        rng.shuffle(qs)
        kind = "line" if line else "bar"
        intro = f"The {'line' if line else 'bar'} graph shows the {s1} and the {s2} in five different {grp}."
        vis = dict(type=kind, categories=cats, series=[dict(name=s1.capitalize(), values=A), dict(name=s2.capitalize(), values=B)], unit=unit)
        sub = "Line graph DI" if line else "Bar graph DI"
        for q in qs:
            q['sub'] = sub
        return dict(kind="set", topic="Data interpretation", sub=sub, directions=f"Directions: Study the following {'line' if line else 'bar'} graph carefully and answer the questions given below.", intro=intro, clues=[], visual=vis, qs=qs[:5])
    raise RuntimeError("bar")


# =================================================================== CASELETS
def caselet_hubs(rng, hard=False):
    for _ in range(500):
        names = rng.choice([("IT", "Medical", "Food"), ("Sales", "Marketing", "Operations"), ("Plant X", "Plant Y", "Plant Z")])
        a = rng.choice(range(300, 1201, 50)); b = rng.choice(range(400, 1601, 50))
        c_pct = rng.choice([40, 50, 60])
        c = Fr(a + b) * c_pct / (100 - c_pct)
        if c.denominator != 1:
            continue
        c = int(c)
        ra = rng.choice([(2, 3), (3, 2), (1, 1), (3, 5), (4, 1), (2, 1)]); rb = rng.choice([(1, 1), (3, 1), (2, 3), (3, 2), (5, 3)])
        if a % sum(ra) or b % sum(rb):
            continue
        am, af = a * ra[0] // sum(ra), a * ra[1] // sum(ra)
        bm, bf = b * rb[0] // sum(rb), b * rb[1] // sum(rb)
        extra = rng.choice([40, 60, 80, 100, 120, 160])
        cf = bf + extra; cm = c - cf
        if cm <= 0:
            continue
        intro = (f"A certain number of people work in three units – {names[0]}, {names[1]} and {names[2]}. {a} people work in {names[0]} and {b} in {names[2]}; "
                 f"the remaining {c_pct}% of all the people work in {names[1]}. In {names[0]}, males : females = {ra[0]}:{ra[1]}; in {names[2]}, males : females = {rb[0]}:{rb[1]}. "
                 f"The number of females in {names[1]} is {extra} more than the number of females in {names[2]}.")
        qs = []
        qs.append(make_q(f"How many people work in {names[1]}?", c, spaced(c, rng, step=max(20, c // 10)), [f"{names[0]} + {names[2]} = {a + b} = {100 - c_pct}% of all ⇒ {names[1]} = {a + b} × {c_pct}/{100 - c_pct} = {c}."], "Caselet", "Caselet", time=45, rng=rng))
        qs.append(ratio_q(rng, cm, am, f"males in {names[1]}", f"males in {names[0]}", "Caselet", "Caselet"))
        q = pct_change_q(rng, af, bm, f"The number of females in {names[0]}", f"the number of males in {names[2]}", "Caselet", "Caselet")
        if q is None:
            q = diff_q(rng, af, bm, f"females in {names[0]}", f"males in {names[2]}", "Caselet", "Caselet")
        qs.append(q)
        av = Fr(am + bm + cm, 3)
        if clean(av, 2):
            qs.append(make_q(f"What is the average number of males in the three units?", av, [av + d for d in (-20, -10, 10, 15, 25)], [f"({am} + {bm} + {cm})/3 = {show(av)}."], "Caselet", "Caselet", time=40, fmt=show, rng=rng))
        else:
            qs.append(diff_q(rng, cm, cf, f"males in {names[1]}", f"females in {names[1]}", "Caselet", "Caselet"))
        inc = rng.choice([10, 20, 25])
        nb = Fr(b * (100 + inc), 100)
        add_m = rng.choice([20, 30, 40, 50])
        if nb.denominator != 1:
            continue
        nf = int(nb) - (bm + add_m)
        qs.append(make_q(f"If the people in {names[2]} increase by {inc}% and the males there increase by {add_m}, find the number of females in {names[2]}.", nf, spaced(nf, rng, step=max(10, nf // 10)),
                         [f"New total = {int(nb)}; new males = {bm} + {add_m} = {bm + add_m}; females = {nf}."], "Caselet", "Caselet", time=45, rng=rng))
        vis = dict(type="table", headers=["Unit", "Total", "Males", "Females"], rows=[[names[0], a, am, af], [names[1], c, cm, cf], [names[2], b, bm, bf]])
        return dict(kind="set", topic="Caselet", sub="Caselet", directions="Directions: Read the following information carefully and answer the questions given below.", intro=intro, clues=[], visual=vis, qs=qs[:5])
    raise RuntimeError("caselet hubs")


def caselet_venn(rng, hard=False):
    for _ in range(2000):
        ex = rng.choice([("GMAT", "CAT", "GRE"), ("Hindi", "English", "Sanskrit"), ("Cricket", "Hockey", "Tennis"), ("Tea", "Coffee", "Juice")])
        a, b, c = [rng.randrange(40, 801, 8) for _ in range(3)]  # only X, only Y, only Z
        d, e, f = [rng.randrange(16, 401, 8) for _ in range(3)]  # XY only, YZ only, XZ only
        g = rng.randrange(16, 321, 8)  # all
        T = a + b + c + d + e + f + g
        if T % 100 or T > 5000:
            continue
        X = a + d + f + g
        px = Fr(X * 100, T)
        if px.denominator != 1:
            continue
        two = d + e + f
        yz_notx = b + e
        intro = (f"In a group of {T} people, each likes at least one of {ex[0]}, {ex[1]} and {ex[2]}. {px}% of the people like {ex[0]}. {two} people like exactly two of the three, "
                 f"and {g} people like all three. {a} people like only {ex[0]}. The number who like {ex[0]} and {ex[2]} but not {ex[1]} is {abs(f - d)} {'more' if f > d else 'less'} than the number who like {ex[0]} and {ex[1]} but not {ex[2]}. "
                 f"{b + c + e} people do not like {ex[0]}, and {c} of them like only {ex[2]}.")
        if f == d:
            continue
        # check solvable: from X and a,g -> d+f ; given f-d -> d,f ; two -> e ; (b+c+e) & c -> b
        qs = []
        qs.append(make_q(f"How many people like {ex[1]} and {ex[2]} but not {ex[0]}?", e, spaced(e, rng, step=8), [f"{ex[0]} total = {X}; d + f = {X} − {a} − {g} = {d + f}; with f − d = {f - d} ⇒ d = {d}, f = {f}; e = {two} − {d + f} = {e}."], "Caselet", "Venn caselet", time=60, rng=rng))
        Y = b + d + e + g; Z = c + e + f + g
        qs.append(make_q(f"How many people like {ex[1]}?", Y, spaced(Y, rng, step=max(8, Y // 12)), [f"Only {ex[1]} = {b + c + e} − {c} − {e} = {b}; {ex[1]} = {b} + {d} + {e} + {g} = {Y}."], "Caselet", "Venn caselet", time=50, rng=rng))
        qs.append(make_q(f"How many people like exactly one of the three?", a + b + c, spaced(a + b + c, rng, step=16), [f"{a} + {b} + {c} = {a + b + c}."], "Caselet", "Venn caselet", time=40, rng=rng))
        q = pct_change_q(rng, Z, Y, f"The number of people who like {ex[2]}", f"the number who like {ex[1]}", "Caselet", "Venn caselet")
        if q is None:
            q = ratio_q(rng, Z, Y, f"people who like {ex[2]}", f"people who like {ex[1]}", "Caselet", "Venn caselet")
        qs.append(q)
        qs.append(make_q(f"How many people like {ex[0]} but not {ex[1]}?", a + f, spaced(a + f, rng, step=16), [f"Only {ex[0]} + ({ex[0]}∩{ex[2]} only) = {a} + {f} = {a + f}."], "Caselet", "Venn caselet", time=40, rng=rng))
        vis = dict(type="table", headers=["Region", f"Only {ex[0]}", f"Only {ex[1]}", f"Only {ex[2]}", f"{ex[0]}∩{ex[1]} only", f"{ex[1]}∩{ex[2]} only", f"{ex[0]}∩{ex[2]} only", "All three"], rows=[["People", a, b, c, d, e, f, g]])
        return dict(kind="set", topic="Caselet", sub="Venn caselet", directions="Directions: Read the following information carefully and answer the questions given below.", intro=intro, clues=[], visual=vis, qs=qs)
    raise RuntimeError("venn")


def caselet_seats(rng, hard=False):
    for _ in range(2000):
        B = rng.randrange(100, 401, 10)
        pc = rng.choice([60, 70, 75, 80])
        A = Fr(B * pc, 100)
        if A.denominator != 1:
            continue
        A = int(A)
        va, vb = rng.choice([(4, 3), (3, 2), (5, 4), (2, 3), (3, 4), (5, 3)])
        x = rng.randint(4, 15)
        VA, VB = va * x, vb * x
        OA, OB = A - VA, B - VB
        if OA <= 10 or OB <= 10 or OA == OB:
            continue
        gap = OB - OA
        word = "less" if gap > 0 else "more"
        intro = (f"There are two buses, A and B. The ratio of vacant seats in A to those in B is {va}:{vb}. The number of occupied seats in A is {abs(gap)} {word} than that in B. "
                 f"The total number of seats in A is {pc}% of that in B, and B has {B - A} more seats than A.")
        qs = []
        qs.append(make_q("How many occupied seats are there in bus A?", OA, spaced(OA, rng, step=max(4, OA // 10)), [f"B − A = {B - A} and A = {pc}% of B ⇒ B = {B}, A = {A}.", f"Vacant {va}x and {vb}x: ({B} − {vb}x) − ({A} − {va}x) = {gap} ⇒ x = {x}.", f"Occupied A = {A} − {VA} = {OA}."], "Caselet", "Caselet", time=60, rng=rng))
        q = pct_change_q(rng, OB, VB, "The occupied seats in B", "the vacant seats in B", "Caselet", "Caselet")
        if q is None:
            q = ratio_q(rng, OB, VB, "occupied seats in B", "vacant seats in B", "Caselet", "Caselet")
        qs.append(q)
        tot = Fr(A * 100, OA + OB)
        if clean(tot):
            qs.append(make_q("The total seats in A are what percentage of the occupied seats in A and B together?", tot, [tot + d for d in (-10, -5, 5, 10, 15)], [f"{A}/({OA} + {OB}) × 100 = {show(tot)}%."], "Caselet", "Caselet", time=45, fmt=lambda v: f"{show(v)}%", rng=rng))
        else:
            qs.append(diff_q(rng, VA + VB, OA, "the total vacant seats in A and B", "the occupied seats in A", "Caselet", "Caselet"))
        vis = dict(type="table", headers=["Bus", "Total", "Vacant", "Occupied"], rows=[["A", A, VA, OA], ["B", B, VB, OB]])
        return dict(kind="set", topic="Caselet", sub="Caselet", directions="Directions: Read the following information carefully and answer the questions given below.", intro=intro, clues=[], visual=vis, qs=qs)
    raise RuntimeError("seats")


# =================================================================== ARITHMETIC
def A(stem, ans, sol, sub, rng, fmt=None, step=None, time=60, dis=None):
    fmt = fmt or (lambda v: fmt_num(v))
    dis = dis or spaced(ans, rng, step=step or max(1, int(abs(ans) * 0.1)))
    return make_q(stem, ans, dis, sol, "Arithmetic", sub, time=time, fmt=fmt, rng=rng)


def ar_profit_markup(rng, hard=False):
    for _ in range(300):
        cp = rng.randrange(1200, 30001, 100); m = rng.choice([20, 25, 30, 40, 50, 60]); d = rng.choice([10, 12, 15, 20, 25])
        mp = Fr(cp * (100 + m), 100); sp = mp * (100 - d) / 100
        if mp.denominator != 1 or sp.denominator != 1 or sp <= cp:
            continue
        prof = int(sp) - cp; disc = int(mp - sp)
        v = rng.random()
        if v < 0.5:
            return A(f"A shopkeeper marks an article {m}% above its cost price and allows a discount of {d}%. If his profit is Rs. {prof}, find the cost price of the article.", cp,
                     [f"SP = CP × {100 + m}/100 × {100 - d}/100 = {Fr((100 + m) * (100 - d), 10000)} × CP.", f"Profit = {float(Fr((100 + m) * (100 - d), 10000) - 1):.4g} × CP = {prof} ⇒ CP = {cp}."], "Profit & loss", rng, fmt=money, step=max(100, cp // 10))
        return A(f"The marked price of an article is {m}% above its cost price. The shopkeeper gives a discount of Rs. {disc} and still earns a profit of Rs. {prof}. Find the cost price.", cp,
                 [f"Mark-up = discount + profit = {disc} + {prof} = {disc + prof}.", f"{m}% of CP = {disc + prof} ⇒ CP = {cp}."], "Profit & loss", rng, fmt=money, step=max(100, cp // 10))


def ar_profit_two(rng, hard=False):
    for _ in range(500):
        cp = rng.randrange(400, 6001, 50); l = rng.choice([10, 15, 20, 25]); p = rng.choice([10, 15, 20, 25, 30])
        dc = rng.randrange(100, 1501, 50)
        sp = Fr(cp * (100 - l), 100); sp2 = Fr((cp + dc) * (100 + p), 100)
        if sp.denominator != 1 or sp2.denominator != 1:
            continue
        ds = int(sp2 - sp)
        if ds <= 0:
            continue
        return A(f"An article is sold at a loss of {l}%. Had it been bought for Rs. {dc} more and sold for Rs. {ds} more, there would have been a profit of {p}%. Find the original cost price.", cp,
                 [f"Let CP = c. Then {Fr(100 - l, 100)}c + {ds} = {Fr(100 + p, 100)}(c + {dc}).", f"Solving ⇒ c = {cp}. (Faster: test the options.)"], "Profit & loss", rng, fmt=money, step=max(50, cp // 10))


def ar_si_ci(rng, hard=False):
    v = rng.random()
    for _ in range(300):
        if v < 0.35:
            r = rng.choice([5, 8, 10, 12, 15, 20]); P = rng.randrange(2000, 40001, 500)
            diff = Fr(P * r * r, 10000)
            if diff.denominator != 1:
                continue
            return A(f"The difference between the compound interest and the simple interest on a sum for 2 years at {r}% per annum is Rs. {int(diff)}. Find the sum.", P,
                     [f"CI − SI (2 yrs) = P(R/100)² ⇒ P × {Fr(r * r, 10000)} = {int(diff)} ⇒ P = {P}."], "SI & CI", rng, fmt=money, step=max(500, P // 10))
        if v < 0.7:
            r = rng.choice([10, 20]); P = rng.randrange(5000, 30001, 500); r2 = rng.choice([8, 10, 12, 15]); t2 = rng.choice([2, 3, 4])
            ci = Fr(P) * ((1 + Fr(r, 100)) ** 2 - 1)
            si = ci * r2 * t2 / 100
            if ci.denominator != 1 or si.denominator != 1:
                continue
            return A(f"Rs. {P} is invested at {r}% per annum compound interest for 2 years. The interest earned is then invested at {r2}% per annum simple interest for {t2} years. Find the simple interest earned.", int(si),
                     [f"CI = {P} × ({(1 + Fr(r, 100)) ** 2} − 1) = {int(ci)}.", f"SI = {int(ci)} × {r2} × {t2}/100 = {int(si)}."], "SI & CI", rng, fmt=money, step=max(50, int(si) // 10))
        r = rng.choice([6, 8, 10, 12, 15, 16]); t = rng.choice([3, 4, 5, 6]); P = rng.randrange(2000, 25001, 500)
        amt = Fr(P * (100 + r * t), 100)
        if amt.denominator != 1:
            continue
        return A(f"A sum of money amounts to Rs. {int(amt)} in {t} years at {r}% per annum simple interest. Find the sum.", P, [f"Amount = P(1 + RT/100) = P × {Fr(100 + r * t, 100)} ⇒ P = {P}."], "SI & CI", rng, fmt=money, step=max(250, P // 10))


def ar_partnership(rng, hard=False):
    for _ in range(500):
        a = rng.randrange(3000, 20001, 500); b = rng.randrange(3000, 20001, 500); m = rng.choice([4, 5, 6, 8]); ch = rng.randrange(1000, 5001, 500)
        sa = a * m + (a + ch) * (12 - m); sb = b * m + (b - ch) * (12 - m)
        if b - ch <= 0:
            continue
        g = math.gcd(sa, sb); ra, rb = sa // g, sb // g
        if ra + rb > 60:
            continue
        unit = rng.randrange(50, 1001, 10)
        pa, pb = ra * unit, rb * unit
        return A(f"A and B start a business with Rs. {a} and Rs. {b} respectively. After {m} months, A invests Rs. {ch} more and B withdraws Rs. {ch}. At the end of the year A's share of profit is Rs. {pa}. Find B's share.", pb,
                 [f"A : B = ({a}×{m} + {a + ch}×{12 - m}) : ({b}×{m} + {b - ch}×{12 - m}) = {sa} : {sb} = {ra}:{rb}.", f"1 part = {pa}/{ra} = {unit} ⇒ B = {pb}."], "Partnership", rng, fmt=money, step=max(50, pb // 10))


def ar_ages(rng, hard=False):
    for _ in range(500):
        k = rng.randint(2, 9); a, b = rng.choice([(3, 4), (5, 7), (4, 5), (7, 9), (5, 6), (2, 3), (9, 11)])
        x = rng.randint(2, 8); y = rng.randint(3, 10)
        A_, B_ = a * k, b * k
        # after y years ratio
        na, nb = A_ + y, B_ + y
        g = math.gcd(na, nb)
        if A_ < 10 or (na // g, nb // g) == (a, b) or na // g > 20:
            continue
        ask = rng.choice(["A", "B", "sum"])
        ans = {"A": A_ - x, "B": B_ - x, "sum": A_ + B_}[ask]
        stem = (f"The ratio of the present ages of P and Q is {a}:{b}. After {y} years, the ratio will become {na // g}:{nb // g}. "
                + {"A": f"What was P's age {x} years ago?", "B": f"What was Q's age {x} years ago?", "sum": "What is the sum of their present ages?"}[ask])
        return A(stem, ans, [f"({a}k + {y})/({b}k + {y}) = {na // g}/{nb // g} ⇒ k = {k}.", f"P = {A_}, Q = {B_} ⇒ answer {ans}."], "Ages", rng, fmt=lambda v: f"{v} years", step=rng.choice([2, 3, 4]), time=50)


def ar_mixture(rng, hard=False):
    v = rng.random()
    for _ in range(500):
        if v < 0.5:
            V = rng.randrange(40, 241, 10); x1 = rng.choice([V // 10, V // 5, V // 4]); x2 = rng.choice([V // 10, V // 5, V // 8])
            milk = Fr(V) * (1 - Fr(x1, V)) * (1 - Fr(x2, V))
            if milk.denominator != 1 or x1 == 0 or x2 == 0:
                continue
            water = V - int(milk)
            return A(f"A container has {V} litres of pure milk. {x1} litres are taken out and replaced with water. Then {x2} litres of the mixture are taken out and replaced with water. How much water is in the container now?", water,
                     [f"Milk left = {V} × (1 − {x1}/{V}) × (1 − {x2}/{V}) = {int(milk)} L.", f"Water = {V} − {int(milk)} = {water} L."], "Mixture", rng, fmt=lambda v: f"{v} litres", step=max(2, water // 8))
        m, w = rng.choice([(3, 2), (5, 3), (4, 1), (7, 3), (5, 2), (2, 1)]); k = rng.randint(2, 12); add = rng.randint(2, 20)
        nm, nw = m * k + add, w * k
        g = math.gcd(nm, nw)
        if nm // g > 20:
            continue
        return A(f"In a mixture, milk and water are in the ratio {m}:{w}. When {add} litres of milk is added, the ratio becomes {nm // g}:{nw // g}. Find the initial quantity of the mixture.", (m + w) * k,
                 [f"({m}k + {add})/{w}k = {nm // g}/{nw // g} ⇒ k = {k}.", f"Initial = {m + w}k = {(m + w) * k} L."], "Mixture", rng, fmt=lambda v: f"{v} litres", step=max(3, k))


def ar_alligation(rng, hard=False):
    for _ in range(500):
        q1 = rng.randrange(10, 61, 5); q2 = rng.randrange(10, 61, 5); p1 = rng.randrange(40, 121, 2); p2 = rng.randrange(40, 121, 2)
        if p1 == p2:
            continue
        cost = Fr(q1 * p1 + q2 * p2, q1 + q2)
        if cost.denominator != 1:
            continue
        prof = rng.choice([10, 20, 25, 30, 40, 50])
        sp = cost * (100 + prof) / 100
        if sp.denominator != 1:
            continue
        return A(f"A trader mixes {q1} kg of rice costing Rs. {p1}/kg with {q2} kg costing Rs. {p2}/kg and sells the mixture at a profit of {prof}%. Find the selling price per kg.", int(sp),
                 [f"Cost per kg = ({q1}×{p1} + {q2}×{p2})/{q1 + q2} = {show(cost)}.", f"SP = {show(cost)} × {100 + prof}/100 = {int(sp)}."], "Mixture", rng, fmt=lambda v: f"Rs. {v}", step=max(3, int(sp) // 12))


def ar_work(rng, hard=False):
    v = rng.random()
    for _ in range(500):
        if v < 0.4:
            a = rng.choice([10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60]); b = rng.choice([10, 12, 15, 18, 20, 24, 30, 36, 40, 45, 60]); t = rng.choice([4, 5, 6, 8, 9, 10, 12])
            c = 1 / (Fr(1, t) - Fr(1, a) - Fr(1, b)) if Fr(1, t) - Fr(1, a) - Fr(1, b) > 0 else None
            if not c or c.denominator != 1 or a == b:
                continue
            wages = rng.randrange(1200, 12001, 100)
            L = math.lcm(a, b, int(c), t)
            ea, eb, ec = L // a, L // b, L // int(c)
            if wages % (ea + eb + ec):
                continue
            unit = wages // (ea + eb + ec)
            ans = unit * ec
            return A(f"A and B can complete a work in {a} days and {b} days respectively. A, B and C together complete it in {t} days. If the total wages are Rs. {wages}, find C's share.", ans,
                     [f"Total work = {L} units: A {ea}/day, B {eb}/day, all {L // t}/day ⇒ C {ec}/day.", f"Wages split {ea}:{eb}:{ec} ⇒ C = {wages} × {ec}/{ea + eb + ec} = {ans}."], "Time & work", rng, fmt=money, step=max(50, ans // 8))
        if v < 0.7:
            a = rng.choice([10, 12, 15, 20, 24, 30, 36, 40]); b = rng.choice([12, 15, 20, 24, 30, 40, 45, 60]); l = rng.choice([20, 30, 40, 45, 60, 72, 90, 120])
            net = Fr(1, a) + Fr(1, b) - Fr(1, l)
            if net <= 0:
                continue
            t = 1 / net
            if not clean(t, 1):
                continue
            return A(f"Pipes A and B can fill a tank in {a} hours and {b} hours respectively, and pipe C can empty the full tank in {l} hours. If all three are opened together, in how many hours will the tank be filled?", t,
                     [f"Net rate = 1/{a} + 1/{b} − 1/{l} = {net} ⇒ time = {show(t)} h."], "Pipes & cisterns", rng, fmt=lambda v: f"{show(v)} hours", step=2, dis=[t + d for d in (-3, -2, 2, 3, 5)])
        a = rng.choice([12, 15, 18, 20, 24, 30, 36]); eff = rng.choice([(2, "two times more efficient", 3), (1, "twice as efficient", 2), (3, "three times as efficient", 3), (4, "half as efficient", Fr(1, 2))])
        mult = eff[2]
        tc = Fr(a) / mult
        if not clean(tc, 1):
            continue
        together = 1 / (Fr(1, a) + 1 / tc)
        if not clean(together, 2):
            continue
        return A(f"A can complete a work in {a} days. B is {eff[1]} than A. In how many days can A and B together complete the work?".replace("half as efficient than", "half as efficient as").replace("twice as efficient than", "twice as efficient as").replace("three times as efficient than", "three times as efficient as"), together,
                 [f"B's efficiency = {show(Fr(mult))} × A's ('x times MORE' means x + 1 times) ⇒ B alone = {show(tc)} days.", f"Together = 1/(1/{a} + 1/{show(tc)}) = {show(together)} days."], "Time & work", rng, fmt=lambda v: f"{show(v)} days", dis=[together + d for d in (-2, -1, 1, 2, 3)])


def ar_boat(rng, hard=False):
    v = rng.random()
    for _ in range(500):
        s = rng.randint(2, 8); b = rng.randint(s + 4, 30)
        if v < 0.5:
            t_up = rng.randint(3, 12)
            D = (b - s) * t_up
            if D % (b + s):
                continue
            t_dn = D // (b + s)
            T = rng.randint(2, 8)
            return A(f"A boat covers a certain distance upstream in {t_up} hours and the same distance downstream in {t_dn} hours. If the speed of the stream is {s} km/h, find the distance covered by the boat in still water in {T} hours.", b * T,
                     [f"{t_up}(b − {s}) = {t_dn}(b + {s}) ⇒ b = {b} km/h.", f"Distance = {b} × {T} = {b * T} km."], "Boats & streams", rng, fmt=lambda v: f"{v} km", step=max(4, b))
        Dd = rng.randint(2, 6) * (b + s); Du = rng.randint(2, 6) * (b - s)
        td, tu = Dd // (b + s), Du // (b - s)
        return A(f"A boat covers {Dd} km downstream in {td} hours and {Du} km upstream in {tu} hours. Find the speed of the stream.", s,
                 [f"Downstream speed = {b + s}, upstream speed = {b - s}.", f"Stream = ({b + s} − {b - s})/2 = {s} km/h."], "Boats & streams", rng, fmt=lambda v: f"{v} km/h", dis=[s + d for d in (-2, -1, 1, 2, 3) if s + d > 0])


def ar_train(rng, hard=False):
    v = rng.random()
    for _ in range(500):
        if v < 0.5:
            sp = rng.choice([10, 12, 15, 18, 20, 25, 30]); L = sp * rng.randint(8, 20); Pl = sp * rng.randint(5, 20)
            t1 = L // sp; t2 = (L + Pl) // sp
            return A(f"A train crosses a pole in {t1} seconds and a platform {Pl} m long in {t2} seconds. Find the length of the train.", L,
                     [f"Speed = {Pl}/({t2} − {t1}) = {sp} m/s.", f"Length = {sp} × {t1} = {L} m."], "Trains", rng, fmt=lambda v: f"{v} m", step=max(20, L // 10))
        s1 = rng.choice([36, 45, 54, 72, 90]); s2 = rng.choice([18, 27, 36, 45, 54]); L1 = rng.randrange(100, 301, 10); L2 = rng.randrange(80, 301, 10)
        rel = Fr(s1 + s2) * 5 / 18
        t = Fr(L1 + L2) / rel
        if t.denominator != 1:
            continue
        return A(f"Two trains of lengths {L1} m and {L2} m are running in opposite directions at {s1} km/h and {s2} km/h. In how many seconds will they cross each other?", int(t),
                 [f"Relative speed = ({s1} + {s2}) × 5/18 = {show(rel)} m/s.", f"Time = ({L1} + {L2})/{show(rel)} = {int(t)} s."], "Trains", rng, fmt=lambda v: f"{v} seconds", step=max(2, int(t) // 8))


def ar_speed(rng, hard=False):
    for _ in range(500):
        s1 = rng.choice([10, 12, 15, 20, 24, 30, 36, 40]); s2 = s1 + rng.choice([2, 3, 4, 5, 6, 10])
        late = rng.choice([10, 12, 15, 20, 30]); early = rng.choice([0, 5, 6, 10])
        D = Fr(s1 * s2, s2 - s1) * Fr(late + early, 60)
        if D.denominator != 1:
            continue
        if early:
            stem = f"A man walking at {s1} km/h reaches his office {late} minutes late. If he walks at {s2} km/h he reaches {early} minutes early. Find the distance to his office."
        else:
            stem = f"A man travelling at {s1} km/h reaches {late} minutes late. If he travels at {s2} km/h he reaches on time. Find the distance."
        return A(stem, int(D), [f"D = S1 × S2/(S2 − S1) × (time difference) = {s1}×{s2}/{s2 - s1} × {late + early}/60 = {int(D)} km."], "Speed, time & distance", rng, fmt=lambda v: f"{v} km", step=max(2, int(D) // 8))


def ar_mensuration(rng, hard=False):
    v = rng.random()
    for _ in range(500):
        if v < 0.35:
            r = rng.choice([7, 14, 21, 28, 35]); h = rng.choice([5, 10, 15, 20, 25, 30, 6, 8])
            vol = Fr(22, 7) * r * r * h; tsa = 2 * Fr(22, 7) * r * (r + h)
            if vol.denominator != 1 or tsa.denominator != 1:
                continue
            return A(f"The volume of a cylinder is {int(vol)} cm³ and its radius is equal to the radius of a circle whose area is {int(Fr(22, 7) * r * r)} cm². Find the total surface area of the cylinder. (π = 22/7)", int(tsa),
                     [f"πr² = {int(Fr(22, 7) * r * r)} ⇒ r = {r}.", f"h = {int(vol)}/{int(Fr(22, 7) * r * r)} = {h}.", f"TSA = 2πr(r + h) = {int(tsa)} cm²."], "Mensuration", rng, fmt=lambda v: f"{v} cm²", step=max(44, int(tsa) // 10))
        if v < 0.65:
            a, b, c = rng.choice([(3, 4, 5), (6, 8, 10), (5, 12, 13), (9, 12, 15), (8, 15, 17), (12, 16, 20)])
            r, h = (a, b) if rng.random() < 0.5 else (b, a)
            pi = rng.choice([3, Fr(22, 7)])
            vol = Fr(1, 3) * pi * r * r * h
            if vol.denominator != 1:
                continue
            return A(f"The volume of a cone is {int(vol)} cm³ and its height is {h} cm. Find its slant height. (π = {frac_str(pi) if pi != 3 else 3})", c,
                     [f"(1/3)πr²h = {int(vol)} ⇒ r² = {r * r} ⇒ r = {r}.", f"l = √({r}² + {h}²) = {c} cm."], "Mensuration", rng, fmt=lambda v: f"{v} cm", dis=[c + d for d in (-3, -2, 1, 2, 4) if c + d > 0])
        h = rng.randint(3, 10); da, db = rng.choice([(3, -1), (2, 1), (4, -2), (1, 2), (5, -1)])
        l, b = h + da, h + db
        if b <= 0:
            continue
        lsa = 2 * h * (l + b)
        return A(f"The length and breadth of a cuboid are {abs(da)} cm {'more' if da > 0 else 'less'} and {abs(db)} cm {'more' if db > 0 else 'less'} than its height respectively. If its lateral surface area is {lsa} cm², find its volume.", l * b * h,
                 [f"2h(l + b) = 2h(2h {'+' if da + db >= 0 else '−'} {abs(da + db)}) = {lsa} ⇒ h = {h}.", f"Volume = {l} × {b} × {h} = {l * b * h} cm³."], "Mensuration", rng, fmt=lambda v: f"{v} cm³", step=max(10, l * b * h // 8))


def ar_average(rng, hard=False):
    v = rng.random()
    for _ in range(300):
        if v < 0.5:
            n = rng.randint(12, 40); err = rng.randint(1, 4) * n // rng.choice([1, 2]) if False else None
            inc = rng.choice([Fr(1, 2), Fr(1), Fr(2), Fr(3, 2)])
            e = n * inc
            if e.denominator != 1:
                continue
            avg = rng.randint(30, 70)
            return A(f"The average weight of a group of students is {avg} kg. One weight was wrongly recorded as {int(e)} kg less than the actual weight. After correction, the average increases by {show(inc)} kg. How many students are there?", n,
                     [f"n = error ÷ change in average = {int(e)} ÷ {show(inc)} = {n}."], "Averages", rng, dis=[n + d for d in (-4, -2, 2, 4, 6) if n + d > 0], time=40)
        n = rng.randint(8, 30); avg = rng.randint(25, 60); newavg = avg + rng.choice([1, 2, 3])
        age = newavg * (n + 1) - avg * n
        return A(f"The average age of {n} members of a club is {avg} years. When a new member joins, the average becomes {newavg} years. What is the age of the new member?", age,
                 [f"New member = {newavg} × {n + 1} − {avg} × {n} = {age}."], "Averages", rng, fmt=lambda v: f"{v} years", step=max(2, age // 12), time=40)


def ar_income(rng, hard=False):
    for _ in range(500):
        a, b, c = rng.choice([10, 15, 20, 25, 30]), rng.choice([20, 25, 30, 35, 40]), rng.choice([25, 40, 50, 60, 75])
        inc = rng.randrange(20000, 100001, 1000)
        rem = Fr(inc) * (100 - a) / 100 * (100 - b) / 100 * (100 - c) / 100
        if rem.denominator != 1:
            continue
        up = rng.choice([10, 20, 25])
        ans = Fr(inc * (100 + up), 100)
        if ans.denominator != 1:
            continue
        return A(f"Ravi spends {a}% of his income on rent, {b}% of the remaining on food and {c}% of the rest on travel. He is left with Rs. {int(rem)}. If his income increases by {up}%, what is his new income?", int(ans),
                 [f"Income × {Fr(100 - a, 100)} × {Fr(100 - b, 100)} × {Fr(100 - c, 100)} = {int(rem)} ⇒ income = {inc}.", f"New income = {inc} × {100 + up}/100 = {int(ans)}."], "Percentage", rng, fmt=money, step=max(1000, int(ans) // 10))


def ar_population(rng, hard=False):
    for _ in range(300):
        r = rng.choice([5, 10, 20]); n = rng.choice([2, 3]); P = rng.randrange(5000, 100001, 1000)
        sign = rng.choice([1, -1])
        fin = Fr(P) * (1 + sign * Fr(r, 100)) ** n
        if fin.denominator != 1:
            continue
        return A(f"The population of a town {'increases' if sign > 0 else 'decreases'} by {r}% every year. After {n} years it becomes {int(fin)}. Find the present population.", P,
                 [f"P × ({(1 + sign * Fr(r, 100))})^{n} = {int(fin)} ⇒ P = {P}."], "Percentage", rng, step=max(500, P // 10), time=45)


def ar_ratio_chain(rng, hard=False):
    for _ in range(500):
        r1, r2, r3 = rng.choice([(2, 3), (3, 4), (4, 5), (1, 2)]), rng.choice([(2, 5), (3, 2), (4, 3), (5, 6)]), rng.choice([(3, 4), (2, 3), (5, 4), (6, 5)])
        p, q = r1; q2, r_ = r2; r2_, s = r3
        P_ = p * q2 * r2_; Q_ = q * q2 * r2_; R_ = q * r_ * r2_; S_ = q * r_ * s
        g = math.gcd(math.gcd(P_, Q_), math.gcd(R_, S_))
        P_, Q_, R_, S_ = P_ // g, Q_ // g, R_ // g, S_ // g
        tot = P_ + Q_ + R_ + S_
        k = rng.randint(10, 200)
        T = tot * k
        if T > 30000 or T < 1500:
            continue
        ans = (Q_ + R_) * k
        return A(f"An amount of Rs. {T} is divided among P, Q, R and S such that P : Q = {p}:{q}, Q : R = {q2}:{r_} and R : S = {r2_}:{s}. Find the total share of Q and R.", ans,
                 [f"Combined ratio P:Q:R:S = {P_}:{Q_}:{R_}:{S_} (sum {tot}).", f"Q + R = {Q_ + R_}/{tot} × {T} = {ans}."], "Ratio & proportion", rng, fmt=money, step=max(10, ans // 10))


ARITH = [ar_profit_markup, ar_profit_two, ar_si_ci, ar_partnership, ar_ages, ar_mixture, ar_alligation, ar_work, ar_work, ar_boat, ar_train, ar_speed, ar_mensuration, ar_average, ar_income, ar_population, ar_ratio_chain]


def gen_arithmetic_block(rng, n=10, hard=False):
    fns = list(ARITH)
    rng.shuffle(fns)
    out = []
    used = set()
    for f in fns:
        if len(out) == n:
            break
        if f.__name__ in used:
            continue
        q = f(rng, hard)
        if q is None:
            continue
        used.add(f.__name__)
        out.append(q)
    while len(out) < n:
        q = rng.choice(ARITH)(rng, hard)
        if q:
            out.append(q)
    return out
