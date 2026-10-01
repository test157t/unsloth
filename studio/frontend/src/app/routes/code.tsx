// SPDX-License-Identifier: AGPL-3.0-only
import { validateChatSearch } from "@/features/chat";
import { createRoute } from "@tanstack/react-router";
import { requireAuth } from "../auth-guards";
import { Route as rootRoute } from "./__root";

// The root keeps one conversation runtime mounted for Chat, Companion and Code.
export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/code",
  staticData: { title: "Code" },
  beforeLoad: () => requireAuth(),
  validateSearch: (search: Record<string, unknown>) =>
    validateChatSearch(search),
  component: () => null,
});
