// SPDX-License-Identifier: AGPL-3.0-only
export type EditorDocument = {
  session: string;
  name: string;
  content: string;
  saved: string;
  revision: string | null;
};
export const documentKey = (session: string, name: string) =>
  JSON.stringify([session, name]);
export const isDirty = (doc: EditorDocument) =>
  doc.revision === null || doc.content !== doc.saved;

/** A save acknowledgement must not erase edits typed while the request was running. */
export function acknowledgeSave(
  doc: EditorDocument,
  submitted: string,
  revision: string,
): EditorDocument {
  return { ...doc, saved: submitted, revision };
}

/** Lightweight syntax coloring; rendering remains escaped React text. */
export function highlightText(
  content: string,
): { text: string; kind: string }[] {
  const pattern =
    /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(const|let|var|function|return|import|export|from|class|def|if|else|elif|for|while|try|catch|except|async|await|true|false|null|None|True|False)\b|\b(\d+(?:\.\d+)?)\b/g;
  const result: { text: string; kind: string }[] = [];
  let offset = 0;
  for (const match of content.matchAll(pattern)) {
    if (match.index! > offset)
      result.push({ text: content.slice(offset, match.index), kind: "text" });
    result.push({
      text: match[0],
      kind: match[1]
        ? "comment"
        : match[2]
          ? "string"
          : match[3]
            ? "keyword"
            : "number",
    });
    offset = match.index! + match[0].length;
  }
  result.push({ text: content.slice(offset), kind: "text" });
  return result;
}
