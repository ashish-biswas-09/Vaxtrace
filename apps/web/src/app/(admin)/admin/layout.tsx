import { requireRole, getUserRole } from "@/lib/auth";
import { todayIso } from "@/lib/format";
import { ToastProvider } from "@/components/ui/Toast";
import { batchStatus } from "./inventory/status";
import { Sidebar } from "./_components/Sidebar";
import { Topbar } from "./_components/Topbar";
import { BreadcrumbProvider } from "./_components/Breadcrumbs";
import type { NavCounts } from "./_components/AdminNav";

const ROLE_BN: Record<string, string> = {
  admin: "অ্যাডমিন",
  worker: "স্বাস্থ্যকর্মী",
  parent: "অভিভাবক",
};

// Gates the whole /admin subtree on the JWT `user_role` claim (UX layer; RLS is the real
// boundary).
//
// The theme no longer lives here. It is on <html>, set before paint by the root layout, so
// auth, /account and the worker console follow the same choice instead of the admin subtree
// being the only dark thing in the application.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await requireRole("admin");
  const today = todayIso();

  // The seven figures the sidebar badges and the topbar bell show, in one wave. Fetched here
  // rather than per-screen so the rail and the page behind it can never quote different
  // numbers — which is exactly what happens when each screen counts for itself.
  const [
    {
      data: { user },
    },
    role,
    dueRes,
    { data: defaulters },
    zeroDoseRes,
    { data: stock },
    { data: coldChain },
    openAefiRes,
    { data: failed },
  ] = await Promise.all([
    supabase.auth.getUser(),
    getUserRole(supabase),
    supabase
      .from("schedules")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .lte("due_date", today),
    supabase.from("v_defaulters").select("child_id, has_open_task"),
    supabase.from("v_zero_dose").select("child_id", { count: "exact", head: true }),
    supabase.from("inventories").select("stock_quantity, expiry_date"),
    supabase.from("v_cold_chain").select("device_id, has_excursion, is_silent, is_active"),
    supabase
      .from("v_aefi_cases")
      .select("id", { count: "exact", head: true })
      .in("status", ["reported", "under_investigation"]),
    supabase.from("notifications").select("id").in("status", ["failed", "dead"]).limit(500),
  ]);

  const { data: myRole } = user
    ? await supabase
        .from("user_roles")
        .select("staff_code")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle()
    : { data: null };

  const counts: NavCounts = {
    due: dueRes.count ?? 0,
    // A defaulter with no open tracing task is a child nobody has been asked to visit — the
    // gap between knowing and doing.
    untraced: (defaulters ?? []).filter((d) => !d.has_open_task).length,
    zeroDose: zeroDoseRes.count ?? 0,
    stockAlerts: (stock ?? []).filter(
      (b) => batchStatus(b.stock_quantity, b.expiry_date).tone !== "success",
    ).length,
    coldChain: (coldChain ?? []).filter((d) => d.is_active && (d.has_excursion || d.is_silent))
      .length,
    openAefi: openAefiRes.count ?? 0,
    failedNotifications: (failed ?? []).length,
  };

  return (
    <BreadcrumbProvider>
      <ToastProvider>
        <a href="#main" className="sr-only skip-link">
          মূল বিষয়বস্তুতে যান
        </a>

        <div className="flex min-h-screen bg-[var(--canvas)] text-[var(--text-primary)]">
          <Sidebar
            counts={counts}
            identity={{
              code: myRole?.staff_code ?? null,
              role: role ? (ROLE_BN[role] ?? role) : "—",
            }}
          />

          {/* min-w-0 is load-bearing: without it a flex child refuses to shrink below its
              content width, so the overflow-x-auto on wide tables never engages and the page
              itself scrolls sideways instead. */}
          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              counts={counts}
              user={{
                email: user?.email ?? "",
                role,
                staffCode: myRole?.staff_code ?? null,
              }}
            />
            <main
              id="main"
              className="mx-auto w-full min-w-0 max-w-[90rem] flex-1 p-4 sm:p-6 lg:p-8"
            >
              {children}
            </main>
          </div>
        </div>
      </ToastProvider>
    </BreadcrumbProvider>
  );
}
