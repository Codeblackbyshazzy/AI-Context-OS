// Nota: en una iteración posterior, mover tipos y lista de conectores a src/lib/connectors.ts
import { useEffect, useState } from "react";
import { Copy, FileText } from "lucide-react";
import { clsx } from "clsx";
import { getMcpConnectionInfo, simulateContext } from "../lib/tauri";
import type { McpConnectionInfo } from "../lib/types";

type IntegrationTier = "Local Native" | "Bridge" | "Remote";

interface ConnectorDef {
  id: string;
  name: string;
  tier: IntegrationTier;
  description: string;
  icon: string;
}

const CONNECTORS: ConnectorDef[] = [
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    tier: "Local Native",
    description: "Acceso directo vía MCP stdio. Contexto completo del workspace.",
    icon: "C",
  },
  {
    id: "cursor",
    name: "Cursor",
    tier: "Local Native",
    description: "Reglas de código y contexto vía .cursorrules y MCP HTTP.",
    icon: "↗",
  },
  {
    id: "windsurf",
    name: "Windsurf",
    tier: "Local Native",
    description: "Reglas de código y contexto vía .windsurfrules.",
    icon: "W",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    tier: "Bridge",
    description: "Transferencia guiada del estado de trabajo. Sin acceso directo al workspace.",
    icon: "G",
  },
  {
    id: "gemini",
    name: "Gemini Web",
    tier: "Bridge",
    description: "Transferencia guiada del estado de trabajo. Sin acceso directo al workspace.",
    icon: "♊",
  },
];

const TIER_COLORS: Record<IntegrationTier, { bg: string; text: string; label: string }> = {
  "Local Native": { bg: "#10b98122", text: "#10b981", label: "Local Native" },
  "Bridge":       { bg: "#f59e0b22", text: "#f59e0b", label: "Bridge" },
  "Remote":       { bg: "#6366f122", text: "#6366f1", label: "Remote" },
};

export function ConnectorsView() {
  const [info, setInfo] = useState<McpConnectionInfo | null>(null);
  const [activeConnector, setActiveConnector] = useState<string>("claude-desktop");
  const [bridgeStatus, setBridgeStatus] = useState<"idle" | "loading" | "done">("idle");
  const [bridgeText, setBridgeText] = useState<string>("");

  useEffect(() => {
    getMcpConnectionInfo().then(setInfo).catch(console.error);
  }, []);

  const active = CONNECTORS.find((c) => c.id === activeConnector);

  return (
    <div className="view-container h-full overflow-y-auto" style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: "var(--text-0)" }}>
        Conectores
      </h1>
      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 20 }}>
        Integra AI Context OS con tus herramientas de IA.
      </p>

      <div style={{ display: "flex", gap: 16 }}>
        {/* Connector list */}
        <div style={{ width: 200, flexShrink: 0 }}>
          {CONNECTORS.map((c) => {
            const tier = TIER_COLORS[c.tier];
            return (
              <button
                key={c.id}
                onClick={() => setActiveConnector(c.id)}
                className={clsx(
                  "w-full text-left rounded-lg border px-3 py-2.5 mb-1.5 transition-colors",
                  activeConnector === c.id
                    ? "border-[color:var(--accent)] bg-[color:var(--accent-muted)]"
                    : "border-[var(--border)] bg-[color:var(--bg-1)] hover:border-[var(--border-active)]"
                )}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      background: "var(--bg-2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-1)",
                      flexShrink: 0,
                    }}
                  >
                    {c.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-0)" }}>{c.name}</div>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: tier.text,
                        marginTop: 1,
                      }}
                    >
                      {tier.label}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {active && (
            <ConnectorDetail
              connector={active}
              info={info}
              bridgeStatus={bridgeStatus}
              bridgeText={bridgeText}
              onBridgeAction={async (action) => {
                if (action === "copy") {
                  setBridgeStatus("loading");
                  try {
                    const memories = await simulateContext("contexto general del proyecto", 4000);
                    const text = memories
                      .map((m) => `## ${m.memory_id}\n${m.l0}`)
                      .join("\n\n");
                    await navigator.clipboard.writeText(text);
                    setBridgeText(text);
                    setBridgeStatus("done");
                  } catch {
                    setBridgeStatus("idle");
                  }
                } else if (action === "handoff") {
                  setBridgeStatus("loading");
                  try {
                    const memories = await simulateContext("contexto general del proyecto", 6000);
                    const lines = [
                      "# Handoff — AI Context OS",
                      "",
                      `Generado: ${new Date().toLocaleString()}`,
                      "",
                      "## Contexto activo",
                      "",
                      ...memories.map((m) => `### ${m.memory_id}\n${m.l0}`),
                    ];
                    const text = lines.join("\n");
                    await navigator.clipboard.writeText(text);
                    setBridgeText(text);
                    setBridgeStatus("done");
                  } catch {
                    setBridgeStatus("idle");
                  }
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Connector detail ─────────────────────────────────────────────────────────

interface DetailProps {
  connector: ConnectorDef;
  info: McpConnectionInfo | null;
  bridgeStatus: "idle" | "loading" | "done";
  bridgeText: string;
  onBridgeAction: (action: "copy" | "handoff") => void;
}

function ConnectorDetail({ connector, info, bridgeStatus, bridgeText, onBridgeAction }: DetailProps) {
  const tier = TIER_COLORS[connector.tier];

  return (
    <div className="card" style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "var(--bg-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-1)",
          }}
        >
          {connector.icon}
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-0)" }}>{connector.name}</div>
          <div
            style={{
              display: "inline-block",
              padding: "2px 8px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 600,
              background: tier.bg,
              color: tier.text,
            }}
          >
            {connector.tier}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 20 }}>{connector.description}</p>

      {connector.tier === "Local Native" && info && (
        <LocalNativePanel connector={connector} info={info} />
      )}

      {connector.tier === "Bridge" && (
        <BridgePanel
          status={bridgeStatus}
          resultText={bridgeText}
          onAction={onBridgeAction}
        />
      )}

      {!info && connector.tier === "Local Native" && (
        <div style={{ fontSize: 13, color: "var(--text-2)" }}>Cargando información de conexión...</div>
      )}
    </div>
  );
}

// ─── Local Native panel ───────────────────────────────────────────────────────

function LocalNativePanel({ connector, info }: { connector: ConnectorDef; info: McpConnectionInfo }) {
  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);

  if (connector.id === "claude-desktop") {
    const config = JSON.stringify(
      {
        mcpServers: {
          "ai-context-os": {
            command: info.binary_path,
            args: ["mcp-server", "--root", info.workspace_root],
          },
        },
      },
      null,
      2
    );
    return (
      <SnippetCard
        title="Configuración MCP"
        description="Agrega a claude_desktop_config.json:"
        snippet={config}
        onCopy={() => copyToClipboard(config)}
      />
    );
  }

  if (connector.id === "cursor") {
    const config = JSON.stringify(
      { mcpServers: { "ai-context-os": { url: info.http_url } } },
      null,
      2
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SnippetCard
          title="MCP HTTP"
          description="Agrega a .cursor/mcp.json:"
          snippet={config}
          onCopy={() => copyToClipboard(config)}
        />
        <div
          className="card"
          style={{ padding: 12, fontSize: 12, color: "var(--text-2)", background: "var(--bg-2)" }}
        >
          El archivo <code style={{ color: "var(--accent)" }}>.cursorrules</code> ya está
          auto-generado en la raíz de tu workspace con el contexto completo.
        </div>
      </div>
    );
  }

  if (connector.id === "windsurf") {
    return (
      <div
        className="card"
        style={{ padding: 12, fontSize: 12, color: "var(--text-2)", background: "var(--bg-2)" }}
      >
        El archivo <code style={{ color: "var(--accent)" }}>.windsurfrules</code> ya está
        auto-generado en la raíz de tu workspace con el contexto completo. No requiere configuración
        adicional.
      </div>
    );
  }

  return null;
}

// ─── Bridge panel ─────────────────────────────────────────────────────────────

function BridgePanel({
  status,
  resultText,
  onAction,
}: {
  status: "idle" | "loading" | "done";
  resultText: string;
  onAction: (action: "copy" | "handoff") => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          background: "#f59e0b11",
          border: "1px solid #f59e0b33",
          fontSize: 12,
          color: "var(--text-2)",
        }}
      >
        <strong style={{ color: "var(--text-1)" }}>Bridge / Handoff</strong> — Transferencia
        guiada del estado de trabajo. No hay integración nativa; el contexto se prepara para
        pegarlo manualmente en la herramienta.
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <ActionButton
          icon={<Copy size={13} />}
          label="Copiar contexto óptimo"
          loading={status === "loading"}
          onClick={() => onAction("copy")}
        />
        <ActionButton
          icon={<FileText size={13} />}
          label="Generar handoff.md"
          loading={status === "loading"}
          onClick={() => onAction("handoff")}
        />
      </div>

      {status === "done" && resultText && (
        <div>
          <div style={{ fontSize: 11, color: "var(--accent)", marginBottom: 4 }}>
            Copiado al portapapeles
          </div>
          <pre
            style={{
              padding: 10,
              background: "var(--bg-0)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 11,
              color: "var(--text-2)",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              maxHeight: 200,
              margin: 0,
            }}
          >
            {resultText.slice(0, 800)}{resultText.length > 800 ? "\n..." : ""}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SnippetCard({
  title,
  description,
  snippet,
  onCopy,
}: {
  title: string;
  description: string;
  snippet: string;
  onCopy: () => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-0)" }}>{title}</div>
          <div style={{ fontSize: 11, color: "var(--text-2)" }}>{description}</div>
        </div>
        <button
          onClick={onCopy}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            background: "var(--bg-2)",
            color: "var(--text-1)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <Copy size={12} /> Copiar
        </button>
      </div>
      <pre
        style={{
          padding: 10,
          background: "var(--bg-0)",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontSize: 11,
          color: "var(--text-1)",
          overflow: "auto",
          whiteSpace: "pre-wrap",
          wordBreak: "break-all",
          margin: 0,
        }}
      >
        {snippet}
      </pre>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 14px",
        fontSize: 12,
        fontWeight: 500,
        background: "var(--bg-2)",
        color: "var(--text-1)",
        border: "1px solid var(--border)",
        borderRadius: 6,
        cursor: loading ? "not-allowed" : "pointer",
        opacity: loading ? 0.5 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {icon}
      {loading ? "Generando..." : label}
    </button>
  );
}
