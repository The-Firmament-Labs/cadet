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
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)]">
      {/* Sidebar */}
      <nav
        className={cn(
          "group flex flex-col shrink-0 h-full z-20",
          "w-12 hover:w-[220px] transition-[width] duration-200 ease-in-out overflow-hidden",
          "bg-[var(--sidebar)] border-r border-border"
        )}
      >
        {/* Brand mark */}
        <div className="flex items-center h-12 px-[10px] shrink-0">
          <div
            className={cn(
              "flex items-center justify-center w-7 h-7 shrink-0",
              "rounded-sm border border-primary/40 bg-[var(--sidebar)]",
              "text-primary font-mono font-bold text-sm leading-none",
              "shadow-[0_0_8px_rgba(0,229,255,0.2)]"
            )}
          >
            C
          </div>
          <span className="ml-3 text-sm font-semibold tracking-wide text-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
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
                    "text-muted-foreground hover:text-foreground",
                    "hover:bg-[var(--sidebar-accent)] transition-colors duration-100",
                    isActive && [
                      "text-primary border-l-2 border-primary",
                      "bg-[rgba(0,229,255,0.06)] hover:bg-[rgba(0,229,255,0.10)]",
                      "shadow-[inset_0_0_8px_rgba(0,229,255,0.04)]",
                    ]
                  )}
                >
                  <Icon
                    size={16}
                    className={cn(
                      "shrink-0",
                      isActive ? "text-primary" : "text-muted-foreground"
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
        <div className="px-[10px] py-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 shrink-0 rounded-sm bg-[var(--secondary)] border border-border flex items-center justify-center text-[10px] font-mono text-muted-foreground">
              OP
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 truncate">
              Operator
            </span>
          </div>
        </div>
      </nav>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center h-12 px-5 shrink-0 border-b border-border bg-[var(--sidebar)]/60 backdrop-blur-sm">
          {/* Breadcrumb area */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-muted-foreground font-mono truncate">
              {buildBreadcrumb(pathname)}
            </span>
          </div>

          {/* Connection status */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4dff88] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4dff88]" />
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">connected</span>
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
