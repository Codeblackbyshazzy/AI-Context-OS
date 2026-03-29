import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { useObservabilityStore } from "../lib/observabilityStore";
import type { ContextEventPayload } from "../lib/types";

/** Listen to real-time context events from the MCP server. */
export function useContextEvents() {
  const addLiveEvent = useObservabilityStore((s) => s.addLiveEvent);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    listen<ContextEventPayload>("context-event", (event) => {
      addLiveEvent(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [addLiveEvent]);
}
