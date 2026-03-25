import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/layout/Sidebar";
import { ExplorerView } from "./views/ExplorerView";
import { GraphViewPage } from "./views/GraphViewPage";
import { SimulationView } from "./views/SimulationView";
import { GovernanceView } from "./views/GovernanceView";
import { OnboardingWizard } from "./components/onboarding/OnboardingWizard";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { useAppStore } from "./lib/store";
import { isOnboarded } from "./lib/tauri";

function AppContent() {
  useFileWatcher();
  const error = useAppStore((s) => s.error);
  const setError = useAppStore((s) => s.setError);
  const initialize = useAppStore((s) => s.initialize);

  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    isOnboarded()
      .then(setOnboarded)
      .catch(() => setOnboarded(false));
  }, []);

  if (onboarded === null) {
    return (
      <div className="flex h-screen items-center justify-center text-zinc-400">
        Cargando...
      </div>
    );
  }

  if (!onboarded) {
    return (
      <OnboardingWizard
        onComplete={() => {
          setOnboarded(true);
          initialize();
        }}
      />
    );
  }

  return (
    <div className="h-screen overflow-hidden p-3 text-zinc-100">
      <div className="obs-app-shell flex h-full overflow-hidden">
        <Sidebar />
        <main className="relative flex-1 overflow-hidden p-2">
          <div className="h-full overflow-hidden rounded-xl border border-[var(--border)] bg-[color:var(--bg-1)]/70">
            <Routes>
              <Route path="/" element={<ExplorerView />} />
              <Route path="/graph" element={<GraphViewPage />} />
              <Route path="/simulation" element={<SimulationView />} />
              <Route path="/governance" element={<GovernanceView />} />
            </Routes>
          </div>
          {error && (
            <div className="absolute bottom-5 right-5 max-w-md rounded-xl border border-red-500/30 bg-red-950/90 px-4 py-3 shadow-xl backdrop-blur">
              <div className="flex items-start gap-3">
                <p className="flex-1 text-sm text-red-100">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-red-300 transition-colors hover:text-white"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
