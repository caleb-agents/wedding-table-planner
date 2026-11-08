import { useEffect, useRef, useState } from "react";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { ImportPayload } from "./sync";

type Phase = "syncing" | "saving" | "saved" | "error";
type Step = { undo: () => Promise<unknown>; redo: () => Promise<unknown> };

function message(error: unknown): string {
  const raw = error instanceof Error ? error.message : "";
  const useful = raw.match(/Uncaught Error:\s*([^\n]+)/);
  const sentence = useful?.[1]?.trim();
  if (sentence && sentence.length < 180 && !/request id/i.test(sentence)) return sentence;
  if (/full/i.test(raw)) return "That table is full.";
  return "Not saved. The shared plan did not accept that change.";
}

export function useSharedSync() {
  const remote = useQuery(api.plan.get);
  const connection = useConvexConnectionState();
  const seat = useMutation(api.plan.seat);
  const unseat = useMutation(api.plan.unseat);
  const renameGroup = useMutation(api.plan.renameGroup);
  const addGroupMutation = useMutation(api.plan.addGroup);
  const removeGroupMutation = useMutation(api.plan.removeGroup);
  const importLocalMutation = useMutation(api.plan.importLocal);
  const ensureDefaults = useMutation(api.plan.ensureDefaults);
  const [busy, setBusy] = useState(false);
  const [browserOffline, setBrowserOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  useEffect(() => {
    const update = () => setBrowserOffline(navigator.onLine === false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const [detail, setDetail] = useState<string | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const past = useRef<Step[]>([]);
  const future = useRef<Step[]>([]);
  const ensured = useRef(false);

  useEffect(() => {
    if (remote === undefined || remote.groups.length > 0 || ensured.current) return;
    ensured.current = true;
    void ensureDefaults({}).catch(error => {
      setDetail(message(error));
    });
  }, [remote, ensureDefaults]);

  const phase: Phase = detail ? "error" : busy ? "saving" : remote === undefined ? "syncing" : "saved";

  function remember(step: Step) {
    past.current = [...past.current.slice(-49), step];
    future.current = [];
    setUndoCount(past.current.length);
    setRedoCount(0);
  }

  async function run(step: Step) {
    setBusy(true);
    setDetail(null);
    try {
      await step.redo();
      remember(step);
      setBusy(false);
    } catch (error) {
      setBusy(false);
      setDetail(message(error));
      throw error;
    }
  }

  return {
    remote,
    phase,
    detail,
    offline: browserOffline || (connection.hasEverConnected && !connection.isWebSocketConnected),
    canUndo: undoCount > 0,
    canRedo: redoCount > 0,
    assign(guestId: string, groupId: string, previousGroupId: string | null) {
      return run({
        redo: () => seat({ guestId, groupId }),
        undo: () => (previousGroupId === null ? unseat({ guestId }) : seat({ guestId, groupId: previousGroupId })),
      });
    },
    unseat(guestId: string, previousGroupId: string) {
      return run({
        redo: () => unseat({ guestId }),
        undo: () => seat({ guestId, groupId: previousGroupId }),
      });
    },
    rename(groupId: string, name: string, previousName: string) {
      return run({
        redo: () => renameGroup({ groupId, name }),
        undo: () => renameGroup({ groupId, name: previousName }),
      });
    },
    addGroup(groupId: string, name: string, sort: number) {
      return run({
        redo: () => addGroupMutation({ groupId, name, sort }),
        undo: () => removeGroupMutation({ groupId }),
      });
    },
    removeGroup(groupId: string, name: string, sort: number) {
      return run({
        redo: () => removeGroupMutation({ groupId }),
        undo: () => addGroupMutation({ groupId, name, sort }),
      });
    },
    importLocal(payload: ImportPayload) {
      setBusy(true);
      setDetail(null);
      return importLocalMutation(payload).then(
        () => setBusy(false),
        (error: unknown) => {
          setBusy(false);
          setDetail(message(error));
          throw error;
        },
      );
    },
    async undo() {
      const step = past.current[past.current.length - 1];
      if (!step) return;
      setBusy(true);
      setDetail(null);
      try {
        await step.undo();
        past.current = past.current.slice(0, -1);
        future.current = [...future.current, step];
        setUndoCount(past.current.length);
        setRedoCount(future.current.length);
        setBusy(false);
      } catch (error) {
        setBusy(false);
        setDetail(message(error));
      }
    },
    async redo() {
      const step = future.current[future.current.length - 1];
      if (!step) return;
      setBusy(true);
      setDetail(null);
      try {
        await step.redo();
        future.current = future.current.slice(0, -1);
        past.current = [...past.current, step];
        setUndoCount(past.current.length);
        setRedoCount(future.current.length);
        setBusy(false);
      } catch (error) {
        setBusy(false);
        setDetail(message(error));
      }
    },
  };
}

export type SharedSync = ReturnType<typeof useSharedSync>;
