'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Bot,
  Play,
  MessageSquare,
  ShieldCheck,
  Brain,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard",             icon: LayoutDashboard, label: "Overview"   },
  { href: "/dashboard/agents",      icon: Bot,             label: "Agents"     },
  { href: "/dashboard/runs",        icon: Play,            label: "Runs"       },
  { href: "/dashboard/threads",     icon: MessageSquare,   label: "Threads"    },
  { href: "/dashboard/approvals",   icon: ShieldCheck,     label: "Approvals"  },
  { href: "/dashboard/memory",      icon: Brain,           label: "Memory"     },
  { href: "/dashboard/settings",    icon: Settings,        label: "Settings"   },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#c8d1c0]">
      {/* Sidebar — charcoal */}
      <nav
        className={cn(
          "group flex flex-col shrink-0 h-full z-20",
          "w-12 hover:w-[220px] transition-[width] duration-200 ease-in-out overflow-hidden",
          "bg-[#3a3a3a] border-r border-white/10"
        )}
      >
        {/* Brand mark */}
        <div className="flex items-center h-12 px-[10px] shrink-0">
          <div
            className={cn(
              "flex items-center justify-center w-7 h-7 shrink-0",
              "rounded-sm border border-[#e07b5a]/50 bg-[#e07b5a]/15",
              "text-[#e07b5a] font-mono font-bold text-sm leading-none",
            )}
          >
            C
          </div>
          <span className="ml-3 text-sm font-semibold tracking-wide text-[#e8e4df] opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
            Cadet
          </span>
        </div>

        {/* Nav items */}
        <ul className="flex flex-col gap-0.5 px-1.5 mt-1 flex-1 min-w-0">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href)

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 h-9 px-[8px] rounded-md",
                    "text-white/50 hover:text-[#e8e4df]",
                    "hover:bg-white/5 transition-colors duration-100",
                    isActive && [
                      "text-[#e07b5a] border-l-2 border-[#e07b5a]",
                      "bg-[rgba(224,123,90,0.1)] hover:bg-[rgba(224,123,90,0.15)]",
                    ]
                  )}
                >
                  <Icon
                    size={16}
                    className={cn(
                      "shrink-0",
                      isActive ? "text-[#e07b5a]" : "text-white/50"
                    )}
                  />
                  <span className="text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Sidebar footer */}
        <div className="px-[10px] py-3 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 shrink-0 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-mono text-white/50">
              OP
            </div>
            <span className="text-xs text-white/40 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 truncate">
              Operator
            </span>
          </div>
        </div>
      </nav>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center h-12 px-5 shrink-0 border-b border-black/10 bg-[#bec8b6]">
          {/* Breadcrumb area */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-[#1a1a1a]/55 font-mono truncate">
              {buildBreadcrumb(pathname)}
            </span>
          </div>

          {/* Live indicator */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e07b5a] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#e07b5a]" />
            </span>
            <span className="text-[11px] text-[#1a1a1a]/55 font-mono uppercase tracking-wider">LIVE.REC</span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>
    </div>
  )
}

function buildBreadcrumb(pathname: string): string {
  const segments = pathname.replace(/^\/dashboard\/?/, "").split("/").filter(Boolean)
  if (segments.length === 0) return "Dashboard"
  return ["Dashboard", ...segments.map(capitalize)].join(" › ")
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
