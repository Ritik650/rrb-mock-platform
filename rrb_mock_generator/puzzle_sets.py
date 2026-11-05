"""Turn a solved arrangement into an exam-style 5-question set."""
import random
from util import *
from puzzles import *

COMBOS = ["Only I", "Only II", "Only III", "Only I and II", "Only II and III", "Only I and III", "All I, II and III", "None is true"]


def combo_of(truths):
    t = [i for i, v in enumerate(truths) if v]
    m = {(): "None is true", (0,): "Only I", (1,): "Only II", (2,): "Only III", (0, 1): "Only I and II", (1, 2): "Only II and III", (0, 2): "Only I and III", (0, 1, 2): "All I, II and III"}
    return m[tuple(t)]


def reldesc(k, side):
    if k == 1:
        return f"Immediate {side}"
    return f"{ORDC[k]} to the {side}"


class SetBuilder:
    def __init__(self, L, sol, rng):
        self.L, self.sol, self.rng = L, sol, rng
        self.n = L.n
        self.names = L.names

    def P(self):
        return list(range(self.n))

    def other_names(self, exclude, k=4):
        pool = [self.names[i] for i in range(self.n) if self.names[i] not in exclude]
        self.rng.shuffle(pool)
        return pool[:k]

    def person_q(self, stem, ans_idx, sol_line, topic_sub, extra_wrong=None):
        ans = self.names[ans_idx]
        wrong = self.other_names([ans] + (extra_wrong or []), 6)
        return make_q(stem, ans, wrong, sol_line, "Puzzle", topic_sub, time=40, rng=self.rng)

    def count_q(self, stem, val, sol_line, sub):
        cands = [v for v in range(0, 8) if v != val]
        self.rng.shuffle(cands)
        dis = sorted(cands[:4])
        fmtc = lambda v: numword(v) if v > 0 else "None"
        opts = [val] + dis
        return make_q(stem, val, dis, sol_line, "Puzzle", sub, time=35, fmt=fmtc, rng=self.rng)

    def statements_q(self, stmts, sub):
        # stmts: list of (text, truth); choose 3 with varied truths
        rng = self.rng
        rng.shuffle(stmts)
        trues = [s for s in stmts if s[1]]
        falses = [s for s in stmts if not s[1]]
        k = rng.choice([1, 1, 2, 2, 3, 0])
        if len(trues) < k or len(falses) < 3 - k:
            k = min(len(trues), 3)
        pick = trues[:k] + falses[:3 - k]
        rng.shuffle(pick)
        if len(pick) < 3:
            return None
        truths = [p[1] for p in pick]
        correct = combo_of(truths)
        others = [c for c in COMBOS if c != correct]
        rng.shuffle(others)
        stem = "Which of the following statements is/are true as per the final arrangement?\n" + "\n".join(f"{r}. {p[0]}" for r, p in zip(["I", "II", "III"], pick))
        sol = [f"{r}: {'True' if p[1] else 'False'}." for r, p in zip(["I", "II", "III"], pick)]
        return make_q(stem, correct, others, sol, "Puzzle", sub, time=50, rng=self.rng)


# ------------------------------------------------------------------ linear / circle / parallel(same row)
def seat_questions(L, sol, rng, sub):
    B = SetBuilder(L, sol, rng)
    n = L.n
    names = L.names
    qs = []
    is_circle = L.kind == "circle"
    north = getattr(L, "facing", "") == "north"

    def who_at():
        for _ in range(40):
            X = rng.randrange(n); k = rng.randint(1, 4 if not is_circle else 3); side = rng.choice(["left", "right"])
            Y = L.at(sol, X, k, side)
            if Y is None or Y == X:
                continue
            pos = f"{ORD[k]} to the {side} of" if k > 1 else f"immediate {side} of"
            return B.person_q(f"Who among the following sits {pos} {names[X]}?", Y, f"Count {k} seat(s) to the {side} of {names[X]} (from {names[X]}'s own facing direction): {names[Y]}.", sub, [names[X]])

    def between():
        for _ in range(40):
            X, Y = rng.sample(range(n), 2)
            g = L.between(sol, X, Y)
            if g < 0 or g > 6:
                continue
            if is_circle:
                stem = f"How many persons sit between {names[X]} and {names[Y]} when counted from the left of {names[X]}?"
                why = f"Moving from {names[X]} towards {names[X]}'s left, {g} person(s) come before {names[Y]}."
            else:
                stem = f"How many persons sit between {names[X]} and {names[Y]}?"
                why = f"{names[X]} is at position {sol['pos'][X]+1} and {names[Y]} at {sol['pos'][Y]+1} from the left end ⇒ {g} between."
            return B.count_q(stem, g, why, sub)

    def relpos():
        for _ in range(40):
            X, Y = rng.sample(range(n), 2)
            k, side = L.rel(sol, X, Y)
            if not (1 <= k <= 4):
                continue
            correct = reldesc(k, side)
            pool = [reldesc(kk, s) for kk in range(1, 5) for s in ("left", "right") if (kk, s) != (k, side)]
            rng.shuffle(pool)
            return make_q(f"What is the position of {names[X]} with respect to {names[Y]}?", correct, pool, f"From {names[Y]}'s facing direction, {names[X]} is {correct.lower()}.", "Puzzle", sub, time=35, rng=rng)

    def odd_one():
        for _ in range(60):
            k = rng.randint(2, 3); side = rng.choice(["left", "right"])
            pairs = []
            for X in range(n):
                Y = L.at(sol, X, k, side)
                if Y is not None and Y != X:
                    pairs.append((X, Y))
            if len(pairs) < 4:
                continue
            rng.shuffle(pairs)
            good = pairs[:4]
            # odd pair: different relation
            bad = None
            for _ in range(50):
                X, Y = rng.sample(range(n), 2)
                if L.at(sol, X, k, side) != Y and (X, Y) not in good:
                    kk, ss = L.rel(sol, Y, X)
                    if kk >= 1:
                        bad = (X, Y); break
            if not bad:
                continue
            fmtp = lambda p: f"{names[p[0]]}{names[p[1]]}"
            stem = "Four of the following five are alike in a certain way based on the final arrangement and hence form a group. Which one does not belong to that group?"
            why = f"In every other pair the second person sits {ORD[k]} to the {side} of the first; {fmtp(bad)} does not follow this."
            return make_q(stem, bad, good, why, "Puzzle", sub, time=40, fmt=fmtp, rng=rng)

    def statements():
        st = []
        for _ in range(30):
            X, Y = rng.sample(range(n), 2)
            t = rng.random()
            if t < 0.45:
                k = rng.randint(1, 3); side = rng.choice(["left", "right"])
                truth = L.at(sol, Y, k, side) == X
                txt = f"{names[X]} sits {ORD[k]} to the {side} of {names[Y]}." if k > 1 else f"{names[X]} sits immediate {side} of {names[Y]}."
                st.append((txt, truth))
            elif t < 0.75:
                g = rng.randint(1, 3)
                if is_circle:
                    truth = L.between(sol, X, Y) == g
                    st.append((f"Only {numword(g).lower()} {'person sits' if g == 1 else 'persons sit'} between {names[X]} and {names[Y]} when counted from the left of {names[X]}.", truth))
                else:
                    truth = L.between(sol, X, Y) == g
                    st.append((f"Only {numword(g).lower()} {'person sits' if g == 1 else 'persons sit'} between {names[X]} and {names[Y]}.", truth))
            else:
                if is_circle:
                    d = (sol['pos'][X] - sol['pos'][Y]) % n
                    st.append((f"{names[X]} and {names[Y]} are immediate neighbours.", d in (1, n - 1)))
                else:
                    st.append((f"{names[X]} sits at an extreme end of the row.", sol['pos'][X] in (0, n - 1)))
        # make sure we have both truths available
        for X in range(n):
            Y = L.at(sol, X, 1, "right")
            if Y is not None:
                st.append((f"{names[Y]} sits immediate right of {names[X]}.", True))
        return B.statements_q(st, sub)

    def ends():
        if is_circle or L.kind != "linear":
            return None
        a, b = sol['inv'][0], sol['inv'][n - 1]
        correct = tuple(sorted((names[a], names[b])))
        wrong = set()
        while len(wrong) < 4:
            p = tuple(sorted(rng.sample(names, 2)))
            if p != correct:
                wrong.add(p)
        return make_q("Who among the following sit at the extreme ends of the row?", correct, list(wrong), f"Extreme ends: {names[a]} and {names[b]}.", "Puzzle", sub, time=25, fmt=lambda p: f"{p[0]} and {p[1]}", rng=rng)

    def mirror():
        if not north:
            return None
        X = rng.randrange(n)
        left = sol['pos'][X]
        Y = sol['inv'][n - 1 - left]
        if Y == X:
            return None
        return B.person_q(f"As many persons sit to the left of {names[X]} as to the right of ____.", Y, f"{left} person(s) to the left of {names[X]}; {names[Y]} has exactly {left} person(s) to its right.", sub, [names[X]])

    def opposite():
        if not is_circle or n % 2:
            return None
        X = rng.randrange(n)
        Y = sol['inv'][(sol['pos'][X] + n // 2) % n]
        return B.person_q(f"Who among the following sits opposite to {names[X]}?", Y, f"Opposite seat of {names[X]} (n/2 seats away) is {names[Y]}.", sub, [names[X]])

    def swap():
        if L.has_face:
            return None
        for _ in range(30):
            X, Y = rng.sample(range(n), 2)
            pos = list(sol['pos'])
            pos[X], pos[Y] = pos[Y], pos[X]
            inv = [0] * n
            for i, p in enumerate(pos):
                inv[p] = i
            s2 = dict(sol, pos=pos, inv=inv)
            k = rng.randint(1, 3); side = rng.choice(["left", "right"])
            Z = L.at(s2, X, k, side)
            if Z is None or Z in (X,):
                continue
            pos_t = f"{ORD[k]} to the {side} of" if k > 1 else f"immediate {side} of"
            return B.person_q(f"If {names[X]} and {names[Y]} interchange their positions, who among the following sits {pos_t} {names[X]}?", Z,
                              f"After the swap {names[X]} takes {names[Y]}'s seat; {pos_t} that seat sits {names[Z]}.", sub, [names[X]])

    def attr_qs():
        if not sol.get('who'):
            return None
        who, ao = sol['who'], sol['attr_of']
        vals = L.attr_vals
        t = rng.random()
        if t < 0.4:
            X = rng.randrange(n)
            correct = vals[ao[X]]
            others = [v for v in vals if v != correct]
            return make_q(f"Which of the following does {names[X]} {('like' if ATTR_VERB[L.attr_kind]=='likes' else ATTR_VERB[L.attr_kind].replace('s ', ' ').rstrip('s'))}?".replace("belong to", "belong to").replace("owns", "own"),
                          correct, others, f"{names[X]} {ATTR_VERB[L.attr_kind]} {correct}.", "Puzzle", sub, time=25, rng=rng)
        a = rng.randrange(n)
        p = who[a]
        for _ in range(30):
            k = rng.randint(1, 3); side = rng.choice(["left", "right"])
            Z = L.at(sol, p, k, side)
            if Z is None or Z == p:
                continue
            pos_t = f"{ORD[k]} to the {side} of" if k > 1 else f"immediate {side} of"
            return B.person_q(f"Who sits {pos_t} the one who {ATTR_THE[L.attr_kind].format(vals[a])}?", Z,
                              f"{vals[a]} → {names[p]}; {pos_t} {names[p]} sits {names[Z]}.", sub, [names[p]])

    makers = [who_at, between, relpos, odd_one, statements, ends, mirror, opposite, swap, attr_qs, attr_qs]
    rng.shuffle(makers)
    # always lead with a who_at and include an attribute question if attributes exist
    ordered = [who_at] + ([attr_qs] if sol.get('who') else []) + makers
    used = set()
    for mk in ordered:
        if len(qs) == 5:
            break
        if mk.__name__ in used and mk.__name__ != "attr_qs":
            continue
        q = mk()
        if q is None:
            continue
        if any(q['stem'] == o['stem'] for o in qs):
            continue
        used.add(mk.__name__)
        qs.append(q)
    return qs


# ------------------------------------------------------------------ stack
def stack_questions(L, sol, rng, sub):
    B = SetBuilder(L, sol, rng)
    n = L.n; names = L.names; U = sol['pos']; inv = sol['inv']
    box = L.style == "box"
    o = (lambda i: f"Box {names[i]}") if box else (lambda i: names[i])
    qs = []

    def who_rel():
        for _ in range(30):
            X = rng.randrange(n); k = rng.randint(1, 3); up = rng.random() < 0.5
            u = U[X] + (k if up else -k)
            if not 0 <= u < n:
                continue
            Y = inv[u]
            if box:
                rel = ("immediately above" if k == 1 else f"{numword(k).lower()} boxes above") if up else ("immediately below" if k == 1 else f"{numword(k).lower()} boxes below")
                stem = f"Which box is kept {rel} box {names[X]}?"
            else:
                rel = ("immediately above" if k == 1 else f"{numword(k).lower()} floors above") if up else ("immediately below" if k == 1 else f"{numword(k).lower()} floors below")
                stem = f"Who lives {rel} {names[X]}?"
            return B.person_q(stem, Y, f"{names[X]} is at {'position ' + str(n - U[X]) + ' from the top' if box else 'floor ' + str(U[X] + 1)}; {rel} is {names[Y]}.", sub, [names[X]])

    def between():
        X, Y = rng.sample(range(n), 2)
        g = abs(U[X] - U[Y]) - 1
        stem = f"How many boxes are kept between box {names[X]} and box {names[Y]}?" if box else f"How many persons live between {names[X]} and {names[Y]}?"
        return B.count_q(stem, g, f"{names[X]} and {names[Y]} are {g + 1} levels apart ⇒ {g} between.", sub)

    def position():
        X = rng.randrange(n)
        if box:
            t = n - U[X]
            fromtop = rng.random() < 0.5
            correct = f"{ORDC[t]} from the top" if fromtop else f"{ORDC[U[X] + 1]} from the bottom"
            pool = [f"{ORDC[i]} from the top" for i in range(1, n + 1)] + [f"{ORDC[i]} from the bottom" for i in range(1, n + 1)]
            pool = [p for p in pool if p != correct and p != f"{ORDC[t]} from the top" and p != f"{ORDC[U[X] + 1]} from the bottom"]
            rng.shuffle(pool)
            return make_q(f"What is the position of box {names[X]} in the stack?", correct, pool, f"Box {names[X]} is {ORD[t]} from the top = {ORD[U[X] + 1]} from the bottom.", "Puzzle", sub, time=30, rng=rng)
        correct = U[X] + 1
        dis = [f for f in range(1, n + 1) if f != correct]
        rng.shuffle(dis)
        return make_q(f"On which floor does {names[X]} live?", correct, dis, f"{names[X]} lives on floor {correct}.", "Puzzle", sub, time=25, fmt=lambda f: f"Floor {f}", rng=rng)

    def count_above():
        X = rng.randrange(n)
        a = n - 1 - U[X]
        stem = f"How many boxes are kept above box {names[X]}?" if box else f"How many persons live above {names[X]}?"
        return B.count_q(stem, a, f"{names[X]} has {a} above it.", sub)

    def odd_one():
        k = rng.randint(2, 3)
        pairs = [(inv[u + k], inv[u]) for u in range(n - k)]  # (upper, lower)
        if len(pairs) < 5:
            return None
        rng.shuffle(pairs)
        good = pairs[:4]
        for _ in range(40):
            X, Y = rng.sample(range(n), 2)
            if U[X] - U[Y] != k and (X, Y) not in good:
                bad = (X, Y); break
        else:
            return None
        fmtp = lambda p: f"{names[p[0]]}{names[p[1]]}" if box else f"{names[p[0]]}–{names[p[1]]}"
        why = f"In the other pairs the first is {k} {'boxes' if box else 'floors'} above the second; {fmtp(bad)} breaks this."
        return make_q("Four of the following five are alike in a certain way based on the final arrangement and hence form a group. Which one does not belong to that group?", bad, good, why, "Puzzle", sub, time=40, fmt=fmtp, rng=rng)

    def statements():
        st = []
        for _ in range(25):
            X, Y = rng.sample(range(n), 2)
            t = rng.random()
            if t < 0.4:
                st.append(((f"Box {names[X]} is kept immediately above box {names[Y]}." if box else f"{names[X]} lives immediately above {names[Y]}."), U[X] - U[Y] == 1))
            elif t < 0.75:
                g = rng.randint(1, 3)
                st.append(((f"Only {numword(g).lower()} {'box is' if g == 1 else 'boxes are'} kept between box {names[X]} and box {names[Y]}." if box else f"Only {numword(g).lower()} {'person lives' if g == 1 else 'persons live'} between {names[X]} and {names[Y]}."), abs(U[X] - U[Y]) - 1 == g))
            else:
                st.append(((f"Box {names[X]} is kept above box {names[Y]}." if box else f"{names[X]} lives above {names[Y]}."), U[X] > U[Y]))
        for u in range(n - 1):
            st.append(((f"Box {names[inv[u + 1]]} is kept immediately above box {names[inv[u]]}." if box else f"{names[inv[u + 1]]} lives immediately above {names[inv[u]]}."), True))
        return B.statements_q(st, sub)

    def swap():
        X, Y = rng.sample(range(n), 2)
        U2 = list(U); U2[X], U2[Y] = U2[Y], U2[X]
        inv2 = [0] * n
        for i, u in enumerate(U2):
            inv2[u] = i
        up = U2[X] < n - 1 and (rng.random() < 0.5 or U2[X] == 0)
        if up:
            Z = inv2[U2[X] + 1]; rel = "immediately above"
        else:
            if U2[X] == 0:
                return None
            Z = inv2[U2[X] - 1]; rel = "immediately below"
        stem = (f"If box {names[X]} and box {names[Y]} interchange their positions, which box is kept {rel} box {names[X]}?" if box else f"If {names[X]} and {names[Y]} interchange their floors, who lives {rel} {names[X]}?")
        return B.person_q(stem, Z, f"After the swap {names[X]} takes {names[Y]}'s place; {rel} it is {names[Z]}.", sub, [names[X]])

    def attr_q():
        if not sol.get('who'):
            return None
        X = rng.randrange(n)
        correct = L.attr_vals[sol['attr_of'][X]]
        others = [v for v in L.attr_vals if v != correct]
        verb = ATTR_VERB[L.attr_kind]
        stem = {"likes": "Which colour does {} like?" if L.attr_kind == "colour" else "Which fruit does {} like?", "belongs to": "To which city does {} belong?", "owns": "Which car does {} own?", "teaches": "Which subject does {} teach?", "plays": "Which sport does {} play?"}[verb].format(names[X])
        return make_q(stem, correct, others, f"{names[X]} {verb} {correct}.", "Puzzle", sub, time=25, rng=rng)

    makers = [who_rel, between, position, count_above, odd_one, statements, swap, attr_q]
    rng.shuffle(makers)
    order = [who_rel] + ([attr_q] if sol.get('who') else []) + makers
    used = set()
    for mk in order:
        if len(qs) == 5:
            break
        if mk.__name__ in used:
            continue
        q = mk()
        if q is None or any(q['stem'] == x['stem'] for x in qs):
            continue
        used.add(mk.__name__); qs.append(q)
    return qs


# ------------------------------------------------------------------ schedule
def schedule_questions(L, sol, rng, sub):
    B = SetBuilder(L, sol, rng)
    n = L.n; names = L.names; S = sol['pos']; inv = sol['inv']; sl = L.slots
    qs = []

    def who_on():
        s = rng.randrange(n)
        return B.person_q(f"Who among the following attends {'in' if L.mode == 'months' else 'on'} {sl[s]['label']}?", inv[s], f"{sl[s]['label']} → {names[inv[s]]}.", sub)

    def when():
        X = rng.randrange(n)
        correct = sl[S[X]]['label']
        others = [s['label'] for s in sl if s['label'] != correct]
        rng.shuffle(others)
        return make_q(f"{'On which date' if L.mode == 'monthdate' else ('In which month' if L.mode == 'months' else 'On which day')} does {names[X]} attend?", correct, others, f"{names[X]} → {correct}.", "Puzzle", sub, time=25, rng=rng)

    def between():
        X, Y = rng.sample(range(n), 2)
        g = abs(S[X] - S[Y]) - 1
        return B.count_q(f"How many persons attend between {names[X]} and {names[Y]}?", g, f"{names[X]} is {S[X] + 1}th and {names[Y]} is {S[Y] + 1}th in order ⇒ {g} between.", sub)

    def adjacent():
        X = rng.randrange(1, n - 1) if n > 2 else 0
        X = inv[rng.randrange(1, n - 1)]
        if rng.random() < 0.5:
            return B.person_q(f"Who attends immediately before {names[X]}?", inv[S[X] - 1], f"Just before {names[X]} is {names[inv[S[X] - 1]]}.", sub, [names[X]])
        return B.person_q(f"Who attends immediately after {names[X]}?", inv[S[X] + 1], f"Just after {names[X]} is {names[inv[S[X] + 1]]}.", sub, [names[X]])

    def count31():
        if L.mode == "days":
            return None
        c = sum(1 for s in sl if s['days'] == 31)
        return B.count_q("How many persons attend in a month having 31 days?", c, f"31-day slots: {', '.join(s['label'] for s in sl if s['days'] == 31)} ⇒ {c}.", sub)

    def mirror():
        X = rng.randrange(n)
        Y = inv[n - 1 - S[X]]
        if Y == X:
            return None
        return B.person_q(f"As many persons attend before {names[X]} as after ____.", Y, f"{S[X]} before {names[X]}; {names[Y]} has {S[X]} after it.", sub, [names[X]])

    def odd_one():
        if L.mode == "monthdate":
            groups = {}
            for s in range(n):
                groups.setdefault(sl[s]['mi'], []).append(inv[s])
            good = [tuple(v) for v in groups.values() if len(v) == 2]
            if len(good) < 4:
                return None
            rng.shuffle(good); good = good[:4]
            for _ in range(40):
                X, Y = rng.sample(range(n), 2)
                if sl[S[X]]['mi'] != sl[S[Y]]['mi']:
                    bad = (X, Y); break
            why = "All other pairs attend in the same month."
        else:
            k = 2
            pairs = [(inv[s], inv[s + k]) for s in range(n - k)]
            rng.shuffle(pairs); good = pairs[:4]
            for _ in range(40):
                X, Y = rng.sample(range(n), 2)
                if S[Y] - S[X] != k and (X, Y) not in good:
                    bad = (X, Y); break
            why = f"In the other pairs the second person attends {k} places after the first."
        fmtp = lambda p: f"{names[p[0]]}{names[p[1]]}"
        return make_q("Four of the following five are alike in a certain way based on the final arrangement and hence form a group. Which one does not belong to that group?", bad, good, why, "Puzzle", sub, time=40, fmt=fmtp, rng=rng)

    def statements():
        st = []
        for _ in range(25):
            X, Y = rng.sample(range(n), 2)
            t = rng.random()
            if t < 0.35:
                st.append((f"{names[X]} attends immediately before {names[Y]}.", S[Y] - S[X] == 1))
            elif t < 0.65 and L.mode != "days":
                st.append((f"{names[X]} attends in a month having 31 days.", sl[S[X]]['days'] == 31))
            else:
                lab = sl[S[Y]]['label'] if rng.random() < 0.5 else sl[S[X]]['label']
                st.append((f"{names[X]} attends on {lab}.", lab == sl[S[X]]['label']))
        for s in range(n - 1):
            st.append((f"{names[inv[s]]} attends immediately before {names[inv[s + 1]]}.", True))
        return B.statements_q(st, sub)

    makers = [who_on, when, between, adjacent, count31, mirror, odd_one, statements]
    rng.shuffle(makers)
    order = [who_on, when] + makers
    used = set()
    for mk in order:
        if len(qs) == 5:
            break
        if mk.__name__ in used:
            continue
        q = mk()
        if q is None or any(q['stem'] == x['stem'] for x in qs):
            continue
        used.add(mk.__name__); qs.append(q)
    return qs


# ------------------------------------------------------------------ floor-flat
def floorflat_questions(L, sol, rng, sub):
    B = SetBuilder(L, sol, rng)
    n = L.n; names = L.names; U = sol['pos']; inv = sol['inv']
    F = n // 2
    FT = ["Flat-X", "Flat-Y"]
    qs = []

    def where():
        X = rng.randrange(n)
        correct = f"Floor {U[X] // 2 + 1}, {FT[U[X] % 2]}"
        pool = [f"Floor {f}, {t}" for f in range(1, F + 1) for t in FT if f"Floor {f}, {t}" != correct]
        rng.shuffle(pool)
        return make_q(f"On which floor and in which flat does {names[X]} live?", correct, pool, f"{names[X]} → {correct}.", "Puzzle", sub, time=25, rng=rng)

    def same_floor():
        X = rng.randrange(n)
        Y = inv[U[X] ^ 1]
        side = "east" if U[Y] % 2 == 1 else "west"
        return B.person_q(f"Who lives to the {side} of {names[X]}?", Y, f"Same floor as {names[X]}, the other flat belongs to {names[Y]}.", sub, [names[X]])

    def below():
        cands = [X for X in range(n) if U[X] >= 2]
        X = rng.choice(cands)
        Y = inv[U[X] - 2]
        return B.person_q(f"Who lives immediately below {names[X]}?", Y, f"Same flat type, one floor lower: {names[Y]}.", sub, [names[X]])

    def above_count():
        X = rng.randrange(n)
        c = sum(1 for Y in range(n) if U[Y] // 2 > U[X] // 2)
        return B.count_q(f"How many persons live on the floors above the floor of {names[X]}?", c, f"{names[X]} is on floor {U[X]//2 + 1}; floors above hold {c} persons.", sub)

    def odd_one():
        # persons on even floors vs one odd, or same flat-type grouping
        if rng.random() < 0.5:
            groups = [[X for X in range(n) if U[X] % 2 == t] for t in (0, 1)]
            why_t = "live in {}"
            t = rng.randrange(2)
            good = rng.sample(groups[t], 4); bad = rng.choice(groups[1 - t])
            why = f"All others live in {FT[t]}; {names[bad]} lives in {FT[1 - t]}."
        else:
            ev = [X for X in range(n) if (U[X] // 2 + 1) % 2 == 0]; od = [X for X in range(n) if (U[X] // 2 + 1) % 2 == 1]
            if len(ev) >= 4 and rng.random() < 0.5:
                good = rng.sample(ev, 4); bad = rng.choice(od); why = f"All others live on even-numbered floors; {names[bad]} does not."
            elif len(od) >= 4:
                good = rng.sample(od, 4); bad = rng.choice(ev); why = f"All others live on odd-numbered floors; {names[bad]} does not."
            else:
                return None
        return make_q("Four of the following five are alike in a certain way based on the final arrangement and hence form a group. Which one does not belong to that group?",
                      names[bad], [names[g] for g in good], why, "Puzzle", sub, time=35, rng=rng)

    def statements():
        st = []
        for _ in range(25):
            X, Y = rng.sample(range(n), 2)
            t = rng.random()
            if t < 0.35:
                st.append((f"{names[X]} lives to the east of {names[Y]}.", U[X] // 2 == U[Y] // 2 and U[X] % 2 == 1))
            elif t < 0.65:
                st.append((f"{names[X]} lives on an even numbered floor.", (U[X] // 2 + 1) % 2 == 0))
            else:
                st.append((f"{names[X]} and {names[Y]} live in the same type of flat.", U[X] % 2 == U[Y] % 2))
        return B.statements_q(st, sub)

    makers = [where, same_floor, below, above_count, odd_one, statements]
    rng.shuffle(makers)
    order = [where] + makers
    used = set()
    for mk in order:
        if len(qs) == 5:
            break
        if mk.__name__ in used:
            continue
        q = mk()
        if q is None or any(q['stem'] == x['stem'] for x in qs):
            continue
        used.add(mk.__name__); qs.append(q)
    return qs


# ------------------------------------------------------------------ parallel
def parallel_questions(L, sol, rng, sub):
    B = SetBuilder(L, sol, rng)
    n = L.n; m = n // 2; names = L.names; P = sol['pos']
    row = lambda i: 0 if i < m else 1
    rs = lambda i: -1 if row(i) == 0 else 1
    at_row = {}
    for i in range(n):
        at_row[(row(i), P[i])] = i
    qs = []

    def at(X, k, side):
        p = P[X] + k * rs(X) * (1 if side == "right" else -1)
        return at_row.get((row(X), p))

    def faces():
        X = rng.randrange(n)
        Y = at_row[(1 - row(X), P[X])]
        return B.person_q(f"Who faces {names[X]}?", Y, f"{names[X]} is at seat {P[X] + 1} (from the left end of the page); the person in the other row at that seat is {names[Y]}.", sub, [names[X]])

    def who_at():
        for _ in range(30):
            X = rng.randrange(n); k = rng.randint(1, 3); side = rng.choice(["left", "right"])
            Y = at(X, k, side)
            if Y is None:
                continue
            pos_t = f"{ORD[k]} to the {side} of" if k > 1 else f"immediate {side} of"
            return B.person_q(f"Who sits {pos_t} {names[X]}?", Y, f"{names[X]} faces {'south' if row(X) == 0 else 'north'}, so its right is page-{'left' if row(X) == 0 else 'right'}; {pos_t} {names[X]} is {names[Y]}.", sub, [names[X]])

    def facer_rel():
        for _ in range(30):
            X = rng.randrange(n); k = rng.randint(1, 2); side = rng.choice(["left", "right"])
            F_ = at_row[(1 - row(X), P[X])]
            Y = at(F_, k, side)
            if Y is None:
                continue
            pos_t = f"{ORD[k]} to the {side} of" if k > 1 else f"immediate {side} of"
            return B.person_q(f"Who sits {pos_t} the one who faces {names[X]}?", Y, f"{names[F_]} faces {names[X]}; {pos_t} {names[F_]} is {names[Y]}.", sub, [names[X], names[F_]])

    def between():
        r = rng.randrange(2)
        X, Y = rng.sample([i for i in range(n) if row(i) == r], 2)
        g = abs(P[X] - P[Y]) - 1
        return B.count_q(f"How many persons sit between {names[X]} and {names[Y]}?", g, f"Seats {P[X] + 1} and {P[Y] + 1} in the same row ⇒ {g} between.", sub)

    def ends():
        r = rng.randrange(2)
        a, b = at_row[(r, 0)], at_row[(r, m - 1)]
        correct = tuple(sorted((names[a], names[b])))
        rown = [names[i] for i in range(n) if row(i) == r]
        wrong = set()
        while len(wrong) < 4:
            p = tuple(sorted(rng.sample(rown if rng.random() < 0.7 else names, 2)))
            if p != correct:
                wrong.add(p)
        return make_q(f"Who among the following sit at the extreme ends of Row {r + 1}?", correct, list(wrong), f"Ends of Row {r + 1}: {names[a]} and {names[b]}.", "Puzzle", sub, time=25, fmt=lambda p: f"{p[0]} and {p[1]}", rng=rng)

    def odd_one():
        pairs = [(at_row[(0, s)], at_row[(1, s)]) for s in range(m)]
        rng.shuffle(pairs)
        good = pairs[:4]
        for _ in range(40):
            X = rng.choice([i for i in range(m)]); Y = rng.choice([i for i in range(m, n)])
            if P[X] != P[Y]:
                bad = (X, Y); break
        fmtp = lambda p: f"{names[p[0]]}–{names[p[1]]}"
        return make_q("Four of the following five are alike in a certain way based on the final arrangement and hence form a group. Which one does not belong to that group?", bad, good,
                      "In the other pairs the two persons face each other.", "Puzzle", sub, time=35, fmt=fmtp, rng=rng)

    makers = [faces, who_at, facer_rel, between, ends, odd_one]
    rng.shuffle(makers)
    used = set()
    for mk in makers + [who_at, faces]:
        if len(qs) == 5:
            break
        if mk.__name__ in used:
            continue
        q = mk()
        if q is None or any(q['stem'] == x['stem'] for x in qs):
            continue
        used.add(mk.__name__); qs.append(q)
    return qs


# ------------------------------------------------------------------ visual spec of final arrangement
def visual_spec(L, sol):
    n = L.n; names = L.names
    attr = (lambda i: L.attr_vals[sol['attr_of'][i]]) if sol.get('who') else (lambda i: None)
    if L.kind == "linear":
        return dict(type="linear", facing=L.facing, seats=[dict(name=names[sol['inv'][p]], face=(None if not L.has_face else ("N" if sol['face'][sol['inv'][p]] == 0 else "S")), attr=attr(sol['inv'][p])) for p in range(n)])
    if L.kind == "circle":
        return dict(type="circle", seats=[dict(name=names[sol['inv'][p]], face=("in" if (not L.has_face or sol['face'][sol['inv'][p]] == 0) else "out"), attr=attr(sol['inv'][p])) for p in range(n)])
    if L.kind == "stack":
        return dict(type="stack", style=L.style, levels=[dict(name=names[sol['inv'][u]], attr=attr(sol['inv'][u]), label=(f"{n - u} from top" if L.style == "box" else f"Floor {u + 1}")) for u in range(n - 1, -1, -1)])
    if L.kind == "schedule":
        return dict(type="schedule", rows=[dict(slot=L.slots[s]['label'], name=names[sol['inv'][s]], attr=attr(sol['inv'][s])) for s in range(n)])
    if L.kind == "floorflat":
        F = n // 2
        return dict(type="floorflat", floors=[dict(floor=f + 1, P=names[sol['inv'][2 * f]], Q=names[sol['inv'][2 * f + 1]]) for f in range(F - 1, -1, -1)])
    if L.kind == "parallel":
        m = n // 2
        r1 = [None] * m; r2 = [None] * m
        for i in range(n):
            (r1 if i < m else r2)[sol['pos'][i]] = names[i]
        return dict(type="parallel", row1=r1, row2=r2)


# ------------------------------------------------------------------ public: build one puzzle set
def build_puzzle_set(kind, rng, difficulty=1):
    """kind: linear | linear_mixed | circle | circle_mixed | box | floor | monthdate | months | days | floorflat | parallel"""
    attr_kind = None
    if kind in ("linear", "linear_mixed"):
        n = rng.choice([7, 8]) if kind == "linear" else 8
        if difficulty >= 2 and kind == "linear":
            n = 9
        names = sorted(rng.sample(rng.choice(NAME_POOLS), n))
        L = Linear(names, rng, facing=("mixed" if kind == "linear_mixed" else rng.choice(["north", "north", "south"])))
        if kind == "linear" and rng.random() < 0.7 and n <= 8:
            attr_kind = rng.choice(["colour", "fruit", "city", "car"])
        sub = "Linear seating" + (" (mixed facing)" if kind == "linear_mixed" else "")
    elif kind in ("circle", "circle_mixed"):
        n = 8
        names = sorted(rng.sample(rng.choice(NAME_POOLS), n))
        L = Circle(names, rng, facing=("mixed" if kind == "circle_mixed" else "in"))
        if kind == "circle" and rng.random() < 0.6:
            attr_kind = rng.choice(["colour", "fruit", "city", "car"])
        sub = "Circular seating" + (" (mixed facing)" if kind == "circle_mixed" else "")
    elif kind in ("box", "floor"):
        n = rng.choice([8, 9]) if difficulty == 1 else 9
        names = sorted(rng.sample(rng.choice(NAME_POOLS + [list("ABCDEFGHIJ")]), n))
        L = Stack(names, rng, style=kind)
        if kind == "floor" and rng.random() < 0.6 and n <= 8:
            attr_kind = rng.choice(["city", "car", "sport"])
        sub = "Box stack" if kind == "box" else "Floor puzzle"
    elif kind in ("monthdate", "months", "days"):
        if kind == "monthdate":
            start = rng.choice([0, 2, 3, 6, 8])
            ms = MONTHS[start:start + 4] if start + 4 <= 12 else MONTHS[8:12]
            d1, d2 = rng.choice([(5, 22), (12, 23), (15, 22), (7, 18), (11, 24), (9, 20)])
            slots = []
            for m in ms:
                for d in (d1, d2):
                    slots.append(dict(label=f"{m} {d}", month=m, mi=MONTHS.index(m), days=MONTH_DAYS[m], date=d))
            n = 8
        elif kind == "months":
            ms = sorted(rng.sample(MONTHS, 8), key=MONTHS.index)
            slots = [dict(label=m, month=m, mi=MONTHS.index(m), days=MONTH_DAYS[m], date=1) for m in ms]
            n = 8
        else:
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            slots = [dict(label=d, month=d, mi=i, days=0, date=i) for i, d in enumerate(days)]
            n = 7
        names = sorted(rng.sample(rng.choice(NAME_POOLS), n))
        event = rng.choice(["attend a seminar", "attend a workshop", "go on a trip", "attend an interview"]) if kind != "days" else rng.choice(["attend a meeting", "visit a museum"])
        L = Schedule(names, rng, slots, kind, event=event)
        if kind in ("days", "months") and rng.random() < 0.7:
            attr_kind = rng.choice(["fruit", "colour", "subject", "sport"])
        sub = {"monthdate": "Month-date scheduling", "months": "Month scheduling", "days": "Day scheduling"}[kind]
    elif kind == "floorflat":
        n = 8
        names = sorted(rng.sample(list("BCDEFGHIJKLMNOPQRSTU"), n))
        L = FloorFlat(names, rng)
        sub = "Floor + flat puzzle"
    elif kind == "parallel":
        n = 12 if difficulty >= 2 else 10
        pool = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
        r1 = sorted(rng.sample(pool[:10], n // 2)); r2 = sorted(rng.sample(pool[12:], n // 2))
        names = r1 + r2
        L = Parallel(names, rng)
        sub = "Parallel rows"
    else:
        raise ValueError(kind)

    sol, clues, aclues = generate_arrangement(L, rng, attr_kind=attr_kind, difficulty=difficulty)
    all_clues = interleave(rng, clues, aclues) if aclues else clues
    intro = L.intro()
    if attr_kind:
        intro += f" Each of them {ATTR_VERB[attr_kind]} a different {attr_kind if attr_kind not in ('city',) else 'city'} – {', '.join(sorted(L.attr_vals))}."
    intro += " All the information is not necessarily in the same order."
    if L.kind == "linear" and L.facing == "mixed":
        pass
    if L.kind == "stack":
        qs = stack_questions(L, sol, rng, sub)
    elif L.kind == "schedule":
        qs = schedule_questions(L, sol, rng, sub)
    elif L.kind == "floorflat":
        qs = floorflat_questions(L, sol, rng, sub)
    elif L.kind == "parallel":
        qs = parallel_questions(L, sol, rng, sub)
    else:
        qs = seat_questions(L, sol, rng, sub)
    if len(qs) < 5:
        raise RuntimeError("not enough questions for " + kind)
    directions = "Directions: Study the following information carefully and answer the questions given below."
    return dict(kind="set", topic="Puzzle", sub=sub, directions=directions, intro=intro, clues=[c['text'] for c in all_clues],
                visual=visual_spec(L, sol), qs=qs, n_clues=len(all_clues))
