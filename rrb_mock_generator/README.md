# RRB PO Prelims mock generator

Generates original, exam-pattern IBPS RRB PO Prelims mocks with verified answers.

    pip install numpy
    mkdir -p out
    python3 mock.py 1 20            # writes out/mock_01.json ... mock_20.json (seeded, reproducible)
    python3 verify.py "out/mock_*.json"          # independent puzzle re-solve + structural checks
    python3 verify.py "out/mock_*.json" extra    # inequality / approximation / quadratic / statement checks
    python3 render.py "out/mock_*.json" out/rrb  # question + solution PDFs (needs google-chrome)

- `puzzles.py` / `puzzle_sets.py`: hidden random solution -> true clues -> greedy + minimise until the
  solution is unique over the full candidate space (numpy) -> 5 questions.
- `reasoning.py`: syllogism (Venn-world enumeration), inequality, blood relation, direction, coding, one-liners, ranking.
- `quant.py`: approximation, quadratics, series, table/pie/bar/line DI, caselets, 17 arithmetic templates.
- `mock.py`: blueprint (mock_no >= 15 => hard). Change the seed formula in `__main__` to get new mocks;
  `python3 mock.py 21 50` makes 30 more.
