import { NavLink } from "react-router-dom";
import {
  FolderTree,
  Network,
  FlaskConical,
  Shield,
  Brain,
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
    <aside className="flex w-[220px] flex-col border-r border-[var(--border)] bg-[color:var(--bg-0)] px-3 py-3">
      <div className="mb-4 flex items-center gap-2 px-1 py-1">
        <Brain className="h-4.5 w-4.5 text-[color:var(--text-1)]" />
        <div>
          <p className="text-sm font-semibold text-[color:var(--text-0)]">AI Context OS</p>
          <p className="text-[11px] text-[color:var(--text-2)]">Workspace</p>
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
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-[color:var(--bg-3)] text-[color:var(--text-0)]"
                  : "text-[color:var(--text-1)] hover:bg-[color:var(--bg-2)] hover:text-[color:var(--text-0)]",
              )
            }
            title={item.label}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
