import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";
import { Loader2, Zap, ChevronDown, Search } from "lucide-react";
import {
  saveInferenceProviderConfig,
  testInferenceProvider,
  listProviderModels,
} from "../../../lib/tauri";
import type {
  InferenceProviderConfig,
  InferenceProviderKind,
  InferenceProviderPreset,
  ProviderModel,
} from "../../../lib/types";

type CloudPreset = "openai" | "openrouter" | "anthropic" | "custom";
type BusyState = "idle" | "saving" | "testing" | "loading_models";

interface CloudProvider {
  id: CloudPreset;
  label: string;
  kind: InferenceProviderKind;
  preset: InferenceProviderPreset;
  defaultUrl: string;
  requiresKey: boolean;
  modelPlaceholder: string;
}

const CLOUD_PROVIDERS: CloudProvider[] = [
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai_compatible",
    preset: "openai",
    defaultUrl: "https://api.openai.com/v1",
    requiresKey: true,
    modelPlaceholder: "gpt-4.1-mini",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "openai_compatible",
    preset: "openrouter",
    defaultUrl: "https://openrouter.ai/api/v1",
    requiresKey: true,
    modelPlaceholder: "openai/gpt-4o-mini",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    kind: "anthropic",
    preset: "openai",
    defaultUrl: "https://api.anthropic.com",
    requiresKey: true,
    modelPlaceholder: "claude-sonnet-4-20250514",
  },
  {
    id: "custom",
    label: "Custom",
    kind: "openai_compatible",
    preset: "custom",
    defaultUrl: "",
    requiresKey: false,
    modelPlaceholder: "model-name",
  },
];

interface Props {
  config: InferenceProviderConfig | null;
  onSaved: (config: InferenceProviderConfig) => void;
}

export function CloudLLMTab({ config, onSaved }: Props) {
  const { t } = useTranslation();

  const [activePreset, setActivePreset] = useState<CloudPreset>("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState(CLOUD_PROVIDERS[0].defaultUrl);
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState<BusyState>("idle");
  const [statusMsg, setStatusMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Hydrate from saved config
  useEffect(() => {
    if (!config) return;
    const { preset, kind, model: m, api_key, base_url, enabled: en } = config;
    if (preset === "ollama" || preset === "lm_studio") return; // local — not for this tab
    setEnabled(en);
    setModel(m ?? "");
    setApiKey(api_key ?? "");
    setEndpoint(base_url ?? "");
    if (preset === "openai") setActivePreset("openai");
    else if (preset === "openrouter") setActivePreset("openrouter");
    else if (kind === "anthropic") setActivePreset("anthropic");
    else setActivePreset("custom");
  }, [config]);

  const currentProvider = CLOUD_PROVIDERS.find((p) => p.id === activePreset)!;

  const handleSelectPreset = (preset: CloudPreset) => {
    const provider = CLOUD_PROVIDERS.find((p) => p.id === preset)!;
    setActivePreset(preset);
    setEndpoint(provider.defaultUrl);
    setModel("");
    setModels([]);
    setStatusMsg(null);
  };

  const buildConfig = useCallback((): InferenceProviderConfig => ({
    enabled,
    kind: currentProvider.kind,
    preset: currentProvider.preset,
    model,
    base_url: endpoint.trim() || null,
    api_key: apiKey.trim() || null,
    capabilities: ["proposal", "classification", "summary", "chat"],
  }), [enabled, currentProvider, model, endpoint, apiKey]);

  const handleLoadModels = useCallback(async () => {
    setBusy("loading_models");
    setStatusMsg(null);
    try {
      const loaded = await listProviderModels(buildConfig());
      setModels(loaded);
    } catch (e) {
      setStatusMsg({ ok: false, text: String(e) });
    } finally {
      setBusy("idle");
    }
  }, [buildConfig]);

  const handleSave = useCallback(async () => {
    setBusy("saving");
    setStatusMsg(null);
    try {
      const saved = await saveInferenceProviderConfig(buildConfig());
      onSaved(saved);
      if (saved.enabled) {
        setBusy("testing");
        try {
          const status = await testInferenceProvider(saved);
          setStatusMsg({ ok: status.healthy, text: status.message });
        } catch {
          setStatusMsg({ ok: false, text: t("settings.cloudLLM.connectionFailed") });
        }
      } else {
        setStatusMsg({ ok: true, text: "Saved." });
      }
    } catch (e) {
      setStatusMsg({ ok: false, text: String(e) });
    } finally {
      setBusy("idle");
    }
  }, [buildConfig, onSaved, t]);

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

  return (
    <div className="space-y-6">
      <section className="obs-panel border border-[color:var(--border)] p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium text-[color:var(--text-0)]">{t("settings.cloudLLM.title")}</h2>
            <p className="mt-1 text-sm text-[color:var(--text-2)]">{t("settings.cloudLLM.desc")}</p>
          </div>
          <span className="mt-0.5 shrink-0 rounded-full bg-[color:var(--bg-2)] px-3 py-1 text-xs font-medium text-[color:var(--text-2)]">
            {t("settings.cloudLLM.optional")}
          </span>
        </div>

        {/* Provider tabs */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[color:var(--text-2)]">
            {t("settings.cloudLLM.provider")}
          </p>
          <div className="flex gap-2 flex-wrap">
            {CLOUD_PROVIDERS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p.id)}
                className={clsx(
                  "rounded-md border px-4 py-1.5 text-sm font-medium transition-colors",
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

        {/* Form fields */}
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {/* Model */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[color:var(--text-1)]">{t("settings.cloudLLM.model")}</span>
            <div className="flex gap-1">
              {models.length > 0 ? (
                <div className="relative flex-1">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full appearance-none rounded-md border border-[color:var(--border)] bg-[color:var(--bg-0)] px-3 py-2 pr-8 text-sm text-[color:var(--text-0)]"
                  >
                    {!models.some((m) => m.id === model) && model && (
                      <option value={model}>{model}</option>
                    )}
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>{m.name || m.id}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--text-2)]" />
                </div>
              ) : (
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={currentProvider.modelPlaceholder}
                  className="flex-1 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-0)] px-3 py-2 text-sm text-[color:var(--text-0)]"
                />
              )}
              {currentProvider.id !== "anthropic" && (
                <button
                  onClick={() => void handleLoadModels()}
                  disabled={busy !== "idle"}
                  title={t("settings.cloudLLM.loadModels")}
                  className="shrink-0 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-0)] px-2.5 py-2 text-[color:var(--text-1)] transition-colors hover:border-[color:var(--border-active)] disabled:opacity-60"
                >
                  {busy === "loading_models" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Endpoint */}
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-[color:var(--text-1)]">{t("settings.cloudLLM.endpoint")}</span>
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://..."
              className="rounded-md border border-[color:var(--border)] bg-[color:var(--bg-0)] px-3 py-2 text-sm text-[color:var(--text-0)]"
            />
          </label>

          {/* API Key */}
          <label className="md:col-span-2 flex flex-col gap-2">
            <span className="text-sm font-medium text-[color:var(--text-1)]">{t("settings.cloudLLM.apiKey")}</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={currentProvider.requiresKey ? t("settings.cloudLLM.apiKeyPlaceholder") : "Optional"}
              className="rounded-md border border-[color:var(--border)] bg-[color:var(--bg-0)] px-3 py-2 text-sm text-[color:var(--text-0)]"
            />
          </label>
        </div>

        {/* Enable toggle */}
        <button
          onClick={() => setEnabled((v) => !v)}
          className={clsx(
            "mt-4 flex w-full items-center justify-between rounded-md border p-4 text-left transition-colors",
            enabled
              ? "border-[color:var(--accent)] bg-[color:var(--accent-muted)]"
              : "border-[color:var(--border)] bg-[color:var(--bg-0)] hover:border-[color:var(--border-active)]",
          )}
        >
          <div>
            <span className="font-medium text-[color:var(--text-0)]">{t("settings.cloudLLM.enable")}</span>
            <p className="mt-1 text-sm text-[color:var(--text-2)]">{t("settings.cloudLLM.heuristicFallback")}</p>
          </div>
          <span className={clsx("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", enabled ? "bg-[color:var(--accent)]" : "bg-[color:var(--bg-3)]")}>
            <span className={clsx("inline-block h-4 w-4 rounded-full bg-white transition-transform", enabled ? "translate-x-6" : "translate-x-1")} />
          </span>
        </button>
      </section>

      {/* Status message */}
      {statusMsg && (
        <div className={clsx("rounded-md px-4 py-3 text-sm", statusMsg.ok ? "bg-green-500/5 text-green-600" : "bg-red-500/5 text-red-500")}>
          {statusMsg.text}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => void handleSave()}
          disabled={busy !== "idle"}
          className="inline-flex items-center gap-2 rounded-md bg-[color:var(--accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy === "saving" ? t("settings.cloudLLM.saving") : t("settings.cloudLLM.save")}
        </button>
        <button
          onClick={() => void handleTest()}
          disabled={busy !== "idle" || !model}
          className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--bg-0)] px-4 py-2 text-sm font-medium text-[color:var(--text-1)] disabled:opacity-60"
        >
          {busy === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {busy === "testing" ? t("settings.cloudLLM.testing") : t("settings.cloudLLM.test")}
        </button>
        {busy === "idle" && statusMsg?.ok && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            {t("settings.cloudLLM.connectionOk")}
          </span>
        )}
        {busy === "idle" && statusMsg && !statusMsg.ok && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            {t("settings.cloudLLM.connectionFailed")}
          </span>
        )}
      </div>
    </div>
  );
}
