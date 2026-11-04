"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "משרות", icon: "M4 7h16M4 12h16M4 17h10" },
  { href: "/tracking", label: "מעקב", icon: "M5 4h4v16H5zM10 4h4v10h-4zM15 4h4v6h-4z" },
  { href: "/add", label: "הוספה", icon: "M12 5v14M5 12h14" },
  { href: "/companies", label: "חברות", icon: "M4 20V8l8-4 8 4v12M9 20v-6h6v6" },
  { href: "/settings", label: "הגדרות", icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3 12h2M19 12h2M12 3v2M12 19v2" },
];

const HIDDEN_ON = ["/login", "/setup", "/auth"];

export function Nav() {
  const path = usePathname();
  if (HIDDEN_ON.some((p) => path.startsWith(p))) return null;
  const active = (href: string) => (href === "/" ? path === "/" || path.startsWith("/jobs") : path.startsWith(href));

  return (
    <>
      {/* Desktop: top bar */}
      <header className="sticky top-0 z-20 hidden border-b border-border bg-surface/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-3xl items-center gap-6 px-4 py-3">
          <span className="text-lg font-bold">JobHunter</span>
          <nav className="flex gap-1">
            {ITEMS.map((i) => (
              <Link
                key={i.href}
                href={i.href}
                className={`rounded-lg px-3 py-1.5 text-sm ${active(i.href) ? "bg-accent-soft font-semibold text-accent" : "text-muted hover:bg-surface-2"}`}
              >
                {i.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Mobile: bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active(i.href) ? "font-semibold text-accent" : "text-muted"}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={i.icon} />
            </svg>
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
