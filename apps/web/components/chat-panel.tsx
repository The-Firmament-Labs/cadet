"use client"

import { useRef, useEffect, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import type { UIMessage } from "ai"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Loader2, Bot, User, Bell } from "lucide-react"

const transport = new DefaultChatTransport({ api: "/api/chat" })

export function ChatPanel() {
  const { messages, sendMessage, status, error } = useChat({ transport })

  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isStreaming = status === "streaming" || status === "submitted"

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, status])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  // Request notification permission on first interaction
  function requestNotifications() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission()
    }
  }

  // Notify when assistant responds and tab is hidden
  useEffect(() => {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      document.hidden &&
      messages.length > 0 &&
      messages[messages.length - 1]?.role === "assistant" &&
      status === "ready"
    ) {
      new Notification("Cadet", {
        body: "Agent responded to your message",
        icon: "/visuals/retro-astro.png",
      })
    }
  }, [messages, status])

  function handleSend() {
    const text = input.trim()
    if (!text) return
    requestNotifications()
    sendMessage({ text })
    setInput("")
  }

  function renderPart(part: UIMessage["parts"][number], i: number) {
    if (part.type === "text") {
      return <p key={i} className="whitespace-pre-wrap">{part.text}</p>
    }
    // Tool parts in v6 use type "tool-<toolName>"
    if (part.type.startsWith("tool-")) {
      const p = part as Record<string, unknown>
      const toolName = part.type.replace("tool-", "")
      const hasResult = p.state === "result" || p.result !== undefined
      return (
        <div key={i} className="my-1 px-2 py-1.5 rounded bg-background/50 border border-border text-[10px] font-mono">
          <span className="text-primary">{toolName}</span>
          {hasResult ? (
            <span className="text-muted-foreground ml-1">
              {typeof p.result === "object" && p.result !== null && "message" in (p.result as Record<string, unknown>)
                ? String((p.result as Record<string, unknown>).message)
                : " done"}
            </span>
          ) : (
            <span className="text-muted-foreground ml-1 animate-pulse">running...</span>
          )}
        </div>
      )
    }
    return null
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea ref={scrollRef} className="flex-1 px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <Bot size={28} className="opacity-30" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">Cadet</p>
              <p className="text-xs opacity-60">Your personal AI assistant. Ask anything.</p>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2 max-w-[280px] justify-center">
              {["Deploy latest changes", "Fix the login bug", "Summarize today's PRs", "Set a reminder"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); textareaRef.current?.focus() }}
                  className="px-2 py-1 text-[10px] border border-border rounded-md hover:bg-muted transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg: UIMessage) => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 shrink-0 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Bot size={12} className="text-primary" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}>
                  {msg.parts.map(renderPart)}
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 shrink-0 rounded-sm bg-foreground/10 border border-border flex items-center justify-center">
                    <User size={12} className="text-foreground/50" />
                  </div>
                )}
              </div>
            ))}
            {isStreaming && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-2">
                <div className="w-6 h-6 shrink-0 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Bot size={12} className="text-primary" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 size={14} className="animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {error && (
        <div className="mx-4 mb-2 flex items-center gap-2 text-[10px] text-destructive">
          <span className="truncate">{error.message}</span>
        </div>
      )}

      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Cadet anything... (Cmd+Enter to send)"
            rows={2}
            className="text-xs resize-none flex-1"
            disabled={isStreaming}
          />
          <Button
            type="button"
            size="sm"
            disabled={isStreaming || !input.trim()}
            onClick={handleSend}
            className="self-end h-8 w-8 p-0"
          >
            {isStreaming ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          </Button>
        </div>
      </div>
    </div>
  )
}
