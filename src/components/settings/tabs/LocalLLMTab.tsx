import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import {
  RefreshCw, Loader2, Check, Trash2, ChevronDown, ChevronUp,
  Download, FolderOpen, Zap, WifiOff
} from "lucide-react";
import {
  discoverLocalProviders,
  saveInferenceProviderConfig,
  testInferenceProvider,
  pullOllamaModel,
  deleteOllamaModel,
} from "../../../lib/tauri";
import type {
  DiscoveredProvider,
  InferenceProviderConfig,
  InferenceProviderPreset,
  ProviderModel,
} from "../../../lib/types";

const OLLAMA_MODELS_DIR = "~/.ollama/models";
const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434/v1";
const DEFAULT_LM_STUDIO_URL = "http://127.0.0.1:1234/v1";

type LocalPreset = "disabled" | "ollama" | "lm_studio";
type BusyState = "idle" | "discovering" | "saving" | "testing" | "pulling" | "deleting";

interface Props {
  config: InferenceProviderConfig | null;
  onSaved: (config: InferenceProviderConfig) => void;
}

export function LocalLLMTab({ config, onSaved }: Props) {
  const { t } = useTranslation();

  const [providers, setProviders] = useState<DiscoveredProvider[]>([]);
  const [activePreset, setActivePreset] = useState<LocalPreset>("disabled");
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [busy, setBusy] = useState<BusyState>("idle");
  const [pullInput, setPullInput] = useState("");
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [endpointOverride, setEndpointOverride] = useState("");

  // Hydrate from saved config on mount
  useEffect(() => {
    if (!config) return;
    const preset = config.preset;
    if (preset === "ollama") {
      setActivePreset("ollama");
      setEndpointOverride(config.base_url ?? DEFAULT_OLLAMA_URL);
    } else if (preset === "lm_studio") {
      setActivePreset("lm_studio");
      setEndpointOverride(config.base_url ?? DEFAULT_LM_STUDIO_URL);
    } else {
      setActivePreset("disabled");
    }
    setSelectedModel(config.model ?? "");
  }, [config]);

  const handleDiscover = useCallback(async (keepExistingModels = false) => {
    setBusy("discovering");
    setStatusMsg(null);
    try {
      const found = await discoverLocalProviders();
      setProviders(found);
      // Update models for the currently active preset
      if (!keepExistingModels && activePreset !== "disabled") {
        const match = found.find((p) => p.preset === activePreset);
        if (match) setModels(match.models);
      }
    } catch {
      // ignore
    } finally {
      setBusy("idle");
    }
  }, [activePreset]);

  // Auto-discover on mount
  useEffect(() => {
    void handleDiscover(true);
  }, []);

  // When switching preset, refresh models from already-discovered list
  useEffect(() => {
    if (activePreset === "disabled") {
      setModels([]);
      return;
    }
    const match = providers.find((p) => p.preset === activePreset);
    if (match) {
      setModels(match.models);
      if (!selectedModel && match.models.length > 0) {
        setSelectedModel(match.models[0].id);
      }
    } else {
      setModels([]);
    }
  }, [activePreset, providers]);

  const currentProvider = providers.find((p) => p.preset === activePreset);
  const isAvailable = currentProvider?.reachable ?? false;

  const handleSelectPreset = useCallback((preset: LocalPreset) => {
    setActivePreset(preset);
    setSelectedModel("");
    setStatusMsg(null);
    if (preset === "ollama") setEndpointOverride(DEFAULT_OLLAMA_URL);
    else if (preset === "lm_studio") setEndpointOverride(DEFAULT_LM_STUDIO_URL);
  }, []);

  const buildConfig = useCallback((): InferenceProviderConfig => ({
    enabled: activePreset !== "disabled",
    kind: "openai_compatible",
    preset: activePreset === "ollama" ? "ollama" : activePreset === "lm_studio" ? "lm_studio" : "custom",
    model: selectedModel,
    base_url: endpointOverride || null,
    api_key: null,
    capabilities: ["proposal", "classification", "summary", "chat", "streaming"],
  }), [activePreset, selectedModel, endpointOverride]);

  const handleSave = useCallback(async () => {
    setBusy("saving");
    setStatusMsg(null);
    try {
      const saved = await saveInferenceProviderConfig(buildConfig());
      onSaved(saved);
      setStatusMsg({ ok: true, text: "Saved." });
    } catch (e) {
      setStatusMsg({ ok: false, text: String(e) });
    } finally {
      setBusy("idle");
    }
  }, [buildConfig, onSaved]);

  const handleTest = useCallback(async () => {
    setBusy("testing");
    setStatusMsg(null);
    try {
      const status = await testInferenceProvider(buildConfig());
      setStatusMsg({ ok: status.healthy, text: status.message });
    } catch (e) {
      setStatusMsg({ ok: false, text: String(e) });
    } finally {
      setBusy("idle");
    }
  }, [buildConfig]);

  const handlePull = useCallback(async () => {
    if (!pullInput.trim()) return;
    setBusy("pulling");
    setStatusMsg(null);
    try {
      await pullOllamaModel(pullInput.trim());
      setPullInput("");
      setStatusMsg({ ok: true, text: t("settings.localLLM.pullSuccess") });
      // Refresh models list
      await handleDiscover();
    } catch (e) {
      setStatusMsg({ ok: false, text: `${t("settings.localLLM.pullError")}: ${String(e)}` });
    } finally {
      setBusy("idle");
    }
  }, [pullInput, t, handleDiscover]);

  const handleDelete = useCallback(async (modelId: string) => {
    setDeletingModel(modelId);
    setStatusMsg(null);
    try {
      await deleteOllamaModel(modelId);
      if (selectedModel === modelId) setSelectedModel("");
      await handleDiscover();
    } catch (e) {
      setStatusMsg({ ok: false, text: String(e) });
    } finally {
      setDeletingModel(null);
    }
  }, [selectedModel, handleDiscover]);

  const formatSize = (bytes?: number | null) => {
    if (!bytes) return null;
    const gb = bytes / 1_000_000_000;
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1_000_000).toFixed(0)} MB`;
  };

  const presets: { id: LocalPreset; label: string }[] = [
    { id: "disabled", label: t("settings.localLLM.disabled") },
    { id: "ollama", label: "Ollama" },
    { id: "lm_studio", label: "LM Studio" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="obs-panel border border-[color:var(--border)] p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-[color:var(--text-0)]">{t("settings.localLLM.title")}</h2>
            <p className="mt-1 text-sm text-[color:var(--text-2)]">{t("settings.localLLM.desc")}</p>
          </div>
          {activePreset !== "disabled" && (
            <span
              className={clsx(
                "mt-0.5 shrink-0 rounded-full px-3 py-1 text-xs font-medium",
                isAvailable
                  ? "bg-green-500/10 text-green-600"
                  : "bg-[color:var(--bg-2)] text-[color:var(--text-2)]",
              )}
            >
              {isAvailable ? t("settings.localLLM.available") : t("settings.localLLM.unavailable")}
            </span>
          )}
        </div>

        {/* Provider selector */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[color:var(--text-2)]">
            {t("settings.localLLM.provider")}
          </p>
          <div className="flex gap-2">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p.id)}
                className={clsx(
                  "flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors",
                  activePreset === p.id
                    ? "border-[color:var(--accent)] bg-[color:var(--accent-muted)] text-[color:var(--accent)]"
                    : "border-[color:var(--border)] bg-[color:var(--bg-0)] text-[color:var(--text-1)] hover:border-[color:var(--border-active)]",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Not available hint */}
        {activePreset !== "disabled" && !isAvailable && busy === "idle" && (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-0)] px-4 py-3 text-sm text-[color:var(--text-2)]">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>
              {t("settings.localLLM.startHint", {
                provider: activePreset === "ollama" ? "Ollama" : "LM Studio",
              })}
            </span>
          </div>
        )}
      </section>

      {/* Available Models */}
      {activePreset !== "disabled" && (
        <section className="obs-panel border border-[color:var(--border)] p-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--text-2)]">
              {t("settings.localLLM.availableModels")}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[color:var(--text-2)]">
                {isAvailable
                  ? t("settings.localLLM.selectModelHint")
                  : t("settings.localLLM.noModels", {
                      provider: activePreset === "ollama" ? "Ollama" : "LM Studio",
                    })}
              </span>
              <button
                onClick={() => void handleDiscover()}
                disabled={busy !== "idle"}
                title={t("settings.localLLM.refresh")}
                className="flex items-center gap-1.5 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-0)] px-2.5 py-1.5 text-xs text-[color:var(--text-1)] transition-colors hover:border-[color:var(--border-active)] disabled:opacity-60"
              >
                {busy === "discovering"
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <RefreshCw className="h-3.5 w-3.5" />}
                {busy === "discovering" ? t("settings.localLLM.refreshing") : t("settings.localLLM.refresh")}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            {models.length === 0 ? (
              <div className="rounded-md border border-dashed border-[color:var(--border)] px-4 py-6 text-center text-sm text-[color:var(--text-2)]">
                {busy === "discovering"
                  ? t("settings.localLLM.refreshing")
                  : t("settings.localLLM.noModels", {
                      provider: activePreset === "ollama" ? "Ollama" : "LM Studio",
                    })}
              </div>
            ) : (
              models.map((model) => {
                const isSelected = selectedModel === model.id;
                const sizeStr = formatSize(model.size);
                const isDeleting = deletingModel === model.id;
                return (
                  <div
                    key={model.id}
                    className={clsx(
                      "group flex items-center justify-between rounded-md border px-4 py-3 transition-colors",
                      isSelected
                        ? "border-[color:var(--accent)] bg-[color:var(--accent-muted)]"
                        : "border-[color:var(--border)] bg-[color:var(--bg-0)] hover:border-[color:var(--border-active)]",
                    )}
                  >
                    <button
                      className="flex flex-1 items-center gap-3 text-left"
                      onClick={() => {
                        setSelectedModel(model.id);
                        setStatusMsg(null);
                      }}
                    >
                      <div
                        className={clsx(
                          "h-2.5 w-2.5 shrink-0 rounded-full",
                          isSelected ? "bg-[color:var(--accent)]" : "bg-[color:var(--bg-3)] group-hover:bg-[color:var(--border-active)]",
                        )}
                      />
                      <div>
                        <span className={clsx("text-sm font-medium", isSelected ? "text-[color:var(--accent)]" : "text-[color:var(--text-0)]")}>
                          {model.name}
                        </span>
                        {model.family && (
                          <span className="ml-1.5 text-xs text-[color:var(--text-2)]">{model.family}</span>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-3">
                      {sizeStr && <span className="text-xs text-[color:var(--text-2)]">{sizeStr}</span>}
                      {activePreset === "ollama" && (
                        <button
                          onClick={() => void handleDelete(model.id)}
                          disabled={isDeleting || busy !== "idle"}
                          title={t("settings.localLLM.deleteModel")}
                          className="opacity-0 group-hover:opacity-100 rounded p-1 text-[color:var(--text-2)] hover:text-red-500 transition-all disabled:opacity-60"
                        >
                          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Model Manager — Ollama only */}
      {activePreset === "ollama" && (
        <section className="obs-panel border border-[color:var(--border)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--text-2)]">
              {t("settings.localLLM.modelManager")}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => void (async () => {
                  const { showInFileManager } = await import("../../../lib/tauri");
                  showInFileManager(OLLAMA_MODELS_DIR);
                })()}
                className="text-xs text-[color:var(--text-2)] hover:text-[color:var(--text-1)] flex items-center gap-1 transition-colors"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                {t("settings.localLLM.openFolder")}
              </button>
              <span className="text-[color:var(--border)]">|</span>
              <button
                onClick={() => void handleDiscover()}
                disabled={busy !== "idle"}
                className="text-xs text-[color:var(--text-2)] hover:text-[color:var(--text-1)] flex items-center gap-1 transition-colors disabled:opacity-60"
              >
                <RefreshCw className={clsx("h-3.5 w-3.5", busy === "discovering" && "animate-spin")} />
                {t("settings.localLLM.refresh")}
              </button>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-[color:var(--text-2)]">{t("settings.localLLM.pullNewModel")}</p>
            <div className="flex gap-2">
              <input
                value={pullInput}
                onChange={(e) => setPullInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handlePull(); }}
                placeholder={t("settings.localLLM.pullPlaceholder")}
                disabled={busy !== "idle"}
                className="flex-1 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-0)] px-3 py-2 text-sm text-[color:var(--text-0)] placeholder:text-[color:var(--text-2)] focus:border-[color:var(--accent)] focus:outline-none disabled:opacity-60"
              />
              <button
                onClick={() => void handlePull()}
                disabled={!pullInput.trim() || busy !== "idle"}
                className="flex items-center gap-2 rounded-md bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {busy === "pulling" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {busy === "pulling" ? t("settings.localLLM.pulling") : t("settings.localLLM.pull")}
              </button>
            </div>
            {busy === "pulling" && (
              <p className="mt-2 text-xs text-[color:var(--text-2)]">
                {t("settings.localLLM.pulling")} — {t("settings.localLLM.pullPlaceholder")}…
              </p>
            )}
          </div>
        </section>
      )}

      {/* Advanced settings (endpoint override) */}
      {activePreset !== "disabled" && (
        <section className="obs-panel border border-[color:var(--border)] p-4">
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between text-sm text-[color:var(--text-2)] hover:text-[color:var(--text-1)] transition-colors"
          >
            <span>{t("settings.localLLM.advancedSettings")}</span>
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showAdvanced && (
            <div className="mt-4">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-medium text-[color:var(--text-2)]">{t("settings.localLLM.endpoint")}</span>
                <input
                  value={endpointOverride}
                  onChange={(e) => setEndpointOverride(e.target.value)}
                  className="rounded-md border border-[color:var(--border)] bg-[color:var(--bg-0)] px-3 py-2 text-sm text-[color:var(--text-0)] focus:border-[color:var(--accent)] focus:outline-none"
                />
              </label>
            </div>
          )}
        </section>
      )}

      {/* Status message */}
      {statusMsg && (
        <div
          className={clsx(
            "rounded-md px-4 py-3 text-sm",
            statusMsg.ok ? "bg-green-500/5 text-green-600" : "bg-red-500/5 text-red-500",
          )}
        >
          {statusMsg.text}
        </div>
      )}

      {/* Action buttons */}
      {activePreset !== "disabled" && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => void handleSave()}
            disabled={busy !== "idle" || !selectedModel}
            className="inline-flex items-center gap-2 rounded-md bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {busy === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy === "saving" ? t("settings.localLLM.saving") : t("settings.localLLM.save")}
          </button>
          <button
            onClick={() => void handleTest()}
            disabled={busy !== "idle" || !selectedModel}
            className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-0)] px-4 py-2 text-sm font-medium text-[color:var(--text-1)] disabled:opacity-60"
          >
            {busy === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {busy === "testing" ? t("settings.localLLM.testing") : t("settings.localLLM.test")}
          </button>
          {busy === "idle" && statusMsg?.ok && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {t("settings.localLLM.connectionOk")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
