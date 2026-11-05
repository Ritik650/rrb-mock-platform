"""Assemble 20 RRB PO Prelims mocks (80 Qs each) and export JSON."""
import random, json, sys, time
from util import *
from puzzle_sets import build_puzzle_set
from reasoning import *
from quant import *


def retry(fn, rng, *a, tries=25, **k):
    last = None
    for _ in range(tries):
        try:
            return fn(rng, *a, **k)
        except (ValueError, RuntimeError, AssertionError, IndexError, ZeroDivisionError) as e:
            last = e
    raise RuntimeError(f"{fn.__name__} failed: {last}")


def single(q):
    return dict(kind="single", topic=q["topic"], sub=q["sub"], qs=[q])


def build_reasoning(rng, hard, mi):
    seat = ["linear", "circle", "parallel", "linear", "circle"] if not hard else ["linear_mixed", "circle_mixed", "parallel", "linear"]
    vert = ["box", "floor", "floorflat"] if not hard else ["floorflat", "box", "floor"]
    sched = ["monthdate", "months", "days"] if not hard else ["monthdate", "monthdate", "months"]
    kinds = [seat[(mi + rng.randrange(2)) % len(seat)], vert[mi % len(vert)], sched[(mi * 2 + rng.randrange(2)) % len(sched)]]
    diff = 2 if hard else 1
    puzzles = [retry(lambda r, k=k: build_puzzle_set(k, r, difficulty=diff), rng) for k in kinds]
    n_syl = rng.choice([4, 5]); n_ineq = rng.choice([4, 5]) if n_syl == 5 else 5
    syl = [single(retry(gen_syllogism, rng, hard=hard)) for _ in range(n_syl)]
    ineq = [single(retry(gen_inequality, rng, hard=hard)) for _ in range(n_ineq)]
    use_coding = rng.random() < 0.65
    misc_set = retry(gen_coding, rng, hard=hard) if use_coding else retry(gen_number_arrangement, rng, hard=hard)
    blood = retry(gen_blood_relation, rng, hard=hard)
    dirn = retry(gen_direction, rng, hard=hard)
    rank = retry(gen_ranking, rng, hard=hard)
    blocks = [puzzles[0], *ineq, puzzles[1], *syl, misc_set, puzzles[2], blood, dirn, rank]
    count = sum(len(b["qs"]) for b in blocks)
    one = [gen_digit_pairs, gen_letter_pairs, gen_number_op, gen_letter_shift]
    rng.shuffle(one)
    extra = []
    i = 0
    while count + len(extra) < 40:
        extra.append(single(retry(one[i % len(one)], rng, hard=hard))); i += 1
    if count + len(extra) > 40:
        # trim ranking to fit
        over = count + len(extra) - 40
        rank["qs"] = rank["qs"][:len(rank["qs"]) - over]
    blocks = blocks[:-1] + extra + [rank]
    blocks = [b for b in blocks if b["qs"]]
    assert sum(len(b["qs"]) for b in blocks) == 40, sum(len(b["qs"]) for b in blocks)
    return blocks


def build_quant(rng, hard, mi):
    approx = [single(retry(gen_approx, rng, hard=hard)) for _ in range(5)]
    quad = [single(retry(gen_quadratic, rng, hard=hard)) for _ in range(5)]
    wrong = (mi % 3 == 1) or (hard and mi % 2 == 0)
    series = [single(retry(lambda r: gen_series(r, hard=hard, wrong=wrong), rng)) for _ in range(5)]
    di1 = retry(di_table_pct, rng, hard=hard)
    chart = [lambda r: di_pie(r, hard=hard), lambda r: di_bar(r, hard=hard), lambda r: di_bar(r, hard=hard, line=True)][mi % 3]
    di2 = retry(chart, rng)
    cas = [caselet_hubs, caselet_venn, caselet_seats][(mi + 1) % 3]
    c = retry(cas, rng, hard=hard)
    count = 5 + 5 + 5 + len(di1["qs"]) + len(di2["qs"]) + len(c["qs"])
    ar = [single(q) for q in gen_arithmetic_block(rng, 40 - count, hard=hard)]
    order = [approx, quad, [di1], series, [di2], ar[: len(ar) // 2], [c], ar[len(ar) // 2:]]
    blocks = [b for grp in order for b in grp]
    assert sum(len(b["qs"]) for b in blocks) == 40, sum(len(b["qs"]) for b in blocks)
    return blocks


def finalize(mock_no, rblocks, qblocks, hard):
    qn = 0
    sections = []
    for name, blocks in (("Reasoning Ability", rblocks), ("Quantitative Aptitude", qblocks)):
        out = []
        for bi, b in enumerate(blocks):
            b = dict(b)
            b["id"] = f"M{mock_no:02d}-{name[:1]}{bi + 1:02d}"
            qs = []
            for q in b["qs"]:
                qn += 1
                q = dict(q)
                q["no"] = qn
                q["id"] = f"M{mock_no:02d}-Q{qn:02d}"
                q["section"] = name
                q["set_id"] = b["id"] if b["kind"] == "set" else None
                q["answer"] = "ABCDE"[q["ans"]]
                qs.append(q)
            b["qs"] = qs
            out.append(b)
        sections.append(dict(name=name, blocks=out))
    return dict(mock_no=mock_no, title=f"RRB PO Prelims Predicted Mock {mock_no:02d}", level=("Hard" if hard else "Exam level"), duration_min=45,
                marking=dict(correct=1, wrong=-0.25), sections=sections)


def build_mock(mock_no, seed):
    rng = random.Random(seed)
    hard = mock_no >= 15
    r = build_reasoning(rng, hard, mock_no)
    q = build_quant(rng, hard, mock_no)
    return finalize(mock_no, r, q, hard)


if __name__ == "__main__":
    start, end = int(sys.argv[1]), int(sys.argv[2])
    for m in range(start, end + 1):
        t = time.time()
        mk = build_mock(m, 7000 + m * 131)
        with open(f"out/mock_{m:02d}.json", "w") as f:
            json.dump(mk, f, ensure_ascii=False, indent=1, default=str)
        print(m, f"{time.time() - t:.1f}s", flush=True)
