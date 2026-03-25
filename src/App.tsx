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
    <div className="h-screen overflow-hidden bg-[color:var(--bg-0)] text-[color:var(--text-0)]">
      <div className="obs-app-shell flex h-full overflow-hidden">
        <Sidebar />
        <main className="relative flex-1 overflow-hidden">
          <div className="h-full overflow-hidden bg-[color:var(--bg-1)]">
            <Routes>
              <Route path="/" element={<ExplorerView />} />
              <Route path="/graph" element={<GraphViewPage />} />
              <Route path="/simulation" element={<SimulationView />} />
              <Route path="/governance" element={<GovernanceView />} />
            </Routes>
          </div>
          {error && (
            <div className="absolute bottom-4 right-4 max-w-md rounded-lg border border-red-600/40 bg-[#381f24] px-3 py-2.5">
              <div className="flex items-start gap-3">
                <p className="flex-1 text-sm text-red-100/95">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-red-300 transition-colors hover:text-red-100"
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
