import { NavLink } from "react-router-dom";
import {
  FolderTree,
  Network,
  FlaskConical,
  Shield,
  Brain,
  BookOpen,
  ListTodo,
  Settings,
} from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { to: "/", icon: FolderTree, label: "Explorer" },
  { to: "/journal", icon: BookOpen, label: "Journal" },
  { to: "/tasks", icon: ListTodo, label: "Tasks" },
  { to: "/graph", icon: Network, label: "Graph" },
  { to: "/simulation", icon: FlaskConical, label: "Simulation" },
  { to: "/governance", icon: Shield, label: "Governance" },
];

export function Sidebar() {
  return (
    <aside className="flex w-12 flex-col items-center border-r border-[var(--border)] bg-[color:var(--bg-0)] py-3">
      <div className="mb-4">
        <Brain className="h-5 w-5 text-[color:var(--accent)]" />
      </div>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              clsx(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                isActive
                  ? "bg-[color:var(--accent-muted)] text-[color:var(--accent)]"
                  : "text-[color:var(--text-2)] hover:bg-[color:var(--bg-2)] hover:text-[color:var(--text-1)]",
              )
            }
            title={item.label}
          >
            <item.icon className="h-[18px] w-[18px]" />
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto mb-4 flex flex-col items-center">
        <NavLink
            to="/settings"
            className={({ isActive }) =>
              clsx(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                isActive
                  ? "bg-[color:var(--accent-muted)] text-[color:var(--accent)]"
                  : "text-[color:var(--text-2)] hover:bg-[color:var(--bg-2)] hover:text-[color:var(--text-1)]",
              )
            }
            title="Settings"
        >
          <Settings className="h-[18px] w-[18px]" />
        </NavLink>
      </div>
    </aside>
  );
}
