import { create } from "zustand";
import type {
  ContextEventPayload,
  ObservabilityStats,
  HealthScore,
  OptimizationRecord,
  McpConnectionInfo,
} from "./types";
import {
  getObservabilityStats,
  getHealthScore as fetchHealthScore,
  getPendingOptimizations,
  getMcpConnectionInfo,
} from "./tauri";

interface ObservabilityStore {
  liveEvents: ContextEventPayload[];
  stats: ObservabilityStats | null;
  healthScore: HealthScore | null;
  optimizations: OptimizationRecord[];
  connectionInfo: McpConnectionInfo | null;
  addLiveEvent: (event: ContextEventPayload) => void;
  loadStats: () => Promise<void>;
  loadHealthScore: () => Promise<void>;
  loadOptimizations: () => Promise<void>;
  loadConnectionInfo: () => Promise<void>;
}

export const useObservabilityStore = create<ObservabilityStore>((set) => ({
  liveEvents: [],
  stats: null,
  healthScore: null,
  optimizations: [],
  connectionInfo: null,

  addLiveEvent: (event) =>
    set((state) => ({
      liveEvents: [event, ...state.liveEvents].slice(0, 50),
    })),

  loadStats: async () => {
    try {
      const stats = await getObservabilityStats(7);
      set({ stats });
    } catch (e) {
      console.error("Failed to load observability stats:", e);
    }
  },

  loadHealthScore: async () => {
    try {
      const healthScore = await fetchHealthScore();
      set({ healthScore });
    } catch (e) {
      console.error("Failed to load health score:", e);
    }
  },

  loadOptimizations: async () => {
    try {
      const optimizations = await getPendingOptimizations();
      set({ optimizations });
    } catch (e) {
      console.error("Failed to load optimizations:", e);
    }
  },

  loadConnectionInfo: async () => {
    try {
      const connectionInfo = await getMcpConnectionInfo();
      set({ connectionInfo });
    } catch (e) {
      console.error("Failed to load MCP connection info:", e);
    }
  },
}));
