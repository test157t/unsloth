// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026-present the Unsloth AI Inc. team. All rights reserved. See /studio/LICENSE.AGPL-3.0

import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Notebook01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactElement } from "react";
import { parseTrainingTranscript } from "./training-entry-transcript";

interface TrainingEntryLogProps {
  step: number;
  entries: string[];
  error: string | null;
  isInspecting: boolean;
  isPinned: boolean;
  onFollowLatest: () => void;
}

export function TrainingEntryLog({
  step,
  entries,
  error,
  isInspecting,
  isPinned,
  onFollowLatest,
}: TrainingEntryLogProps): ReactElement {
  return (
    <SectionCard
      icon={<HugeiconsIcon icon={Notebook01Icon} className="size-5" />}
      title="Training input log"
      description={`${isPinned ? "Pinned" : isInspecting ? "Inspecting" : "Latest"} model inputs for step ${step}`}
      accent="orange"
      className="min-h-[22rem] border border-border/60 bg-card/90 shadow-border"
      headerAction={
        isPinned ? (
          <Button size="sm" variant="outline" onClick={onFollowLatest}>
            Follow latest
          </Button>
        ) : undefined
      }
    >
      <p className="text-ui-11 text-muted-foreground">
        These are the token sequences sent to the model. Hover previews a step; click a chart point to pin it while you scroll.
      </p>
      <div key={step} className="mt-3 max-h-[32rem] space-y-3 overflow-auto pr-1">
        {entries.length > 0 ? (
          entries.map((entry, index) => {
            const messages = parseTrainingTranscript(entry);
            return (
              <div key={`${step}-${index}`} className="rounded-lg border border-border/60 bg-background/70 p-2">
                <div className="mb-2 text-ui-10 font-medium text-muted-foreground">
                  Microbatch entry {index + 1}
                </div>
                {messages.length > 0 ? (
                  <div className="space-y-2">
                    {messages.map((message, messageIndex) => (
                      <div
                        key={`${message.role}-${messageIndex}`}
                        className={message.role === "user" ? "ml-5" : message.role === "assistant" ? "mr-5" : "mx-2"}
                      >
                        <div className="mb-1 text-ui-10 font-semibold uppercase tracking-wide text-muted-foreground">
                          {message.role}
                        </div>
                        <div
                          className={
                            message.role === "user"
                              ? "whitespace-pre-wrap break-words rounded-xl rounded-br-sm bg-blue-500/12 px-3 py-2 text-ui-11 text-foreground"
                              : message.role === "assistant"
                                ? "whitespace-pre-wrap break-words rounded-xl rounded-bl-sm bg-violet-500/12 px-3 py-2 text-ui-11 text-foreground"
                                : "whitespace-pre-wrap break-words rounded-lg bg-muted/60 px-3 py-2 text-ui-11 text-muted-foreground"
                          }
                        >
                          {message.reasoning && (
                            <div className="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2">
                              <div className="mb-1 text-ui-10 font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                                Reasoning
                              </div>
                              <div className="whitespace-pre-wrap break-words text-muted-foreground">
                                {message.reasoning}
                              </div>
                            </div>
                          )}
                          {message.content}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-words p-1 text-ui-11 text-foreground">
                    {entry}
                  </pre>
                )}
              </div>
            );
          })
        ) : error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-500">
            {error}
          </p>
        ) : (
          <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
            Waiting for the first training step.
          </p>
        )}
      </div>
    </SectionCard>
  );
}
