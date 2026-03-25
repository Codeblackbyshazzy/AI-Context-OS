import { useState } from "react";
import {
  Brain,
  Code,
  Pen,
  Briefcase,
  ChevronRight,
  ChevronLeft,
  FolderOpen,
  User,
  Sparkles,
  Check,
  Loader2,
} from "lucide-react";
import { runOnboarding, type OnboardingProfile } from "../../lib/tauri";

const TOOLS = ["Claude", "Cursor", "GPT/ChatGPT", "Windsurf", "Copilot", "Gemini"];

const TEMPLATES = [
  {
    id: "developer",
    label: "Desarrollador",
    icon: Code,
    desc: "Skills de code review, debugging, arquitectura. Reglas de convenciones y stack técnico.",
  },
  {
    id: "creator",
    label: "Creador de Contenido",
    icon: Pen,
    desc: "Skills de escritura para LinkedIn, newsletters, repurposing. Reglas de marca y voz.",
  },
  {
    id: "entrepreneur",
    label: "Emprendedor",
    icon: Briefcase,
    desc: "Skills de análisis estratégico, actas de reunión, priorización. Reglas de restricciones.",
  },
  {
    id: "custom",
    label: "Personalizado",
    icon: Sparkles,
    desc: "Empieza con un workspace vacío y configúralo a tu manera.",
  },
];

interface Props {
  onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [tools, setTools] = useState<string[]>(["Claude"]);
  const [language, setLanguage] = useState("es");
  const [template, setTemplate] = useState("developer");
  const [rootDir, setRootDir] = useState("~/AI-Context-OS");

  const steps = [
    "Ubicación",
    "Perfil",
    "Template",
    "Herramientas",
    "Finalizar",
  ];

  const canNext = () => {
    if (step === 0) return rootDir.trim().length > 0;
    if (step === 1) return name.trim().length > 0 && role.trim().length > 0;
    if (step === 2) return template.length > 0;
    if (step === 3) return tools.length > 0;
    return true;
  };

  const handleFinish = async () => {
    setLoading(true);
    setError(null);
    try {
      const profile: OnboardingProfile = {
        name,
        role,
        tools,
        language,
        template,
        root_dir: rootDir !== "~/AI-Context-OS" ? rootDir : undefined,
      };
      await runOnboarding(profile);
      onComplete();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const toggleTool = (tool: string) => {
    setTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-900/80 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 px-6 py-4">
          <Brain className="h-6 w-6 text-violet-400" />
          <h1 className="text-lg font-semibold">AI Context OS — Setup</h1>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-6 pt-4">
          {steps.map((s, i) => (
            <div key={s} className="flex-1">
              <div
                className={`h-1 rounded-full transition-colors ${
                  i <= step ? "bg-violet-500" : "bg-zinc-700"
                }`}
              />
              <p
                className={`mt-1 text-[10px] ${
                  i === step ? "text-violet-400" : "text-zinc-600"
                }`}
              >
                {s}
              </p>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-[300px] px-6 py-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-medium">Ubicación del workspace</h2>
              <p className="text-sm text-zinc-400">
                El sistema creará una carpeta con 9 subdirectorios para organizar tu memoria de IA.
              </p>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-zinc-500" />
                <input
                  value={rootDir}
                  onChange={(e) => setRootDir(e.target.value)}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                  placeholder="~/AI-Context-OS"
                />
              </div>
              <p className="text-xs text-zinc-500">
                Se creará: 01-context/, 02-daily/, 03-intelligence/, 04-projects/,
                05-resources/, 06-skills/, 07-tasks/, 08-rules/, 09-scratch/
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-base font-medium">Tu perfil</h2>
              <p className="text-sm text-zinc-400">
                Esto se guardará como memoria de contexto para que tus IAs te conozcan.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Nombre</label>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-zinc-500" />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                      placeholder="Tu nombre"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Rol / Profesión</label>
                  <input
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                    placeholder="ej. Full-stack developer, Content strategist, CEO startup..."
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Idioma principal</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                    <option value="pt">Português</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-base font-medium">Elige un template</h2>
              <p className="text-sm text-zinc-400">
                Se generarán skills y reglas prediseñadas que puedes personalizar después.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map((t) => {
                  const Icon = t.icon;
                  const selected = template === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTemplate(t.id)}
                      className={`rounded-lg border p-3 text-left transition-all ${
                        selected
                          ? "border-violet-500 bg-violet-500/10"
                          : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                      }`}
                    >
                      <Icon
                        className={`mb-2 h-5 w-5 ${
                          selected ? "text-violet-400" : "text-zinc-500"
                        }`}
                      />
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="mt-1 text-[11px] leading-tight text-zinc-500">
                        {t.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-medium">Herramientas de IA</h2>
              <p className="text-sm text-zinc-400">
                Selecciona las herramientas que usas. Se generarán archivos de compatibilidad.
              </p>
              <div className="flex flex-wrap gap-2">
                {TOOLS.map((tool) => {
                  const selected = tools.includes(tool);
                  return (
                    <button
                      key={tool}
                      onClick={() => toggleTool(tool)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                        selected
                          ? "border-violet-500 bg-violet-500/20 text-violet-300"
                          : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                      }`}
                    >
                      {selected && <Check className="mr-1 inline h-3 w-3" />}
                      {tool}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h2 className="text-base font-medium">Todo listo</h2>
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Nombre:</span>
                    <span>{name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Rol:</span>
                    <span>{role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Template:</span>
                    <span className="capitalize">{template}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Herramientas:</span>
                    <span>{tools.join(", ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Ubicación:</span>
                    <span className="font-mono text-xs">{rootDir}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-zinc-400">
                Se creará tu workspace con memorias iniciales, skills y reglas del template elegido.
                El archivo <code className="text-violet-300">claude.md</code> se generará automáticamente.
              </p>
              {error && (
                <p className="rounded-lg bg-red-950/50 p-2 text-sm text-red-300">{error}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-4">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200 disabled:invisible"
          >
            <ChevronLeft className="h-4 w-4" />
            Atrás
          </button>

          {step < 4 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="flex items-center gap-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
            >
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Crear Workspace
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
