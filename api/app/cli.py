"""Terminal version of the AI Term Explainer Agent.

Run:  uv run python -m app.cli
"""

import asyncio

from .agent import generate_card, generate_quiz, shuffle_options
from .glossary import find_term
from .schemas import PASS_SCORE

LETTERS = "abcd"


def ask(n: int) -> int:
    while True:
        raw = input("Your answer: ").strip().lower()
        if len(raw) == 1 and raw in LETTERS[:n]:
            return LETTERS.index(raw)
        print(f"  Please type a letter from a to {LETTERS[n - 1]}.")


async def run_once(query: str) -> None:
    entry = find_term(query)
    card, _, suggestions = await generate_card(query, entry)
    print(f"\n{card.term}" + (f"  [{card.category}]" if card.category else ""))
    print(f"  In one line:   {card.one_liner}")
    if not card.is_ai_term:
        if suggestions:
            print(f"  Did you mean: {', '.join(suggestions)}")
        return
    print(f"  Mental model:  {card.mental_model}")
    print(f"  Real example:  {card.real_world_example}")

    quiz_task = asyncio.create_task(generate_quiz(card, find_term(card.term)))  # build while they read
    if (await asyncio.to_thread(input, "\nReady for a quick quiz? [Y/n] ")).strip().lower() == "n":
        quiz_task.cancel()
        return
    questions = [shuffle_options(q) for q in await quiz_task]

    score = 0
    for i, q in enumerate(questions, 1):
        print(f"\nQ{i}. {q.question}")
        for letter, opt in zip(LETTERS, q.options):
            print(f"   {letter}) {opt}")
        if ask(len(q.options)) == q.answer_index:
            score += 1
            print("  Correct!", q.explanation)
        else:
            print(f"  Not quite. Answer: {LETTERS[q.answer_index]}) {q.options[q.answer_index]}. {q.explanation}")

    total = len(questions)
    verdict = "mastered!" if score == total else "learned." if score >= min(PASS_SCORE, total) else "needs review."
    print(f"\nScore {score}/{total}: {verdict}")


def main() -> None:
    print("TermSnap: AI Term Explainer (blank line to quit)")
    while query := input("\nAI term: ").strip():
        try:
            asyncio.run(run_once(query))
        except Exception as exc:
            print(f"Error: {exc}")


if __name__ == "__main__":
    main()
