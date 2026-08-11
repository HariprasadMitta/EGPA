"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";

interface HelpMessage {
  role: "user" | "assistant";
  content: string;
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Signed-in-only floating help widget - a real Gateway-backed chat
// (src/app/api/help-chat) grounded in src/lib/guideContent.ts, not a
// scripted FAQ. Stateless: history lives only in this component's state,
// nothing persisted server-side, so refreshing the page starts fresh.
export function HelpChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<HelpMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) return null;

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);
    const nextMessages: HelpMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setSending(true);
    try {
      const res = await fetch("/api/help-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history: messages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Help Assistant is unavailable right now.");
      setMessages([...nextMessages, { role: "assistant", content: data.reply }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-40">
      {open && (
        <div className="mb-3 flex h-[26rem] w-80 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xl">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--brand)] px-4 py-3 text-white">
            <span className="text-sm font-semibold">Help Assistant</span>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white" aria-label="Close help chat">
              <CloseIcon />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {messages.length === 0 && (
              <p className="text-xs text-[var(--muted)]">
                Ask how any page or governance concept in EGPA works - real answers grounded in this
                platform, nothing scripted.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                <span
                  className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-left ${
                    m.role === "user"
                      ? "bg-[var(--brand)] text-white"
                      : "bg-[var(--background)] text-[var(--foreground)]"
                  }`}
                >
                  {m.content}
                </span>
              </div>
            ))}
            {sending && <p className="text-xs text-[var(--muted)]">Thinking&hellip;</p>}
            {error && <p className="break-words text-xs text-[var(--tier-critical)]">{error}</p>}
          </div>
          <div className="flex gap-2 border-t border-[var(--border)] p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
              placeholder="Ask a question..."
              disabled={sending}
              className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
            />
            <button
              onClick={send}
              disabled={sending || !input.trim()}
              className="rounded-md bg-[var(--brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-lg transition-transform hover:scale-105"
        aria-label={open ? "Close help chat" : "Open help chat"}
      >
        {open ? <CloseIcon /> : <ChatIcon />}
      </button>
    </div>
  );
}
