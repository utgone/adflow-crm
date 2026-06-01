"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDashboard } from "./layout";
import styles from "./page.module.css";

type Client = {
  client_id: number;
  full_name: string;
  company_name: string | null;
  phone: string;
  email: string;
  status: string;
};

type Employee = {
  employee_id: number;
  full_name: string;
  position_id?: number;
  position_name?: string;
  login?: string;
  contacts?: string;
  birth_date?: string;
  status: string;
};

type Brief = {
  brief_id: number;
  client_id: number;
  client_name: string;
  client_company: string;
  client_status: string;
  category: string;
  requirement_desc: string;
  budget: number;
  created_date: string;
  status: string;
  project_count?: number;
  has_project?: boolean;
};

type Project = {
  project_id: number;
  brief_id?: number;
  project_name: string;
  start_date: string;
  end_date: string | null;
  status: string;
  client_id?: number;
  client_name?: string;
  client_company?: string;
  brief_budget?: number;
  budget?: number;
};

type Task = {
  task_id: number;
  project_id: number;
  project_name?: string;
  employee_id: number;
  employee_name?: string;
  service_id: number;
  service_name?: string;
  description: string;
  deadline: string;
  task_status: string;
  manager_comment?: string | null;
  date: string;
};

type Material = {
  material_id: number;
  task_id: number;
  project_name?: string;
  file_link: string;
  file_format: string;
  upload_date: string;
  material_status: string;
  client_comment?: string | null;
};

type Campaign = {
  campaign_id: number;
  project_id: number;
  project_name: string;
  project_status: string;
  client_company: string;
  channel: string;
  launch_date: string;
  stop_date: string | null;
  budget: number;
  campaign_status: string;
};

type Statistic = {
  statistic_id: number;
  campaign_id: number;
  channel: string;
  project_name: string;
  client_company: string;
  record_date: string;
  impressions: number;
  clicks: number;
  spent_amount: number;
  ctr: number;
  cpc: number;
  cpm: number;
};

type Invoice = {
  invoice_id: number;
  client_id: number;
  client_name: string;
  client_company: string;
  project_id: number;
  project_name: string;
  total_amount: number;
  issue_date: string;
  due_date: string;
  invoice_status: string;
  effective_status: string;
  is_overdue: boolean;
  days_to_due: number;
  can_register_payment: boolean;
};

type Payment = {
  payment_id: number;
  invoice_id: number;
  amount_paid: number;
  payment_date: string;
  payment_method: string;
  client_company: string;
  client_name: string;
  project_name: string;
  invoice_status: string;
  invoice_effective_status: string;
  invoice_total_amount: number;
  paid_total: number;
  balance_amount: number;
};

type DashboardData = {
  clients: Client[];
  employees: Employee[];
  briefs: Brief[];
  projects: Project[];
  tasks: Task[];
  materials: Material[];
  campaigns: Campaign[];
  statistics: Statistic[];
  invoices: Invoice[];
  payments: Payment[];
};

type ApiListResponse<T> = {
  ok: boolean;
  data?: T[];
  message?: string;
};

type FetchResult<T> = {
  data: T[];
  error: string;
};

type ModuleHealthItem = {
  name: string;
  count: number;
};

const emptyData: DashboardData = {
  clients: [],
  employees: [],
  briefs: [],
  projects: [],
  tasks: [],
  materials: [],
  campaigns: [],
  statistics: [],
  invoices: [],
  payments: [],
};

const roleLabels: Record<string, string> = {
  director: "Директор",
  manager: "Менеджер",
  ads: "Таргетолог",
  designer: "Дизайнер",
  accountant: "Бухгалтер",
  client: "Клієнт",
};

const finalProjectStatuses = ["завершено", "зупинено", "скасовано"];
const finalTaskStatuses = [
  "передано клієнту",
  "виконано",
  "скасовано",
  "готово для перевірки",
];
const finalInvoiceStatuses = ["оплачено", "скасовано"];

const cx = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(" ");

function getTodayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeDateValue(value: string | null | undefined) {
  if (!value) return "";

  return value.includes("T") ? value.split("T")[0] : value;
}

function toUTC(value: string | null | undefined) {
  const normalized = normalizeDateValue(value);

  if (!normalized) return 0;

  const [year, month, day] = normalized.split("-").map(Number);

  if (!year || !month || !day) return 0;

  return Date.UTC(year, month - 1, day);
}

function formatDate(value: string | null | undefined) {
  const normalized = normalizeDateValue(value);

  if (!normalized) return "—";

  const [year, month, day] = normalized.split("-");

  if (!year || !month || !day) return "—";

  return `${day}.${month}.${year}`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(2)}%`;
}

function normalizeStatus(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function sumBy<T>(items: T[], getter: (item: T) => number) {
  return items.reduce((sum, item) => {
    const value = getter(item);

    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
}

function getDaysDiff(from: string, to: string) {
  const day = 24 * 60 * 60 * 1000;

  return Math.ceil((toUTC(to) - toUTC(from)) / day);
}

function getStatusTone(status: string) {
  const normalized = normalizeStatus(status);

  if (
    [
      "активний",
      "працює",
      "в роботі",
      "запущено",
      "оплачено",
      "погоджено",
      "картка",
      "готівка",
    ].includes(normalized)
  ) {
    return styles.toneGreen;
  }

  if (
    [
      "нове",
      "новий",
      "виставлено",
      "завантажено",
      "заплановано",
      "на перевірці",
      "банківський переказ",
    ].includes(normalized)
  ) {
    return styles.toneInfo;
  }

  if (
    [
      "частково оплачено",
      "на доопрацюванні",
      "на паузі",
      "прострочено",
      "прострочена",
    ].includes(normalized)
  ) {
    return styles.toneAmber;
  }

  if (["скасовано", "відхилено", "звільнений"].includes(normalized)) {
    return styles.toneRed;
  }

  return styles.toneNeutral;
}

async function fetchList<T>(path: string): Promise<FetchResult<T>> {
  try {
    const response = await fetch(path, {
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      return {
        data: [],
        error: `${path}: API повернув не JSON.`,
      };
    }

    const result = (await response.json()) as ApiListResponse<T>;

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      return {
        data: [],
        error: `${path}: ${result.message || "не вдалося завантажити дані"}.`,
      };
    }

    return {
      data: result.data,
      error: "",
    };
  } catch (error) {
    return {
      data: [],
      error:
        error instanceof Error
          ? `${path}: ${error.message}`
          : `${path}: невідома помилка завантаження.`,
    };
  }
}

export default function DashboardOverviewPage() {
  const { role } = useDashboard();

  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");

  async function loadDashboardData() {
    try {
      setLoading(true);

      const [
        clients,
        employees,
        briefs,
        projects,
        tasks,
        materials,
        campaigns,
        statistics,
        invoices,
        payments,
      ] = await Promise.all([
        fetchList<Client>("/api/clients"),
        fetchList<Employee>("/api/employees"),
        fetchList<Brief>("/api/briefs"),
        fetchList<Project>("/api/projects"),
        fetchList<Task>("/api/tasks"),
        fetchList<Material>("/api/materials"),
        fetchList<Campaign>("/api/campaigns"),
        fetchList<Statistic>("/api/statistics"),
        fetchList<Invoice>("/api/invoices"),
        fetchList<Payment>("/api/payments"),
      ]);

      setData({
        clients: clients.data,
        employees: employees.data,
        briefs: briefs.data,
        projects: projects.data,
        tasks: tasks.data,
        materials: materials.data,
        campaigns: campaigns.data,
        statistics: statistics.data,
        invoices: invoices.data,
        payments: payments.data,
      });

      setWarnings(
        [
          clients.error,
          employees.error,
          briefs.error,
          projects.error,
          tasks.error,
          materials.error,
          campaigns.error,
          statistics.error,
          invoices.error,
          payments.error,
        ].filter(Boolean)
      );

      setUpdatedAt(
        new Intl.DateTimeFormat("uk-UA", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date())
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const analytics = useMemo(() => {
    const today = getTodayISO();

    const activeClients = data.clients.filter(
      (client) => normalizeStatus(client.status) === "активний"
    ).length;

    const workingEmployees = data.employees.filter(
      (employee) => normalizeStatus(employee.status) === "працює"
    ).length;

    const activeProjects = data.projects.filter(
      (project) => !finalProjectStatuses.includes(normalizeStatus(project.status))
    );

    const projectsInProgress = data.projects.filter(
      (project) => normalizeStatus(project.status) === "в роботі"
    ).length;

    const activeTasks = data.tasks.filter(
      (task) => !finalTaskStatuses.includes(normalizeStatus(task.task_status))
    );

    const tasksInProgress = data.tasks.filter(
      (task) => normalizeStatus(task.task_status) === "в роботі"
    ).length;

    const tasksForReview = data.tasks.filter(
      (task) => normalizeStatus(task.task_status) === "готово для перевірки"
    ).length;

    const overdueTasks = activeTasks.filter((task) => {
      const deadline = normalizeDateValue(task.deadline);

      return Boolean(deadline) && deadline < today;
    });

    const dueSoonTasks = activeTasks
      .filter((task) => {
        const deadline = normalizeDateValue(task.deadline);

        if (!deadline) return false;

        const days = getDaysDiff(today, deadline);

        return days >= 0 && days <= 7;
      })
      .sort((a, b) => toUTC(a.deadline) - toUTC(b.deadline))
      .slice(0, 5);

    const materialsForReview = data.materials.filter(
      (material) => normalizeStatus(material.material_status) === "на перевірці"
    );

    const activeCampaigns = data.campaigns.filter(
      (campaign) => normalizeStatus(campaign.campaign_status) === "запущено"
    );

    const plannedCampaigns = data.campaigns.filter(
      (campaign) => normalizeStatus(campaign.campaign_status) === "заплановано"
    );

    const impressions = sumBy(data.statistics, (item) => item.impressions);
    const clicks = sumBy(data.statistics, (item) => item.clicks);
    const spent = sumBy(data.statistics, (item) =>
      Number(item.spent_amount || 0)
    );
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spent / clicks : 0;

    const issuedInvoices = data.invoices.filter(
      (invoice) =>
        !finalInvoiceStatuses.includes(normalizeStatus(invoice.invoice_status))
    );

    const invoiceTotal = sumBy(
      data.invoices.filter(
        (invoice) => normalizeStatus(invoice.invoice_status) !== "скасовано"
      ),
      (invoice) => Number(invoice.total_amount || 0)
    );

    const paymentsTotal = sumBy(data.payments, (payment) =>
      Number(payment.amount_paid || 0)
    );

    const balance = Math.max(0, invoiceTotal - paymentsTotal);

    const overdueInvoices = data.invoices.filter((invoice) => {
      const status = normalizeStatus(
        invoice.effective_status || invoice.invoice_status
      );

      return (
        status === "прострочено" ||
        (invoice.is_overdue &&
          !["оплачено", "скасовано"].includes(
            normalizeStatus(invoice.invoice_status)
          ))
      );
    });

    const overdueAmount = sumBy(overdueInvoices, (invoice) =>
      Number(invoice.total_amount || 0)
    );

    const paymentPercent =
      invoiceTotal > 0 ? Math.min(100, (paymentsTotal / invoiceTotal) * 100) : 0;

    const newestPayments = [...data.payments]
      .sort((a, b) => {
        if (a.payment_date === b.payment_date) {
          return b.payment_id - a.payment_id;
        }

        return toUTC(b.payment_date) - toUTC(a.payment_date);
      })
      .slice(0, 5);

    const newestInvoices = [...data.invoices]
      .sort((a, b) => {
        if (a.issue_date === b.issue_date) {
          return b.invoice_id - a.invoice_id;
        }

        return toUTC(b.issue_date) - toUTC(a.issue_date);
      })
      .slice(0, 5);

    const newestBriefs = [...data.briefs]
      .sort((a, b) => {
        if (a.created_date === b.created_date) {
          return b.brief_id - a.brief_id;
        }

        return toUTC(b.created_date) - toUTC(a.created_date);
      })
      .slice(0, 4);

    const campaignBudget = sumBy(
      data.campaigns.filter(
        (campaign) => normalizeStatus(campaign.campaign_status) !== "скасовано"
      ),
      (campaign) => Number(campaign.budget || 0)
    );

    const campaignBudgetUsedPercent =
      campaignBudget > 0 ? Math.min(100, (spent / campaignBudget) * 100) : 0;

    return {
      activeClients,
      workingEmployees,
      activeProjects,
      projectsInProgress,
      activeTasks,
      tasksInProgress,
      tasksForReview,
      overdueTasks,
      dueSoonTasks,
      materialsForReview,
      activeCampaigns,
      plannedCampaigns,
      impressions,
      clicks,
      spent,
      ctr,
      cpc,
      issuedInvoices,
      invoiceTotal,
      paymentsTotal,
      balance,
      overdueInvoices,
      overdueAmount,
      paymentPercent,
      newestPayments,
      newestInvoices,
      newestBriefs,
      campaignBudget,
      campaignBudgetUsedPercent,
    };
  }, [data]);

  const statCards = [
    {
      title: "Клієнти",
      value: data.clients.length,
      hint: `${analytics.activeClients} активних`,
      icon: "groups",
      href: "/dashboard/clients",
      tone: styles.cardOrange,
    },
    {
      title: "Співробітники",
      value: data.employees.length,
      hint: `${analytics.workingEmployees} працюють`,
      icon: "badge",
      href: "/dashboard/employees",
      tone: styles.cardGreen,
    },
    {
      title: "Проєкти",
      value: data.projects.length,
      hint: `${analytics.projectsInProgress} в роботі`,
      icon: "folder_managed",
      href: "/dashboard/projects",
      tone: styles.cardBlue,
    },
    {
      title: "Задачі",
      value: data.tasks.length,
      hint: `${analytics.activeTasks.length} активних`,
      icon: "task_alt",
      href: "/dashboard/tasks",
      tone: styles.cardPurple,
    },
    {
      title: "Кампанії",
      value: data.campaigns.length,
      hint: `${analytics.activeCampaigns.length} запущено`,
      icon: "campaign",
      href: "/dashboard/campaigns",
      tone: styles.cardAmber,
    },
    {
      title: "Рахунки",
      value: data.invoices.length,
      hint: `${analytics.issuedInvoices.length} відкритих`,
      icon: "receipt_long",
      href: "/dashboard/invoices",
      tone: styles.cardRed,
    },
  ];

  const moduleHealthItems: ModuleHealthItem[] = [
    { name: "clients", count: data.clients.length },
    { name: "employees", count: data.employees.length },
    { name: "briefs", count: data.briefs.length },
    { name: "projects", count: data.projects.length },
    { name: "tasks", count: data.tasks.length },
    { name: "materials", count: data.materials.length },
    { name: "campaigns", count: data.campaigns.length },
    { name: "statistics", count: data.statistics.length },
    { name: "invoices", count: data.invoices.length },
    { name: "payments", count: data.payments.length },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.kicker}>
            <span className="material-symbols-rounded">dashboard_customize</span>
            CRM-огляд PostgreSQL
          </span>

          <h1>Огляд роботи рекламної агенції</h1>

          <p>
            Єдина панель для контролю клієнтів, брифів, проєктів, задач,
            кампаній, статистики, рахунків та оплат.
          </p>

          <div className={styles.heroMeta}>
            <span>
              <span className="material-symbols-rounded">person</span>
              {roleLabels[String(role)] || String(role)}
            </span>

            <span>
              <span className="material-symbols-rounded">sync</span>
              {updatedAt ? `Оновлено ${updatedAt}` : "Дані завантажуються"}
            </span>
          </div>
        </div>

        <div className={styles.heroActions}>
          <button
            className={styles.refreshButton}
            type="button"
            onClick={loadDashboardData}
            disabled={loading}
          >
            <span className="material-symbols-rounded">
              {loading ? "progress_activity" : "refresh"}
            </span>
            {loading ? "Оновлення..." : "Оновити дані"}
          </button>

          <Link className={styles.primaryButton} href="/dashboard/clients">
            <span className="material-symbols-rounded">add_business</span>
            До клієнтів
          </Link>
        </div>
      </header>

      {warnings.length > 0 && (
        <section className={styles.warningBox}>
          <span className="material-symbols-rounded">warning</span>

          <div>
            <strong>Частина API не відповіла</strong>

            <p>
              Сторінка не падає, але деякі блоки можуть показувати неповну
              інформацію.
            </p>

            <ul>
              {warnings.slice(0, 4).map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {loading ? (
        <section className={styles.loadingState}>
          <span className="material-symbols-rounded">progress_activity</span>

          <h2>Збираємо дані з PostgreSQL...</h2>

          <p>Завантажуються клієнти, проєкти, кампанії, фінанси та задачі.</p>
        </section>
      ) : (
        <>
          <section className={styles.kpiGrid}>
            {statCards.map((card) => (
              <Link
                className={cx(styles.kpiCard, card.tone)}
                href={card.href}
                key={card.title}
              >
                <span className={styles.kpiIcon}>
                  <span className="material-symbols-rounded">{card.icon}</span>
                </span>

                <div>
                  <p>{card.title}</p>
                  <strong>{formatNumber(card.value)}</strong>
                  <small>{card.hint}</small>
                </div>

                <span className={styles.kpiArrow}>
                  <span className="material-symbols-rounded">arrow_forward</span>
                </span>
              </Link>
            ))}
          </section>

          <section className={styles.mainGrid}>
            <article className={styles.financePanel}>
              <div className={styles.panelHead}>
                <div>
                  <span className={styles.panelKicker}>Фінанси</span>
                  <h2>Рахунки та оплати</h2>
                </div>

                <Link href="/dashboard/invoices" className={styles.panelLink}>
                  Деталі
                  <span className="material-symbols-rounded">arrow_forward</span>
                </Link>
              </div>

              <div className={styles.financeHero}>
                <div>
                  <span>Отримано оплат</span>
                  <strong>{formatMoney(analytics.paymentsTotal)} ₴</strong>
                </div>

                <div className={styles.financePercent}>
                  {formatPercent(analytics.paymentPercent)}
                </div>
              </div>

              <div className={styles.progressTrack}>
                <span style={{ width: `${analytics.paymentPercent}%` }} />
              </div>

              <div className={styles.financeGrid}>
                <div>
                  <small>Виставлено</small>
                  <strong>{formatMoney(analytics.invoiceTotal)} ₴</strong>
                </div>

                <div>
                  <small>Борг</small>
                  <strong>{formatMoney(analytics.balance)} ₴</strong>
                </div>

                <div>
                  <small>Прострочено</small>
                  <strong>{formatMoney(analytics.overdueAmount)} ₴</strong>
                </div>
              </div>

              <div className={styles.alertLine}>
                <span className="material-symbols-rounded">priority_high</span>

                {analytics.overdueInvoices.length > 0
                  ? `${analytics.overdueInvoices.length} рах. прострочено — перевірити оплату`
                  : "Критичних прострочених рахунків немає"}
              </div>
            </article>

            <article className={styles.marketingPanel}>
              <div className={styles.panelHead}>
                <div>
                  <span className={styles.panelKicker}>Маркетинг</span>
                  <h2>Кампанії та статистика</h2>
                </div>

                <Link href="/dashboard/statistics" className={styles.panelLink}>
                  Аналітика
                  <span className="material-symbols-rounded">arrow_forward</span>
                </Link>
              </div>

              <div className={styles.metricRows}>
                <div className={styles.metricRow}>
                  <span className={styles.metricIcon}>
                    <span className="material-symbols-rounded">campaign</span>
                  </span>

                  <div>
                    <strong>{analytics.activeCampaigns.length}</strong>
                    <small>запущених кампаній</small>
                  </div>
                </div>

                <div className={styles.metricRow}>
                  <span className={styles.metricIcon}>
                    <span className="material-symbols-rounded">visibility</span>
                  </span>

                  <div>
                    <strong>{formatNumber(analytics.impressions)}</strong>
                    <small>показів</small>
                  </div>
                </div>

                <div className={styles.metricRow}>
                  <span className={styles.metricIcon}>
                    <span className="material-symbols-rounded">ads_click</span>
                  </span>

                  <div>
                    <strong>{formatNumber(analytics.clicks)}</strong>
                    <small>кліків · CTR {formatPercent(analytics.ctr)}</small>
                  </div>
                </div>

                <div className={styles.metricRow}>
                  <span className={styles.metricIcon}>
                    <span className="material-symbols-rounded">payments</span>
                  </span>

                  <div>
                    <strong>{formatMoney(analytics.spent)} ₴</strong>
                    <small>CPC {analytics.cpc.toFixed(2)} ₴</small>
                  </div>
                </div>
              </div>

              <div className={styles.campaignBudget}>
                <div>
                  <span>Використання бюджету кампаній</span>

                  <strong>
                    {formatMoney(analytics.spent)} /{" "}
                    {formatMoney(analytics.campaignBudget)} ₴
                  </strong>
                </div>

                <div className={styles.progressTrack}>
                  <span
                    style={{
                      width: `${analytics.campaignBudgetUsedPercent}%`,
                    }}
                  />
                </div>
              </div>
            </article>
          </section>

          <section className={styles.operationsGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <span className={styles.panelKicker}>
                    Операційний контроль
                  </span>
                  <h2>Найближчі задачі</h2>
                </div>

                <Link href="/dashboard/tasks" className={styles.panelLink}>
                  Задачі
                  <span className="material-symbols-rounded">arrow_forward</span>
                </Link>
              </div>

              <div className={styles.statusStrip}>
                <div>
                  <strong>{analytics.tasksInProgress}</strong>
                  <span>в роботі</span>
                </div>

                <div>
                  <strong>{analytics.tasksForReview}</strong>
                  <span>на перевірці</span>
                </div>

                <div>
                  <strong>{analytics.overdueTasks.length}</strong>
                  <span>прострочено</span>
                </div>
              </div>

              <div className={styles.list}>
                {analytics.dueSoonTasks.length > 0 ? (
                  analytics.dueSoonTasks.map((task) => (
                    <div className={styles.listItem} key={task.task_id}>
                      <span className={styles.listIcon}>
                        <span className="material-symbols-rounded">task_alt</span>
                      </span>

                      <div>
                        <strong>{task.description}</strong>

                        <small>
                          {task.project_name || `project_id: ${task.project_id}`} ·
                          дедлайн {formatDate(task.deadline)}
                        </small>
                      </div>

                      <span
                        className={cx(
                          styles.badge,
                          getStatusTone(task.task_status)
                        )}
                      >
                        {task.task_status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyMini}>
                    <span className="material-symbols-rounded">
                      event_available
                    </span>
                    Немає задач з дедлайном на найближчі 7 днів.
                  </div>
                )}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <span className={styles.panelKicker}>Матеріали</span>
                  <h2>Файли на перевірці</h2>
                </div>

                <Link href="/dashboard/materials" className={styles.panelLink}>
                  Матеріали
                  <span className="material-symbols-rounded">arrow_forward</span>
                </Link>
              </div>

              <div className={styles.largeNumber}>
                <strong>{analytics.materialsForReview.length}</strong>
                <span>матеріалів очікують рішення</span>
              </div>

              <div className={styles.list}>
                {analytics.materialsForReview.length > 0 ? (
                  analytics.materialsForReview.slice(0, 4).map((material) => (
                    <div className={styles.listItem} key={material.material_id}>
                      <span className={styles.listIcon}>
                        <span className="material-symbols-rounded">attach_file</span>
                      </span>

                      <div>
                        <strong>
                          Матеріал #{material.material_id} ·{" "}
                          {material.file_format}
                        </strong>

                        <small>
                          {material.project_name || `task_id: ${material.task_id}`} ·{" "}
                          {formatDate(material.upload_date)}
                        </small>
                      </div>

                      <span
                        className={cx(
                          styles.badge,
                          getStatusTone(material.material_status)
                        )}
                      >
                        {material.material_status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyMini}>
                    <span className="material-symbols-rounded">check_circle</span>
                    Немає матеріалів на перевірці.
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className={styles.bottomGrid}>
            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <span className={styles.panelKicker}>Останні платежі</span>
                  <h2>Надходження</h2>
                </div>

                <Link href="/dashboard/payments" className={styles.panelLink}>
                  Оплати
                  <span className="material-symbols-rounded">arrow_forward</span>
                </Link>
              </div>

              <div className={styles.list}>
                {analytics.newestPayments.length > 0 ? (
                  analytics.newestPayments.map((payment) => (
                    <div className={styles.listItem} key={payment.payment_id}>
                      <span className={styles.listIcon}>
                        <span className="material-symbols-rounded">payments</span>
                      </span>

                      <div>
                        <strong>{formatMoney(payment.amount_paid)} ₴</strong>

                        <small>
                          {payment.client_company} · INV-
                          {String(payment.invoice_id).padStart(4, "0")} ·{" "}
                          {formatDate(payment.payment_date)}
                        </small>
                      </div>

                      <span
                        className={cx(
                          styles.badge,
                          getStatusTone(payment.payment_method)
                        )}
                      >
                        {payment.payment_method}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyMini}>
                    <span className="material-symbols-rounded">payments</span>
                    Платежів ще немає.
                  </div>
                )}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <span className={styles.panelKicker}>Останні рахунки</span>
                  <h2>Фінансові документи</h2>
                </div>

                <Link href="/dashboard/invoices" className={styles.panelLink}>
                  Рахунки
                  <span className="material-symbols-rounded">arrow_forward</span>
                </Link>
              </div>

              <div className={styles.list}>
                {analytics.newestInvoices.length > 0 ? (
                  analytics.newestInvoices.map((invoice) => {
                    const status =
                      invoice.effective_status || invoice.invoice_status;

                    return (
                      <div className={styles.listItem} key={invoice.invoice_id}>
                        <span className={styles.listIcon}>
                          <span className="material-symbols-rounded">
                            receipt_long
                          </span>
                        </span>

                        <div>
                          <strong>
                            INV-{String(invoice.invoice_id).padStart(4, "0")} ·{" "}
                            {formatMoney(invoice.total_amount)} ₴
                          </strong>

                          <small>
                            {invoice.client_company} · до{" "}
                            {formatDate(invoice.due_date)}
                          </small>
                        </div>

                        <span
                          className={cx(styles.badge, getStatusTone(status))}
                        >
                          {status}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.emptyMini}>
                    <span className="material-symbols-rounded">
                      receipt_long
                    </span>
                    Рахунків ще немає.
                  </div>
                )}
              </div>
            </article>

            <article className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <span className={styles.panelKicker}>Нові брифи</span>
                  <h2>Заявки клієнтів</h2>
                </div>

                <Link href="/dashboard/briefs" className={styles.panelLink}>
                  Брифи
                  <span className="material-symbols-rounded">arrow_forward</span>
                </Link>
              </div>

              <div className={styles.list}>
                {analytics.newestBriefs.length > 0 ? (
                  analytics.newestBriefs.map((brief) => (
                    <div className={styles.listItem} key={brief.brief_id}>
                      <span className={styles.listIcon}>
                        <span className="material-symbols-rounded">article</span>
                      </span>

                      <div>
                        <strong>{brief.category}</strong>

                        <small>
                          {brief.client_company} ·{" "}
                          {formatMoney(Number(brief.budget || 0))} ₴
                        </small>
                      </div>

                      <span
                        className={cx(styles.badge, getStatusTone(brief.status))}
                      >
                        {brief.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyMini}>
                    <span className="material-symbols-rounded">article</span>
                    Брифів ще немає.
                  </div>
                )}
              </div>
            </article>
          </section>

          <section className={styles.healthPanel}>
            <div>
              <span className={styles.panelKicker}>Стан системи</span>

              <h2>Перевірка модулів CRM</h2>

              <p>
                Дані зібрані з 10 API-модулів. Це показує, що основний ланцюжок
                CRM вже працює: client → brief → project → campaign/task →
                statistic/material → invoice → payment.
              </p>
            </div>

            <div className={styles.moduleHealthGrid}>
              {moduleHealthItems.map((item) => (
                <div className={styles.moduleHealth} key={item.name}>
                  <span className="material-symbols-rounded">
                    {item.count > 0 ? "check_circle" : "radio_button_unchecked"}
                  </span>

                  <strong>{item.name}</strong>
                  <small>{item.count} записів</small>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}