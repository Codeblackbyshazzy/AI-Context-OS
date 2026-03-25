import { invoke } from "@tauri-apps/api/core";
import type {
  Config,
  CreateMemoryInput,
  DailyEntry,
  FileNode,
  GraphData,
  Memory,
  MemoryFilter,
  MemoryMeta,
  SaveMemoryInput,
  ScoredMemory,
  Conflict,
  ConsolidationSuggestion,
} from "./types";

// Config
export const initWorkspace = () => invoke<boolean>("init_workspace");
export const getConfig = () => invoke<Config>("get_config");
export const saveConfig = (config: Config) =>
  invoke<void>("save_config", { config });

// Memory CRUD
export const listMemories = (filter?: MemoryFilter) =>
  invoke<MemoryMeta[]>("list_memories", { filter: filter ?? null });
export const getMemory = (id: string) =>
  invoke<Memory>("get_memory", { id });
export const createMemory = (input: CreateMemoryInput) =>
  invoke<Memory>("create_memory", { input });
export const saveMemory = (input: SaveMemoryInput) =>
  invoke<Memory>("save_memory", { input });
export const deleteMemory = (id: string) =>
  invoke<void>("delete_memory", { id });

// Filesystem
export const getFileTree = () => invoke<FileNode[]>("get_file_tree");
export const readFile = (path: string) =>
  invoke<string>("read_file", { path });
export const writeFile = (path: string, content: string) =>
  invoke<void>("write_file", { path, content });

// Router
export const regenerateRouter = () => invoke<string>("regenerate_router");
export const getRouterContent = () => invoke<string>("get_router_content");

// Scoring
export const simulateContext = (query: string, tokenBudget: number) =>
  invoke<ScoredMemory[]>("simulate_context", {
    query,
    token_budget: tokenBudget,
  });

// Graph
export const getGraphData = () => invoke<GraphData>("get_graph_data");

// Governance
export const getConflicts = () => invoke<Conflict[]>("get_conflicts");
export const getDecayCandidates = () =>
  invoke<MemoryMeta[]>("get_decay_candidates");
export const getConsolidationSuggestions = () =>
  invoke<ConsolidationSuggestion[]>("get_consolidation_suggestions");
export const getScratchCandidates = () =>
  invoke<string[]>("get_scratch_candidates");

// Daily
export const getDailyEntries = (date?: string) =>
  invoke<DailyEntry[]>("get_daily_entries", { date: date ?? null });
export const appendDailyEntry = (entry: DailyEntry) =>
  invoke<void>("append_daily_entry", { entry });

// Onboarding
export interface OnboardingProfile {
  name: string;
  role: string;
  tools: string[];
  language: string;
  template: string;
  root_dir?: string;
}
export const runOnboarding = (profile: OnboardingProfile) =>
  invoke<boolean>("run_onboarding", { profile });
export const isOnboarded = () => invoke<boolean>("is_onboarded");
