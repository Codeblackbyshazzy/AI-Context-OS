import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "../lib/store";

/** Listen to Tauri events from the Rust file watcher and refresh state. */
export function useFileWatcher() {
  const { loadFileTree, loadMemories, regenerateRouter } = useAppStore();

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setup = async () => {
      const unlisten1 = await listen("memory-changed", async () => {
        await loadMemories();
        await loadFileTree();
      });
      unlisteners.push(unlisten1);

      const unlisten2 = await listen("file-deleted", async () => {
        await loadMemories();
        await loadFileTree();
      });
      unlisteners.push(unlisten2);

      const unlisten3 = await listen("router-regenerated", async () => {
        await loadMemories();
      });
      unlisteners.push(unlisten3);
    };

    setup();

    return () => {
      unlisteners.forEach((fn) => fn());
    };
  }, [loadFileTree, loadMemories, regenerateRouter]);
}
