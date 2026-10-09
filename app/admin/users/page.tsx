import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageTitle } from "@/components/admin/page-title";
import { RoleForm } from "@/components/admin/users/role-form";
import { requireAdmin, type Role } from "@/lib/auth/session";
import {
  getRoleCounts,
  listUsers,
  PAGE_SIZE,
  parseUserFilters,
  type AdminUserRow,
  type UserFilters,
} from "@/lib/admin/users";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <>
      <PageTitle title="Users" description="Everyone with an account, and what they're allowed to do." />
      <Suspense fallback={<UsersSkeleton />}>
        <UsersView searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** Builds /admin/users?… keeping only the non-default filters. */
function usersHref({ q, role, page }: Partial<UserFilters>): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (role) params.set("role", role);
  if (page && page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/admin/users?${qs}` : "/admin/users";
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

async function UsersView({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  const me = await requireAdmin("/admin/users");
  if (!me) return null; // The layout already shows "No admin access".

  const filters = parseUserFilters(await searchParams);
  const [counts, { rows, total }] = await Promise.all([getRoleCounts(), listUsers(filters)]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total ? (filters.page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(filters.page * PAGE_SIZE, total);

  const tabs: { label: string; role: Role | null; count: number }[] = [
    { label: "All users", role: null, count: counts.total },
    { label: "Admins", role: "admin", count: counts.admins },
    { label: "Technicians", role: "technician", count: counts.technicians },
    { label: "Customers", role: "customer", count: counts.customers },
  ];

  return (
    <div className="space-y-6">
      <nav aria-label="Filter by role" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tabs.map((tab) => {
          const active = filters.role === tab.role;
          return (
            <Link
              key={tab.label}
              href={usersHref({ q: filters.q, role: tab.role })}
              aria-current={active ? "page" : undefined}
              className={`rounded-xl border p-4 transition-colors ${
                active ? "border-emerald-500/50 bg-emerald-500/10" : "border-zinc-800 bg-zinc-900/60 hover:border-zinc-700"
              }`}
            >
              <p className="text-xs font-medium tracking-wider text-zinc-500 uppercase">{tab.label}</p>
              <p className="mt-1 font-mono text-2xl font-semibold text-zinc-100">{tab.count.toLocaleString()}</p>
            </Link>
          );
        })}
      </nav>

      <form method="get" action="/admin/users" role="search" className="flex flex-wrap gap-2">
        {filters.role ? <input type="hidden" name="role" value={filters.role} /> : null}
        <label htmlFor="user-search" className="sr-only">
          Search by email or name
        </label>
        <input
          id="user-search"
          type="search"
          name="q"
          defaultValue={filters.q}
          maxLength={100}
          placeholder="Search by email or name"
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
        <button type="submit" className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800">
          Search
        </button>
        {filters.q ? (
          <Link href={usersHref({ role: filters.role })} className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200">
            Clear
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center">
          <p className="text-sm font-medium text-zinc-300">No users found</p>
          <p className="mt-1 text-sm text-zinc-500">
            {filters.q || filters.role ? "Try a different search or filter." : "New sign-ups will appear here."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-zinc-900/80 text-xs tracking-wider text-zinc-500 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">User</th>
                <th scope="col" className="px-4 py-3 font-medium">Role</th>
                <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                <th scope="col" className="px-4 py-3 font-medium">Last sign-in (UTC)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {rows.map((user) => (
                <UserRow key={user.id} user={user} isMe={user.id === me.id} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-400">
        <p>{total ? `Showing ${from}–${to} of ${total.toLocaleString()}` : "No results"}</p>
        {pages > 1 ? (
          <div className="flex gap-2">
            <PageLink href={usersHref({ ...filters, page: filters.page - 1 })} disabled={filters.page <= 1}>
              Previous
            </PageLink>
            <PageLink href={usersHref({ ...filters, page: filters.page + 1 })} disabled={filters.page >= pages}>
              Next
            </PageLink>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-zinc-500">
        Role changes take effect on the user&apos;s next page load and are recorded in the audit log. You can&apos;t
        change your own role, so there is always at least one admin.
      </p>
    </div>
  );
}

function UserRow({ user, isMe }: { user: AdminUserRow; isMe: boolean }) {
  return (
    <tr className="bg-zinc-950/40">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-zinc-100">{user.fullName || user.email || "Unknown user"}</span>
          {isMe ? (
            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-400 uppercase">You</span>
          ) : null}
          {!user.emailConfirmed ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 uppercase">
              Unconfirmed
            </span>
          ) : null}
        </div>
        {user.fullName && user.email ? <p className="truncate text-xs text-zinc-500">{user.email}</p> : null}
      </td>
      <td className="px-4 py-3">
        {isMe ? (
          <span className="text-sm text-zinc-400 capitalize">{user.role}</span>
        ) : (
          <RoleForm userId={user.id} role={user.role} email={user.email} />
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-zinc-400">{dateFormat.format(new Date(user.createdAt))}</td>
      <td className="px-4 py-3 whitespace-nowrap text-zinc-400">
        {user.lastSignInAt ? dateTimeFormat.format(new Date(user.lastSignInAt)) : "Never"}
      </td>
    </tr>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: string }) {
  if (disabled) {
    return <span className="rounded-lg border border-zinc-800 px-3 py-1.5 text-zinc-600">{children}</span>;
  }
  return (
    <Link href={href} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-zinc-200 hover:bg-zinc-800">
      {children}
    </Link>
  );
}

function UsersSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading users">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/60" />
        ))}
      </div>
      <div className="h-10 animate-pulse rounded-lg bg-zinc-900/60" />
      <div className="h-64 animate-pulse rounded-xl border border-zinc-800 bg-zinc-900/60" />
    </div>
  );
}
