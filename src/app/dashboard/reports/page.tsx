"use client";

import { useMemo, useState } from "react";
import { Role, useDashboard } from "../layout";
import styles from "./page.module.css";

type ReportCategory = "all" | "projects" | "finance" | "team" | "ads";
type PeriodFilter = "7" | "14" | "30" | "90";

type ReportCard = {
  report_id: number;
  title: string;
  description: string;
  category: Exclude<ReportCategory, "all">;
  icon: string;
  tables: string[];
  metricLabel: string;
  metricValue: string;
  updated_at: string;
};

type ChartPoint = {
  label: string;
  value: number;
};

const allowedRoles: Role[] = ["director"];

const reports: ReportCard[] = [
  {
    report_id: 1,
    title: "Звіт по проєктах",
    description:
      "Стан виконання проєктів, дедлайни, активні задачі та поточний прогрес роботи.",
    category: "projects",
    icon: "folder_managed",
    tables: ["project", "task", "brief"],
    metricLabel: "Активних проєктів",
    metricValue: "6",
    updated_at: "2026-06-01",
  },
  {
    report_id: 2,
    title: "Фінансовий звіт",
    description:
      "Рахунки, отримані оплати, прострочені суми та загальна фінансова динаміка.",
    category: "finance",
    icon: "account_balance_wallet",
    tables: ["invoice", "payment", "client"],
    metricLabel: "Надходження",
    metricValue: "82 100 ₴",
    updated_at: "2026-06-01",
  },
  {
    report_id: 3,
    title: "Ефективність кампаній",
    description:
      "Покази, кліки, CTR, витрати та порівняння рекламних каналів між собою.",
    category: "ads",
    icon: "query_stats",
    tables: ["campaign", "statistic"],
    metricLabel: "Середній CTR",
    metricValue: "4.47%",
    updated_at: "2026-06-01",
  },
  {
    report_id: 4,
    title: "Завантаженість команди",
    description:
      "Розподіл задач між співробітниками, дедлайни та кількість активних призначень.",
    category: "team",
    icon: "groups",
    tables: ["employee", "task", "task_assignment_log"],
    metricLabel: "У роботі",
    metricValue: "14 задач",
    updated_at: "2026-05-31",
  },
  {
    report_id: 5,
    title: "Клієнтська активність",
    description:
      "Брифи, проєкти, рахунки та матеріали в розрізі кожного клієнта агентства.",
    category: "projects",
    icon: "diversity_3",
    tables: ["client", "brief", "project", "material"],
    metricLabel: "Клієнтів",
    metricValue: "7",
    updated_at: "2026-05-31",
  },
  {
    report_id: 6,
    title: "Матеріали та погодження",
    description:
      "Завантажені файли, статуси погодження, коментарі клієнтів та задачі дизайнерів.",
    category: "team",
    icon: "perm_media",
    tables: ["material", "task", "client"],
    metricLabel: "Матеріалів",
    metricValue: "18",
    updated_at: "2026-05-30",
  },
];

const categoryOptions: { id: ReportCategory; label: string }[] = [
  { id: "all", label: "Всі звіти" },
  { id: "projects", label: "Проєкти" },
  { id: "finance", label: "Фінанси" },
  { id: "team", label: "Команда" },
  { id: "ads", label: "Реклама" },
];

const periodOptions: { id: PeriodFilter; label: string }[] = [
  { id: "7", label: "7 днів" },
  { id: "14", label: "14 днів" },
  { id: "30", label: "30 днів" },
  { id: "90", label: "90 днів" },
];

const chartData: ChartPoint[] = [
  { label: "Проєкти", value: 76 },
  { label: "Фінанси", value: 64 },
  { label: "Кампанії", value: 88 },
  { label: "Команда", value: 58 },
  { label: "Клієнти", value: 71 },
];

const cx = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(" ");

function formatDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

function categoryClass(category: ReportCategory) {
  if (category === "finance") return styles.toneGreen;
  if (category === "ads") return styles.toneInfo;
  if (category === "team") return styles.toneAmber;
  if (category === "projects") return styles.toneNeutral;

  return styles.toneNeutral;
}

function categoryLabel(category: ReportCategory) {
  const found = categoryOptions.find((item) => item.id === category);
  return found ? found.label : "Звіт";
}

function periodCoefficient(period: PeriodFilter) {
  if (period === "7") return 0.35;
  if (period === "14") return 0.55;
  if (period === "30") return 1;
  return 1.45;
}

function formatMoney(value: number) {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function ReportsPage() {
  const { role } = useDashboard();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ReportCategory>("all");
  const [period, setPeriod] = useState<PeriodFilter>("30");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return reports.filter((report) => {
      const matchCategory = category === "all" || report.category === category;

      const matchQuery =
        !q ||
        report.title.toLowerCase().includes(q) ||
        report.description.toLowerCase().includes(q) ||
        report.tables.some((table) => table.toLowerCase().includes(q));

      return matchCategory && matchQuery;
    });
  }, [category, query]);

  const summary = useMemo(() => {
    const coefficient = periodCoefficient(period);

    return {
      revenue: formatMoney(82100 * coefficient),
      spent: formatMoney(28650 * coefficient),
      reportsCount: filtered.length,
      efficiency: Math.round(74 * coefficient > 100 ? 100 : 74 * coefficient),
    };
  }, [filtered.length, period]);

  const preparedChart = useMemo(() => {
    const coefficient = periodCoefficient(period);

    return chartData.map((item) => ({
      ...item,
      value: Math.min(100, Math.round(item.value * coefficient)),
    }));
  }, [period]);

  if (!allowedRoles.includes(role)) {
    return (
      <div className={styles.denied}>
        <span className="material-symbols-rounded">lock</span>
        <h2>Немає доступу</h2>
        <p>Розділ «Звіти» доступний лише директору рекламної агенції.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1>Звіти</h1>
          <p>Формування управлінських звітів на основі даних CRM-системи</p>
        </div>

        <button className={styles.addButton} type="button">
          <span className="material-symbols-rounded">picture_as_pdf</span>
          Експорт PDF
        </button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <span className="material-symbols-rounded">search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="text"
            placeholder="Пошук за назвою звіту або таблицею БД..."
          />
        </div>

        <div className={styles.filterSelect}>
          <span className="material-symbols-rounded">category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as ReportCategory)}
          >
            {categoryOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterSelect}>
          <span className="material-symbols-rounded">date_range</span>
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodFilter)}
          >
            {periodOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            <span className="material-symbols-rounded">description</span>
          </span>

          <div>
            <p>Доступні звіти</p>
            <strong>{summary.reportsCount}</strong>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            <span className="material-symbols-rounded">trending_up</span>
          </span>

          <div>
            <p>Надходження</p>
            <strong>{summary.revenue} ₴</strong>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            <span className="material-symbols-rounded">payments</span>
          </span>

          <div>
            <p>Витрати реклами</p>
            <strong>{summary.spent} ₴</strong>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            <span className="material-symbols-rounded">speed</span>
          </span>

          <div>
            <p>Ефективність</p>
            <strong>{summary.efficiency}%</strong>
          </div>
        </article>
      </section>

      <section className={styles.reportLayout}>
        <article className={styles.chartPanel}>
          <div className={styles.cardHead}>
            <div>
              <h2>Огляд показників</h2>
              <p>Умовна візуалізація даних за вибраний період без сторонніх бібліотек</p>
            </div>

            <span className={styles.badge}>Період: {period} днів</span>
          </div>

          <div className={styles.chartList}>
            {preparedChart.map((item) => (
              <div className={styles.chartRow} key={item.label}>
                <div className={styles.chartLabel}>
                  <span>{item.label}</span>
                  <strong>{item.value}%</strong>
                </div>

                <div className={styles.chartTrack}>
                  <span style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className={styles.sourcesPanel}>
          <div className={styles.cardHead}>
            <div>
              <h2>Джерела даних</h2>
              <p>Таблиці БД, з яких формується звітність</p>
            </div>
          </div>

          <div className={styles.sourceGrid}>
            {[
              "client",
              "project",
              "campaign",
              "statistic",
              "invoice",
              "payment",
              "task",
              "employee",
            ].map((table) => (
              <span className={styles.sourceTag} key={table}>
                <span className="material-symbols-rounded">database</span>
                {table}
              </span>
            ))}
          </div>
        </article>
      </section>

      {filtered.length > 0 ? (
        <section className={styles.reportGrid}>
          {filtered.map((report) => (
            <article className={styles.reportCard} key={report.report_id}>
              <div className={styles.reportTop}>
                <span className={styles.reportIcon}>
                  <span className="material-symbols-rounded">{report.icon}</span>
                </span>

                <span className={cx(styles.badge, categoryClass(report.category))}>
                  {categoryLabel(report.category)}
                </span>
              </div>

              <div className={styles.reportBody}>
                <h2>{report.title}</h2>
                <p>{report.description}</p>
              </div>

              <div className={styles.reportMetric}>
                <span>{report.metricLabel}</span>
                <strong>{report.metricValue}</strong>
              </div>

              <div className={styles.tableTags}>
                {report.tables.map((table) => (
                  <span key={table}>{table}</span>
                ))}
              </div>

              <div className={styles.reportFooter}>
                <span>Оновлено: {formatDate(report.updated_at)}</span>

                <button className={styles.rowAction} type="button">
                  <span className="material-symbols-rounded">play_arrow</span>
                  Сформувати
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className={styles.empty}>
          <span className="material-symbols-rounded">search_off</span>
          <p>Звіти за вибраними умовами не знайдено.</p>
        </div>
      )}
    </div>
  );
}