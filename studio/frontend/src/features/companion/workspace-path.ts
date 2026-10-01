// SPDX-License-Identifier: AGPL-3.0-only
export function isConversationWorkspace(pathname: string): boolean {
  return pathname === "/chat" || pathname === "/companion" || pathname === "/code";
}

export function conversationDestination(
  pathname: string,
  destination: string | undefined,
) {
  return (pathname === "/companion" || pathname === "/code") && destination === "/chat"
    ? pathname
    : destination;
}
