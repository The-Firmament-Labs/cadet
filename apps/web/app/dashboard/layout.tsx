'use client'

import { useMemo, useState } from "react"
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
  Container,
  Code2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChatPanel } from "@/components/chat-panel"
import { CommandPalette } from "@/components/command-palette"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"

const navItems = [
  { href: "/dashboard",             icon: LayoutDashboard, label: "Overview"   },
  { href: "/dashboard/agents",      icon: Bot,             label: "Agents"     },
  { href: "/dashboard/runs",        icon: Play,            label: "Runs"       },
  { href: "/dashboard/sandboxes",   icon: Container,       label: "Sandboxes"  },
  { href: "/dashboard/threads",     icon: MessageSquare,   label: "Threads"    },
  { href: "/dashboard/approvals",   icon: ShieldCheck,     label: "Approvals"  },
  { href: "/dashboard/memory",      icon: Brain,           label: "Memory"     },
  { href: "/dashboard/api",         icon: Code2,           label: "API"        },
  { href: "/dashboard/settings",    icon: Settings,        label: "Settings"   },
]

function useOperatorIdentity(): { initials: string; name: string } {
  return useMemo(() => {
    try {
      const match = document.cookie.match(/cadet_session=([^;]+)/);
      if (!match?.[1]) return { initials: "OP", name: "Operator" };
      const payload = match[1].includes(".") ? match[1].split(".")[0]! : match[1];
      const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
      const name = json.displayName || json.email?.split("@")[0] || "Operator";
      const initials = name.slice(0, 2).toUpperCase();
      return { initials, name };
    } catch {
      return { initials: "OP", name: "Operator" };
    }
  }, []);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { initials, name } = useOperatorIdentity()
  const [chatOpen, setChatOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden" style={{ background: "#c8d1c0", backgroundImage: "radial-gradient(circle, rgba(28,27,27,0.06) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
      {/* Sidebar — matches Dioxus desktop: dark, always readable */}
      <nav
        className={cn(
          "flex flex-col shrink-0 h-full z-20 transition-[width] duration-200 ease-in-out overflow-hidden",
          sidebarCollapsed ? "w-[48px]" : "w-[200px]",
        )}
        style={{ background: "#1C1B1B" }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-2 h-12 shrink-0">
          <div
            className="w-10 h-10 shrink-0 flex items-center justify-center text-white font-bold text-[15px] tracking-wide cursor-pointer hover:opacity-80 transition-opacity"
            style={{ background: "#AA3618" }}
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? <PanelLeft size={16} /> : "C"}
          </div>
          {!sidebarCollapsed && (
            <span className="text-sm font-semibold tracking-wide text-white/90" style={{ fontFamily: "var(--font-sans)" }}>
              Cadet
            </span>
          )}
        </div>

        {/* Section label */}
        {!sidebarCollapsed && (
          <div className="px-4 mt-2 mb-1">
            <span className="text-[9px] font-semibold tracking-[0.10em] uppercase text-white/30" style={{ fontFamily: "var(--font-mono)" }}>
              Workspace
            </span>
          </div>
        )}

        {/* Nav items */}
        <ul className="flex flex-col gap-px flex-1 min-w-0">
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
                    "flex items-center gap-2.5 h-10 transition-colors duration-100",
                    sidebarCollapsed ? "justify-center px-0 w-[48px]" : "px-2",
                    isActive
                      ? "text-[#EF6745]"
                      : "text-white/50 hover:text-white/90 hover:bg-white/[0.06]",
                  )}
                  style={isActive ? { background: "rgba(170,54,24,0.12)", boxShadow: "inset 3px 0 0 #AA3618" } : undefined}
                >
                  <Icon size={20} className="shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="text-xs font-medium whitespace-nowrap">
                      {label}
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Sidebar footer */}
        <div className="px-2 py-3 border-t border-white/[0.08] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 shrink-0 flex items-center justify-center text-[10px] font-mono text-white/50 bg-white/[0.06] border border-white/[0.08]">
              {initials}
            </div>
            {!sidebarCollapsed && (
              <span className="text-xs text-white/40 whitespace-nowrap truncate">
                {name}
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center h-12 px-5 shrink-0 border-b" style={{ background: "#F7F5F4", borderColor: "rgba(224,191,184,0.20)" }}>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="text-[#58413C]/50 hover:text-[#58413C] mr-2"
            >
              {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <span className="text-xs text-[#58413C]/55 truncate" style={{ fontFamily: "var(--font-mono)" }}>
              {buildBreadcrumb(pathname)}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Sheet open={chatOpen} onOpenChange={setChatOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px] font-mono border-[#E0BFB8]/30">
                  <MessageSquare size={12} />
                  Chat
                  <kbd className="ml-1 px-1 py-0.5 text-[8px] text-[#58413C]/40 border border-[#E0BFB8]/20 bg-[#EAE7E6]">⌘J</kbd>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[400px] sm:w-[440px] p-0">
                <SheetTitle className="sr-only">Cadet Chat</SheetTitle>
                <ChatPanel />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#AA3618" }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#AA3618" }} />
              </span>
              <span className="text-[11px] text-[#58413C]/55 uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)" }}>LIVE.REC</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5" style={{ background: "#F7F5F4" }}>
          {children}
        </main>
      </div>

      <CommandPalette onOpenChat={() => setChatOpen(true)} />
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
