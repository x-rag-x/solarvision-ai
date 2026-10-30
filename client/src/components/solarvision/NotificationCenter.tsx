import React, { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, Check, CheckCheck, ChevronRight, Database, ScanLine, ShieldAlert, X } from "lucide-react";
import { useLocation } from "wouter";
import type { NotificationEvent, NotificationTone } from "./notification-model";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  tone: NotificationTone;
  timestamp: number;
  href?: string;
  read?: boolean;
};

const toneStyles: Record<NotificationTone, { icon: React.ComponentType<{ className?: string }>; iconClass: string; dot: string }> = {
  success: { icon: Check, iconClass: "bg-success-tint text-success", dot: "bg-success" },
  info: { icon: Database, iconClass: "bg-info-tint text-info", dot: "bg-info" },
  warning: { icon: ShieldAlert, iconClass: "bg-warning-tint text-warning", dot: "bg-warning" },
};

function relativeTime(timestamp: number) {
  const diffSec = Math.max(1, Math.round((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const minutes = Math.round(diffSec / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

export default function NotificationCenter() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  // Zero-fabrication: start empty, populated only by real runtime events!
  const [items, setItems] = useState<NotificationItem[]>([]);
  const unread = useMemo(() => items.filter(item => !item.read).length, [items]);

  // Listen to custom system notification events
  useEffect(() => {
    const onNotification = (event: Event) => {
      const detail = (event as CustomEvent<NotificationEvent>).detail;
      if (!detail?.title || !detail?.message) return;
      setItems(current => [
        {
          ...detail,
          id: detail.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
          read: false,
        },
        ...current,
      ].slice(0, 15));
    };

    window.addEventListener("solarvision:notification", onNotification);
    return () => window.removeEventListener("solarvision:notification", onNotification);
  }, []);

  const markAllRead = () => setItems(current => current.map(item => ({ ...item, read: true })));
  const clearAll = () => setItems([]);
  const openItem = (item: NotificationItem) => {
    setItems(current => current.map(c => (c.id === item.id ? { ...c, read: true } : c)));
    setOpen(false);
    if (item.href) setLocation(item.href);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(val => !val)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-xl border border-border bg-surface text-text-2 transition-all hover:border-brand hover:text-text hover:bg-surface-subtle active:scale-95"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-xs font-bold text-brand ring-2 ring-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <section
            className="absolute right-0 top-11 z-50 w-[min(380px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-100"
            aria-label="Operations notification inbox"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-surface-subtle">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-text-3">Operations Inbox</p>
                <h2 className="text-sm font-semibold text-text">Activity & System Events</h2>
              </div>
              <div className="flex items-center gap-1">
                {items.length > 0 && (
                  <button
                    onClick={markAllRead}
                    className="rounded-lg p-1.5 text-text-3 transition-colors hover:bg-surface hover:text-text"
                    title="Mark all as read"
                    aria-label="Mark all notifications as read"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-text-3 transition-colors hover:bg-surface hover:text-text"
                  aria-label="Close notifications"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2">
              {items.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <div className="grid h-10 w-10 mx-auto place-items-center rounded-xl bg-surface-subtle text-text-3 mb-2">
                    <Bell className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold text-text">No active alerts</p>
                  <p className="mt-1 text-xs text-text-3">
                    Real-time inspection runs and telemetry notices will appear here automatically.
                  </p>
                </div>
              ) : (
                items.map(item => {
                  const style = toneStyles[item.tone] || toneStyles.info;
                  const Icon = style.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => openItem(item)}
                      className={`group flex w-full gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface-subtle ${
                        item.read ? "opacity-60" : ""
                      }`}
                    >
                      <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${style.iconClass}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-xs font-semibold text-text">{item.title}</span>
                          {!item.read && <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-text-2">{item.message}</span>
                        <span className="mt-1 block font-mono text-xs text-text-3">{relativeTime(item.timestamp)}</span>
                      </span>
                      <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-text-3 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  );
                })
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-border px-4 py-2.5 bg-surface-subtle flex justify-between items-center">
                <button
                  onClick={clearAll}
                  className="text-xs font-medium text-text-3 hover:text-text transition-colors"
                >
                  Clear notifications
                </button>
                <span className="text-xs font-mono text-text-3">
                  {items.length} {items.length === 1 ? "item" : "items"}
                </span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
