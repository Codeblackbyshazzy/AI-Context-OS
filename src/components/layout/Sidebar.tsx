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
    <aside className="flex w-14 flex-col items-center border-r border-zinc-800 bg-zinc-950 py-3 gap-1">
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
        <Brain className="h-4 w-4 text-white" />
      </div>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            clsx(
              "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
              isActive
                ? "bg-zinc-800 text-violet-400"
                : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300",
            )
          }
          title={item.label}
        >
          <item.icon className="h-5 w-5" />
        </NavLink>
      ))}
    </aside>
  );
}
