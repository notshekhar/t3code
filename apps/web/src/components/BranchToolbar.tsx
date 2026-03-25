import type { RuntimeMode, ThreadId } from "@t3tools/contracts";
import { CircleAlertIcon, FolderIcon, GitForkIcon, LockIcon } from "lucide-react";
import { useCallback } from "react";

import { newCommandId } from "../lib/utils";
import { readNativeApi } from "../nativeApi";
import { useComposerDraftStore } from "../composerDraftStore";
import { useStore } from "../store";
import {
  EnvMode,
  resolveDraftEnvModeAfterBranchChange,
  resolveEffectiveEnvMode,
} from "./BranchToolbar.logic";
import { cn } from "~/lib/utils";
import { BranchToolbarBranchSelector } from "./BranchToolbarBranchSelector";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "./ui/select";

const envModeItems = [
  { value: "local", label: "Local" },
  { value: "worktree", label: "New worktree" },
] as const;

const runtimeModeItems = [
  { value: "approval-required" as const, label: "Supervised" },
  { value: "full-access" as const, label: "Full access" },
] as const;

interface BranchToolbarProps {
  threadId: ThreadId;
  onEnvModeChange: (mode: EnvMode) => void;
  envLocked: boolean;
  runtimeMode: RuntimeMode;
  onRuntimeModeChange: (mode: RuntimeMode) => void;
  showBranchSelector: boolean;
  onCheckoutPullRequestRequest?: (reference: string) => void;
  onComposerFocusRequest?: () => void;
}

export default function BranchToolbar({
  threadId,
  onEnvModeChange,
  envLocked,
  runtimeMode,
  onRuntimeModeChange,
  showBranchSelector,
  onCheckoutPullRequestRequest,
  onComposerFocusRequest,
}: BranchToolbarProps) {
  const threads = useStore((store) => store.threads);
  const projects = useStore((store) => store.projects);
  const setThreadBranchAction = useStore((store) => store.setThreadBranch);
  const draftThread = useComposerDraftStore((store) => store.getDraftThread(threadId));
  const setDraftThreadContext = useComposerDraftStore((store) => store.setDraftThreadContext);

  const serverThread = threads.find((thread) => thread.id === threadId);
  const activeProjectId = serverThread?.projectId ?? draftThread?.projectId ?? null;
  const activeProject = projects.find((project) => project.id === activeProjectId);
  const activeThreadId = serverThread?.id ?? (draftThread ? threadId : undefined);
  const activeThreadBranch = serverThread?.branch ?? draftThread?.branch ?? null;
  const activeWorktreePath = serverThread?.worktreePath ?? draftThread?.worktreePath ?? null;
  const branchCwd = activeWorktreePath ?? activeProject?.cwd ?? null;
  const hasServerThread = serverThread !== undefined;
  const effectiveEnvMode = resolveEffectiveEnvMode({
    activeWorktreePath,
    hasServerThread,
    draftThreadEnvMode: draftThread?.envMode,
  });

  const setThreadBranch = useCallback(
    (branch: string | null, worktreePath: string | null) => {
      if (!activeThreadId) return;
      const api = readNativeApi();
      // If the effective cwd is about to change, stop the running session so the
      // next message creates a new one with the correct cwd.
      if (serverThread?.session && worktreePath !== activeWorktreePath && api) {
        void api.orchestration
          .dispatchCommand({
            type: "thread.session.stop",
            commandId: newCommandId(),
            threadId: activeThreadId,
            createdAt: new Date().toISOString(),
          })
          .catch(() => undefined);
      }
      if (api && hasServerThread) {
        void api.orchestration.dispatchCommand({
          type: "thread.meta.update",
          commandId: newCommandId(),
          threadId: activeThreadId,
          branch,
          worktreePath,
        });
      }
      if (hasServerThread) {
        setThreadBranchAction(activeThreadId, branch, worktreePath);
        return;
      }
      const nextDraftEnvMode = resolveDraftEnvModeAfterBranchChange({
        nextWorktreePath: worktreePath,
        currentWorktreePath: activeWorktreePath,
        effectiveEnvMode,
      });
      setDraftThreadContext(threadId, {
        branch,
        worktreePath,
        envMode: nextDraftEnvMode,
      });
    },
    [
      activeThreadId,
      serverThread?.session,
      activeWorktreePath,
      hasServerThread,
      setThreadBranchAction,
      setDraftThreadContext,
      threadId,
      effectiveEnvMode,
    ],
  );

  if (!activeThreadId || !activeProject) return null;

  return (
    <div className="mx-auto flex w-full max-w-3xl items-center gap-x-2 px-5 pb-3 pt-1 sm:gap-x-3">
      <div className="flex min-w-0 justify-start">
        {envLocked || activeWorktreePath ? (
          <span className="inline-flex items-center gap-1 border border-transparent px-[calc(--spacing(3)-1px)] text-sm font-medium text-muted-foreground/70 sm:text-xs">
            {activeWorktreePath ? (
              <>
                <GitForkIcon className="size-3" />
                Worktree
              </>
            ) : (
              <>
                <FolderIcon className="size-3" />
                Local
              </>
            )}
          </span>
        ) : (
          <Select
            value={effectiveEnvMode}
            onValueChange={(value) => onEnvModeChange(value as EnvMode)}
            items={envModeItems}
          >
            <SelectTrigger variant="ghost" size="xs" className="font-medium">
              {effectiveEnvMode === "worktree" ? (
                <GitForkIcon className="size-3" />
              ) : (
                <FolderIcon className="size-3" />
              )}
              <SelectValue />
            </SelectTrigger>
            <SelectPopup>
              <SelectItem value="local">
                <span className="inline-flex items-center gap-1.5">
                  <FolderIcon className="size-3" />
                  Local
                </span>
              </SelectItem>
              <SelectItem value="worktree">
                <span className="inline-flex items-center gap-1.5">
                  <GitForkIcon className="size-3" />
                  New worktree
                </span>
              </SelectItem>
            </SelectPopup>
          </Select>
        )}
      </div>

      <div className="flex shrink-0">
        <Select
          value={runtimeMode}
          onValueChange={(value) => onRuntimeModeChange(value as RuntimeMode)}
          items={runtimeModeItems}
        >
          <SelectTrigger
            variant="ghost"
            size="xs"
            className={cn(
              "max-w-[min(100vw-8rem,14rem)] font-medium",
              runtimeMode === "full-access" &&
                "text-amber-600 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-500",
            )}
            title={
              runtimeMode === "full-access"
                ? "Full access — agent runs without approval prompts"
                : "Supervised — approve commands and file changes"
            }
          >
            {runtimeMode === "full-access" ? (
              <CircleAlertIcon className="size-3 shrink-0" />
            ) : (
              <LockIcon className="size-3 shrink-0" />
            )}
            <SelectValue />
          </SelectTrigger>
          <SelectPopup align="center">
            <SelectItem value="approval-required">
              <span className="inline-flex items-center gap-1.5">
                <LockIcon className="size-3" />
                Supervised
              </span>
            </SelectItem>
            <SelectItem value="full-access">
              <span className="inline-flex items-center gap-1.5">
                <CircleAlertIcon className="size-3" />
                Full access
              </span>
            </SelectItem>
          </SelectPopup>
        </Select>
      </div>

      <div className="ml-auto flex min-w-0 justify-end">
        {showBranchSelector ? (
          <BranchToolbarBranchSelector
            activeProjectCwd={activeProject.cwd}
            activeThreadBranch={activeThreadBranch}
            activeWorktreePath={activeWorktreePath}
            branchCwd={branchCwd}
            effectiveEnvMode={effectiveEnvMode}
            envLocked={envLocked}
            onSetThreadBranch={setThreadBranch}
            {...(onCheckoutPullRequestRequest ? { onCheckoutPullRequestRequest } : {})}
            {...(onComposerFocusRequest ? { onComposerFocusRequest } : {})}
          />
        ) : null}
      </div>
    </div>
  );
}
