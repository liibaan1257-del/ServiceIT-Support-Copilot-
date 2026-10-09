/** Admin sections, in sidebar order. `part` = build step that delivers the page. */
export const ADMIN_NAV = [
  { href: "/admin/chat", label: "Chat", part: 4 },
  { href: "/admin/metrics", label: "Metrics", part: 1 },
  { href: "/admin/users", label: "Users", part: 3 },
  { href: "/admin/rate-limits", label: "Rate Limits", part: 5 },
  { href: "/admin/audit-log", label: "Audit Log", part: 5 },
  { href: "/admin/security", label: "Security", part: 5 },
  { href: "/admin/settings", label: "Settings", part: 5 },
] as const;
