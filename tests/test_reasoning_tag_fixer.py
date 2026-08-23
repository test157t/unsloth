from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from add_missing_reasoning_tags import EMPTY_THOUGHT, normalize_answer, process_jsonl


class ReasoningTagFixerTests(unittest.TestCase):
    def test_preserves_nonempty_and_empty_reasoning(self):
        nonempty = "<|channel>thought\nReasoning\n<channel|>Final"
        empty = "<|channel>thought\n\n<channel|>Final"
        self.assertEqual(normalize_answer(nonempty), (nonempty, "already_tagged"))
        self.assertEqual(normalize_answer(empty), (empty, "already_tagged"))

    def test_adds_empty_reasoning_before_untagged_final(self):
        self.assertEqual(normalize_answer("Final"), (EMPTY_THOUGHT + "Final", "added"))

    def test_repairs_known_delimiter_typos(self):
        malformed = "<|channel|>thought\nReasoning\n< /channel|>Final"
        fixed, outcome = normalize_answer(malformed)
        self.assertEqual(outcome, "repaired")
        self.assertEqual(fixed, "<|channel>thought\nReasoning\n<channel|>Final")

    def test_repairs_spaced_tags_and_moves_a_preamble_into_the_final(self):
        malformed = "Preamble. < |channel>thought\nReasoning\n</ |channel>thought\nFinal"
        fixed, outcome = normalize_answer(malformed)
        self.assertEqual(outcome, "repaired")
        self.assertEqual(
            fixed,
            "<|channel>thought\nReasoning\n<channel|>Preamble. Final",
        )

    def test_standalone_channel_marker_becomes_an_empty_thought(self):
        fixed, outcome = normalize_answer("<|channel|>\nFinal")
        self.assertEqual(outcome, "repaired")
        self.assertEqual(fixed, EMPTY_THOUGHT + "Final")

    def test_ordinary_word_channel_is_not_treated_as_markup(self):
        text = "The side-channel analysis found a leak."
        self.assertEqual(normalize_answer(text), (EMPTY_THOUGHT + text, "added"))

    def test_records_unresolved_location_and_preview(self):
        from add_missing_reasoning_tags import Stats, normalize_tree

        stats = Stats()
        normalize_tree(
            {"from": "gpt", "value": "<|channel>thought\nMissing close"},
            stats,
            "line 42",
        )
        self.assertEqual(stats.unresolved, 1)
        self.assertEqual(stats.unresolved_details, ["line 42: <|channel>thought\\nMissing close"])

    def test_jsonl_supports_sharegpt_and_openai_roles_without_overwriting_source(self):
        rows = [
            {"conversations": [{"from": "human", "value": "Q"}, {"from": "gpt", "value": "A"}]},
            {"messages": [{"role": "assistant", "content": "B"}]},
        ]
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "data.jsonl"
            source.write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
            destination, stats = process_jsonl(source)
            output_rows = [json.loads(line) for line in destination.read_text(encoding="utf-8").splitlines()]

            self.assertEqual(stats.added, 2)
            self.assertEqual(json.loads(source.read_text(encoding="utf-8").splitlines()[0]), rows[0])
            self.assertEqual(
                output_rows[0]["conversations"][1]["value"], EMPTY_THOUGHT + "A"
            )
            self.assertEqual(output_rows[1]["messages"][0]["content"], EMPTY_THOUGHT + "B")


if __name__ == "__main__":
    unittest.main()
