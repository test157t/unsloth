import assert from "node:assert/strict";
import test from "node:test";
import { acknowledgeSave, documentKey, highlightText, isDirty } from "../src/features/code/editor-state.ts";

test("save completion preserves newer typing and leaves it dirty", () => {
  const doc = { session: "a", name: "file.py", content: "new typing", saved: "old", revision: "r1" };
  const saved = acknowledgeSave(doc, "submitted", "r2");
  assert.equal(saved.content, "new typing");
  assert.equal(saved.saved, "submitted");
  assert.equal(saved.revision, "r2");
  assert.equal(isDirty(saved), true);
  assert.equal(isDirty({ ...saved, content: "submitted" }), false);
});

test("new empty files still need saving and same names in different workspaces are distinct", () => {
  assert.equal(isDirty({ session: "a", name: "empty", content: "", saved: "", revision: null }), true);
  assert.notEqual(documentKey("a", "file.py"), documentKey("b", "file.py"));
});

test("syntax tokens preserve literal source including markup and multiline strings", () => {
  for (const code of ["const x = '<script>alert(1)</script>';\n", "/* multiline\ncomment */\nreturn 1;", "def f():\n\treturn True\n", "", "`a\nb`\n"]) {
    assert.equal(highlightText(code).map(t => t.text).join(""), code);
  }
});
