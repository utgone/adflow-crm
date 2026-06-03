"use client";
import NotificationsBell from "@/components/NotificationsBell";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import styles from "./layout.module.css";

export type Role =
  | "director"
  | "manager"
  | "content"
  | "ads"
  | "accountant"
  | "client";

type DashboardUser = {
  id: number;
  source: "client" | "employee";
  name: string;
  email: string;
  login: string;
  status: string;
  company_name?: string;
  phone?: string;
  position_name?: string;
};

type AuthMeResponse = {
  ok: boolean;
  message?: string;
  data?: DashboardUser & {
    role: Role;
  };
};

type DashboardContextValue = {
  role: Role;
  user: DashboardUser;
};

type NavItem = {
  href: string;
  icon: string;
  label: string;
  roles: Role[];
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const DashboardCtx = createContext<DashboardContextValue | null>(null);

export function useDashboard() {
  const ctx = useContext(DashboardCtx);

  if (!ctx) {
    throw new Error("useDashboard має використовуватися всередині кабінету");
  }

  return ctx;
}

export const roleLabels: Record<Role, string> = {
  director: "Директор",
  manager: "Акаунт-менеджер",
  content: "Спеціаліст з контенту",
  ads: "Фахівець з реклами",
  accountant: "Бухгалтер",
  client: "Клієнт",
};

const navSections: NavSection[] = [
  {
    title: "Основне",
    items: [
      {
        href: "/dashboard",
        icon: "space_dashboard",
        label: "Огляд",
        roles: ["director", "manager", "content", "ads", "accountant", "client"],
      },
    ],
  },
  {
    title: "CRM",
    items: [
      {
        href: "/dashboard/clients",
        icon: "groups",
        label: "Клієнти",
        roles: ["director", "manager"],
      },
      {
        href: "/dashboard/briefs",
        icon: "assignment",
        label: "Брифи",
        roles: ["director", "manager", "client"],
      },
      {
        href: "/dashboard/projects",
        icon: "folder_managed",
        label: "Проєкти",
        roles: ["director", "manager", "client"],
      },
      {
        href: "/dashboard/tasks",
        icon: "task_alt",
        label: "Задачі",
        roles: ["director", "manager", "content", "ads"],
      },
      {
        href: "/dashboard/materials",
        icon: "photo_library",
        label: "Матеріали",
        roles: ["director", "manager", "content", "client"],
      },
    ],
  },
  {
    title: "Маркетинг",
    items: [
      {
        href: "/dashboard/campaigns",
        icon: "campaign",
        label: "Кампанії",
        roles: ["director", "manager", "ads"],
      },
      {
        href: "/dashboard/statistics",
        icon: "query_stats",
        label: "Статистика",
        roles: ["director", "ads"],
      },
    ],
  },
  {
    title: "Фінанси",
    items: [
      {
        href: "/dashboard/invoices",
        icon: "receipt_long",
        label: "Рахунки",
        roles: ["director", "accountant", "client"],
      },
      {
        href: "/dashboard/payments",
        icon: "payments",
        label: "Оплати",
        roles: ["director", "accountant"],
      },
    ],
  },
  {
    title: "Адміністрування",
    items: [
      {
        href: "/dashboard/services",
        icon: "sell",
        label: "Послуги",
        roles: ["director"],
      },
      {
        href: "/dashboard/employees",
        icon: "badge",
        label: "Співробітники",
        roles: ["director"],
      },
      {
        href: "/dashboard/reports",
        icon: "monitoring",
        label: "Звіти",
        roles: ["director"],
      },
    ],
  },
];

const flatNavItems = navSections.flatMap((section) => section.items);

function isPathActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === "/dashboard"
    : pathname.startsWith(href);
}

function isValidRole(value: unknown): value is Role {
  return (
    typeof value === "string" &&
    ["director", "manager", "content", "ads", "accountant", "client"].includes(
      value
    )
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getRoleIcon(role: Role) {
  if (role === "director") return "admin_panel_settings";
  if (role === "manager") return "support_agent";
  if (role === "content") return "edit_square";
  if (role === "ads") return "campaign";
  if (role === "accountant") return "account_balance_wallet";

  return "person";
}

function AccessDeniedBlock({
  pageTitle,
  role,
}: {
  pageTitle: string;
  role: Role;
}) {
  return (
    <section className={styles.accessDenied}>
      <span className={styles.accessDeniedIcon}>
        <span className="material-symbols-rounded">lock</span>
      </span>

      <div>
        <span className={styles.accessDeniedKicker}>Обмеження доступу</span>

        <h1>Немає доступу до розділу «{pageTitle}»</h1>

        <p>
          Поточна роль: <strong>{roleLabels[role]}</strong>. Цей розділ не
          входить у доступні модулі для вашої ролі.
        </p>

        <Link href="/dashboard" className={styles.accessDeniedButton}>
          <span className="material-symbols-rounded">arrow_back</span>
          Повернутися до огляду
        </Link>
      </div>
    </section>
  );
}

function DashboardLoadingScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        background: "#fffaf4",
      }}
    >
      <style>{"@keyframes adflowSpin{to{transform:rotate(360deg)}}"}</style>

      <span
        className="material-symbols-rounded"
        style={{
          fontSize: "44px",
          color: "#ff7a18",
          animation: "adflowSpin 0.9s linear infinite",
        }}
      >
        progress_activity
      </span>

      <p style={{ fontSize: "14px", fontWeight: 500, color: "#6b6055" }}>
        Перевіряємо сесію...
      </p>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role | null>(null);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [menuOpen, setMenuOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        let result: AuthMeResponse | null = null;

        try {
          result = (await response.json()) as AuthMeResponse;
        } catch {
          result = null;
        }

        if (!response.ok || !result?.ok || !result.data) {
          router.replace("/login");
          return;
        }

        const payload = result.data;

        if (!isValidRole(payload.role)) {
          router.replace("/login");
          return;
        }

        if (cancelled) {
          return;
        }

        setRole(payload.role);
        setUser({
          id: payload.id,
          source: payload.source,
          name: payload.name || "Користувач",
          email: payload.email || "",
          login: payload.login || "",
          status: payload.status || "",
          company_name: payload.company_name,
          phone: payload.phone,
          position_name: payload.position_name,
        });
        setStatus("ready");
      } catch (error) {
        console.error("DASHBOARD_SESSION_ERROR", error);
        router.replace("/login");
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const visibleSections = useMemo(() => {
    if (!role) {
      return [] as NavSection[];
    }

    return navSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => item.roles.includes(role)),
      }))
      .filter((section) => section.items.length > 0);
  }, [role]);

  const activeItem = useMemo(() => {
    return flatNavItems.find((item) => isPathActive(pathname, item.href));
  }, [pathname]);

  if (status === "loading" || !role || !user) {
    return <DashboardLoadingScreen />;
  }

  const pageTitle = activeItem?.label || "Кабінет";

  const pageGroup =
    visibleSections.find((section) =>
      section.items.some((item) => item.href === activeItem?.href)
    )?.title || "AdFlow CRM";

  const routeAllowed = activeItem ? activeItem.roles.includes(role) : true;

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <DashboardCtx.Provider value={{ role, user }}>
      <div className={styles.shell}>
        <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}>
          <div className={styles.sidebarInner}>
            <Link
              href="/dashboard"
              className={styles.brand}
              onClick={() => setMenuOpen(false)}
            >
              <Image
                src="/brand/logo-icon.webp"
                alt="AdFlow CRM"
                width={36}
                height={36}
                className={styles.brandMark}
                priority
              />

              <span className={styles.brandText}>
                <strong>AdFlow CRM</strong>
                <small>Agency system</small>
              </span>
            </Link>

            <div className={styles.roleCard}>
              <span className={styles.roleIcon}>
                <span className="material-symbols-rounded">{getRoleIcon(role)}</span>
              </span>

              <div>
                <span>Поточний доступ</span>
                <strong>{roleLabels[role]}</strong>
              </div>
            </div>

            <nav className={styles.nav} aria-label="Навігація кабінету">
              {visibleSections.map((section) => (
                <div className={styles.navSection} key={section.title}>
                  <span className={styles.navSectionTitle}>{section.title}</span>

                  <div className={styles.navList}>
                    {section.items.map((item) => {
                      const active = isPathActive(pathname, item.href);

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`${styles.navItem} ${
                            active ? styles.navActive : ""
                          }`}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setMenuOpen(false)}
                        >
                          <span className="material-symbols-rounded">
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className={styles.sidebarFoot}>
              <div className={styles.miniProfile}>
                <span className={styles.miniAvatar}>{getInitials(user.name)}</span>

                <div className={styles.miniProfileInfo}>
                  <strong>{user.name}</strong>
                  <span>{user.email || user.login}</span>
                </div>
              </div>

              <button
                type="button"
                className={styles.exit}
                onClick={handleLogout}
              >
                <span className="material-symbols-rounded">logout</span>
                Вийти
              </button>
            </div>
          </div>
        </aside>

        {menuOpen && (
          <div
            className={styles.overlay}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className={styles.main}>
          <header className={styles.topbar}>
            <div className={styles.topbarLeft}>
              <button
                className={styles.burger}
                onClick={() => setMenuOpen((current) => !current)}
                aria-label="Відкрити меню"
                aria-expanded={menuOpen}
                type="button"
              >
                <span className="material-symbols-rounded">menu</span>
              </button>

              <div className={styles.pageInfo}>
                <span>{pageGroup}</span>
                <strong>{pageTitle}</strong>
              </div>
            </div>

            <div className={styles.search}>
              <span className="material-symbols-rounded">search</span>
              <input type="text" placeholder="Пошук у системі..." />
            </div>

            <div className={styles.topbarRight}>
              <div className={styles.roleBadge} aria-label="Поточна роль">
                <span className="material-symbols-rounded">{getRoleIcon(role)}</span>
                <strong>{roleLabels[role]}</strong>
              </div>

            <NotificationsBell />

              <div className={styles.user}>
                <span className={styles.avatar}>{getInitials(user.name)}</span>

                <div className={styles.userInfo}>
                  <strong>{user.name}</strong>
                  <span>{roleLabels[role]}</span>
                </div>
              </div>
            </div>
          </header>

          <main className={styles.content}>
            {routeAllowed ? (
              children
            ) : (
              <AccessDeniedBlock pageTitle={pageTitle} role={role} />
            )}
          </main>
        </div>
      </div>
    </DashboardCtx.Provider>
  );
}