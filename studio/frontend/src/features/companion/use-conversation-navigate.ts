// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { conversationDestination } from "./workspace-path";

/** Keep existing chat actions in the selected workspace without duplicating the runtime. */
export function useConversationNavigate(): ReturnType<typeof useNavigate> {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  return useCallback(
    ((options: Parameters<typeof navigate>[0]) =>
      navigate({
        ...options,
        to: conversationDestination(pathname, options.to),
      } as Parameters<typeof navigate>[0])) as typeof navigate,
    [navigate, pathname],
  );
}
