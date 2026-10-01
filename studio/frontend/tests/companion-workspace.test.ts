// SPDX-License-Identifier: AGPL-3.0-only
import assert from "node:assert/strict";
import test from "node:test";
import {
  isConversationWorkspace,
  conversationDestination,
} from "../src/features/companion/workspace-path.ts";

test("only the three exact conversation routes share the persistent runtime", () => {
  assert.equal(isConversationWorkspace("/chat"), true);
  assert.equal(isConversationWorkspace("/companion"), true);
  assert.equal(isConversationWorkspace("/code"), true);
  for (const path of [
    "/chatty",
    "/companion-extra",
    "/code-extra",
    "/studio",
    "/data-recipes",
  ]) {
    assert.equal(isConversationWorkspace(path), false);
  }
});

test("chat actions keep the companion destination without hijacking other navigation", () => {
  assert.equal(conversationDestination("/companion", "/chat"), "/companion");
  assert.equal(conversationDestination("/code", "/chat"), "/code");
  assert.equal(conversationDestination("/code", "/companion"), "/companion");
  assert.equal(conversationDestination("/chat", "/chat"), "/chat");
  assert.equal(conversationDestination("/studio", "/chat"), "/chat");
  assert.equal(conversationDestination("/companion", "/audio"), "/audio");
  assert.equal(conversationDestination("/companion", undefined), undefined);
});
