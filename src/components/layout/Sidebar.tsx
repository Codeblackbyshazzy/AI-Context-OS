import { NavLink } from "react-router-dom";
import {
  FolderTree,
  Network,
  FlaskConical,
  Shield,
  Brain,
  Sparkles,
} from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { to: "/", icon: FolderTree, label: "Explorer" },
  { to: "/graph", icon: Network, label: "Graph" },
  { to: "/simulation", icon: FlaskConical, label: "Simulation" },
  { to: "/governance", icon: Shield, label: "Governance" },
];

export function Sidebar() {
  return (
    <aside className="flex w-58 flex-col border-r border-[var(--border)] bg-[color:var(--bg-0)]/70 p-3">
      <div className="mb-4 rounded-xl border border-[var(--border)] bg-[color:var(--bg-2)]/55 p-2.5">
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-400/40 bg-sky-500/20">
            <Brain className="h-4 w-4 text-sky-200" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[color:var(--text-0)]">
              AI Context OS
            </p>
            <p className="text-[11px] text-[color:var(--text-2)]">
              Workspace Studio
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[color:var(--bg-1)]/80 px-2 py-1 text-[11px] text-[color:var(--text-1)]">
          <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
          Modo editor enfocado
        </div>
      </div>

      <div className="space-y-1.5">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            clsx(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-sky-500/40 bg-sky-500/15 text-sky-100"
                : "border-transparent text-[color:var(--text-1)] hover:border-[var(--border)] hover:bg-[color:var(--bg-2)]/60 hover:text-[color:var(--text-0)]",
            )
          }
          title={item.label}
        >
          <item.icon className="h-4.5 w-4.5" />
          <span>{item.label}</span>
        </NavLink>
      ))}
      </div>
    </aside>
  );
}
