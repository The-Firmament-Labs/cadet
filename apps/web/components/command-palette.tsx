"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import {
  LayoutDashboard, Bot, Play, Container, MessageSquare,
  ShieldCheck, Brain, Settings, Rocket, Search,
} from "lucide-react"

const NAV_ITEMS = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agents", href: "/dashboard/agents", icon: Bot },
  { label: "Runs", href: "/dashboard/runs", icon: Play },
  { label: "Sandboxes", href: "/dashboard/sandboxes", icon: Container },
  { label: "Threads", href: "/dashboard/threads", icon: MessageSquare },
  { label: "Approvals", href: "/dashboard/approvals", icon: ShieldCheck },
  { label: "Memory", href: "/dashboard/memory", icon: Brain },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
]

interface CommandPaletteProps {
  onOpenChat?: () => void
  onLaunchMission?: () => void
}

export function CommandPalette({ onOpenChat, onLaunchMission }: CommandPaletteProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChat?.()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onOpenChat])

  function runAndClose(fn: () => void) {
    fn()
    setOpen(false)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-md">
        <Command
          className="rounded-lg border border-border bg-popover text-popover-foreground shadow-lg overflow-hidden"
          label="Command palette"
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search size={14} className="text-muted-foreground" />
            <Command.Input
              placeholder="Search commands..."
              className="h-10 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
          <Command.List className="max-h-[300px] overflow-y-auto p-1.5">
            <Command.Empty className="py-6 text-center text-xs text-muted-foreground">
              No results.
            </Command.Empty>

            <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              {onLaunchMission && (
                <Command.Item
                  onSelect={() => runAndClose(onLaunchMission)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <Rocket size={14} className="text-primary" />
                  Launch Mission
                  <kbd className="ml-auto text-[9px] text-muted-foreground">enter</kbd>
                </Command.Item>
              )}
              {onOpenChat && (
                <Command.Item
                  onSelect={() => runAndClose(onOpenChat)}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <MessageSquare size={14} className="text-primary" />
                  Open Chat
                  <kbd className="ml-auto text-[9px] text-muted-foreground">⌘J</kbd>
                </Command.Item>
              )}
            </Command.Group>

            <Command.Separator className="my-1 h-px bg-border" />

            <Command.Group heading="Navigate" className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5">
              {NAV_ITEMS.map((item) => (
                <Command.Item
                  key={item.href}
                  onSelect={() => runAndClose(() => router.push(item.href))}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs rounded-md cursor-pointer aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <item.icon size={14} className="text-muted-foreground" />
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
