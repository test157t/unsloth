// SPDX-License-Identifier: AGPL-3.0-only
import { authFetch } from "@/features/auth";
import { sandboxRoutePrefix } from "@/components/assistant-ui/sandbox-files";

export type DocumentSnapshot = { content: string; revision: string };
export type GitStatus = {
  repository: boolean;
  files: { path: string; status: string }[];
};
export type WorkspaceListing = {
  path: string;
  files: { name: string; size: number }[];
};

async function json<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body.detail === "string"
        ? body.detail
        : "Workspace request failed.",
    );
  return body;
}

export async function workspaceAction<T>(
  session: string,
  action: string,
  fields: Record<string, unknown> = {},
): Promise<T> {
  return json<T>(
    await authFetch("/api/inference/code-workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: session, action, ...fields }),
    }),
  );
}

export async function listWorkspace(
  session: string,
): Promise<WorkspaceListing> {
  const { prefix, query } = sandboxRoutePrefix(session);
  return json<WorkspaceListing>(await authFetch(prefix + query));
}
