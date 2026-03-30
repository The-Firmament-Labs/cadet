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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { HexagonLogo } from "@/components/hexagon-logo"
import { ChatPanel } from "@/components/chat-panel"
import { CommandPalette } from "@/components/command-palette"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"

const navItems = [
  { href: "/dashboard",             icon: LayoutDashboard, label: "Overview"   },
  { href: "/dashboard/agents",      icon: Bot,             label: "Agents"     },
  { href: "/dashboard/runs",        icon: Play,            label: "Runs"       },
  { href: "/dashboard/sandboxes",   icon: Container,       label: "Sandboxes"  },
  { href: "/dashboard/threads",     icon: MessageSquare,   label: "Threads"    },
  { href: "/dashboard/approvals",   icon: ShieldCheck,     label: "Approvals"  },
  { href: "/dashboard/memory",      icon: Brain,           label: "Memory"     },
  { href: "/dashboard/settings",    icon: Settings,        label: "Settings"   },
]

function useOperatorIdentity(): { initials: string; name: string } {
  return useMemo(() => {
    try {
      const match = document.cookie.match(/cadet_session=([^;]+)/);
      if (!match?.[1]) return { initials: "OP", name: "Operator" };
      // Session may be HMAC-signed (payload.signature) or plain base64url
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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <nav
        className={cn(
          "group flex flex-col shrink-0 h-full z-20",
          "w-12 hover:w-[220px] transition-[width] duration-200 ease-in-out overflow-hidden",
          "bg-sidebar border-r border-sidebar-border"
        )}
      >
        {/* Brand mark */}
        <div className="flex items-center h-12 px-[10px] shrink-0">
          <HexagonLogo className="w-7 h-7 shrink-0 text-sidebar-foreground" />
          <span className="ml-3 text-sm font-semibold tracking-wide text-sidebar-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
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
                    "text-sidebar-foreground/50 hover:text-sidebar-foreground",
                    "hover:bg-sidebar-accent/30 transition-colors duration-100",
                    isActive && [
                      "text-sidebar-primary border-l-2 border-sidebar-primary",
                      "bg-sidebar-primary/10 hover:bg-sidebar-primary/15",
                    ]
                  )}
                >
                  <Icon
                    size={16}
                    className={cn(
                      "shrink-0",
                      isActive ? "text-sidebar-primary" : "text-sidebar-foreground/50"
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
        <div className="px-[10px] py-3 border-t border-sidebar-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 shrink-0 rounded-sm bg-sidebar-accent/30 border border-sidebar-border flex items-center justify-center text-[10px] font-mono text-sidebar-foreground/50">
              {initials}
            </div>
            <span className="text-xs text-sidebar-foreground/40 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 truncate">
              {name}
            </span>
          </div>
        </div>
      </nav>

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center h-12 px-5 shrink-0 border-b border-border bg-muted">
          {/* Breadcrumb area */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xs text-foreground/55 font-mono truncate">
              {buildBreadcrumb(pathname)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <Sheet open={chatOpen} onOpenChange={setChatOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[10px] font-mono">
                  <MessageSquare size={12} />
                  Chat
                  <kbd className="ml-1 px-1 py-0.5 rounded bg-muted text-[8px] text-muted-foreground border border-border">⌘J</kbd>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[400px] sm:w-[440px] p-0">
                <SheetTitle className="sr-only">Cadet Chat</SheetTitle>
                <ChatPanel />
              </SheetContent>
            </Sheet>
            <ThemeToggle />
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              <span className="text-[11px] text-foreground/55 font-mono uppercase tracking-wider">LIVE.REC</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5">
          {children}
        </main>
      </div>

      {/* Command palette (Cmd+K) */}
      <CommandPalette
        onOpenChat={() => setChatOpen(true)}
      />
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
