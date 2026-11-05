"""Shared helpers for the RRB PO mock generator."""
import random, math
from fractions import Fraction

NUMW = ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen"]
ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]
ORDC = [o.capitalize() for o in ORD]
LETTER = "ABCDE"


def numword(k):
    return NUMW[k] if k < len(NUMW) else str(k)


class Q(dict):
    """A question: stem, options (5), ans (index), sol (list of steps), plus metadata."""


def make_q(stem, correct, distractors, sol, topic, sub="", time=36, fmt=str, shuffle=True, rng=None, fixed_order=None):
    """Build a 5-option question. correct + distractors are raw values; fmt renders them."""
    rng = rng or random
    opts = [correct]
    for d in distractors:
        if fmt(d) not in [fmt(o) for o in opts]:
            opts.append(d)
        if len(opts) == 5:
            break
    if len(opts) < 5:
        raise ValueError("not enough distinct options for: " + stem[:60])
    if fixed_order is not None:
        opts = fixed_order(opts)
    elif shuffle:
        rng.shuffle(opts)
    texts = [fmt(o) for o in opts]
    assert len(set(texts)) == 5, texts
    ans = texts.index(fmt(correct))
    return Q(stem=stem, options=texts, ans=ans, sol=sol if isinstance(sol, list) else [sol], topic=topic, sub=sub, time=time)


def fixed_options_q(stem, options, ans, sol, topic, sub="", time=30):
    assert len(options) == 5 and len(set(options)) == 5
    return Q(stem=stem, options=list(options), ans=ans, sol=sol if isinstance(sol, list) else [sol], topic=topic, sub=sub, time=time)


def num_distractors(ans, rng, spread=None, integer=True, k=4, positive=True):
    """Plausible numeric distractors around ans."""
    out = set()
    if spread is None:
        spread = max(1, abs(ans) * 0.12)
    tries = 0
    while len(out) < k and tries < 500:
        tries += 1
        d = rng.choice([-1, 1]) * rng.uniform(0.25, 1.6) * spread
        v = ans + d
        if integer:
            v = int(round(v))
            if abs(ans) >= 100:
                step = 10 if abs(ans) >= 1000 else (5 if rng.random() < 0.6 else 1)
                v = int(round(v / step) * step)
        else:
            v = round(v, 2)
        if v == ans or (positive and v <= 0):
            continue
        out.add(v)
    return list(out)


def indian(n):
    s = str(abs(int(n)))
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:]); head = head[:-2]
        if head:
            parts.insert(0, head)
        s = ",".join(parts) + "," + tail
    return ("-" if n < 0 else "") + s


def fmt_num(v):
    if isinstance(v, Fraction):
        v = float(v)
    if isinstance(v, float):
        if abs(v - round(v)) < 1e-9:
            v = int(round(v))
        else:
            return f"{v:.2f}".rstrip("0").rstrip(".")
    if isinstance(v, int) and abs(v) >= 10000:
        return indian(v)
    return str(v)


def money(v):
    return "Rs. " + fmt_num(v)


def pct(v):
    return fmt_num(v) + "%"


def frac_str(fr):
    fr = Fraction(fr)
    if fr.denominator == 1:
        return str(fr.numerator)
    return f"{fr.numerator}/{fr.denominator}"


def ratio_str(a, b):
    g = math.gcd(int(a), int(b))
    return f"{int(a)//g}:{int(b)//g}"


def pick_names(rng, n, pool=None):
    pool = pool or list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    return rng.sample(pool, n)


NAME_POOLS = [list("ABCDEFGHI"), list("PQRSTUVWX"), list("JKLMNOPQR"), list("DEFGHIJKL"), list("LMNOPQRSTU"), list("ABCDEFGHIJ")]

ATTRS = {
    "colour": ["Red", "Blue", "Green", "Yellow", "Pink", "White", "Black", "Orange", "Violet"],
    "fruit": ["Apple", "Mango", "Banana", "Kiwi", "Guava", "Papaya", "Grapes", "Orange", "Litchi"],
    "city": ["Delhi", "Pune", "Agra", "Surat", "Patna", "Indore", "Jaipur", "Kochi", "Ranchi"],
    "car": ["Audi", "BMW", "Honda", "Kia", "Tata", "Skoda", "Volvo", "Jeep", "Ford"],
    "subject": ["Hindi", "English", "Maths", "Physics", "History", "Geography", "Biology", "Chemistry", "Civics"],
    "sport": ["Cricket", "Hockey", "Tennis", "Chess", "Kabaddi", "Football", "Boxing", "Golf", "Polo"],
}
ATTR_VERB = {"colour": "likes", "fruit": "likes", "city": "belongs to", "car": "owns", "subject": "teaches", "sport": "plays"}
ATTR_THE = {"colour": "likes {}", "fruit": "likes {}", "city": "belongs to {}", "car": "owns {}", "subject": "teaches {}", "sport": "plays {}"}
