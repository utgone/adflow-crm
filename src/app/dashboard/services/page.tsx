"use client";

import { useMemo, useState } from "react";
import { Role, useDashboard } from "../layout";
import styles from "./page.module.css";

type Service = {
  service_id: number;
  service_name: string;
  description: string;
  base_price: number;
  unit: string;
  status: string;
  position_id: number;
  position_name: string;
};

type StatusFilter = "all" | "активна" | "неактивна";

const allowedRoles: Role[] = ["director"];

const services: Service[] = [
  {
    service_id: 1,
    service_name: "SMM-супровід",
    description:
      "Планування контенту, ведення сторінок, підготовка публікацій та базова комунікація з аудиторією.",
    base_price: 12000,
    unit: "за місяць",
    status: "активна",
    position_id: 3,
    position_name: "Контент-менеджер",
  },
  {
    service_id: 2,
    service_name: "Таргетована реклама",
    description:
      "Налаштування, запуск і оптимізація рекламних кампаній у соціальних мережах.",
    base_price: 8500,
    unit: "за кампанію",
    status: "активна",
    position_id: 4,
    position_name: "Таргетолог",
  },
  {
    service_id: 3,
    service_name: "Google Ads",
    description:
      "Пошукові, медійні та performance-кампанії з контролем бюджету і конверсій.",
    base_price: 11000,
    unit: "за кампанію",
    status: "активна",
    position_id: 4,
    position_name: "Таргетолог",
  },
  {
    service_id: 4,
    service_name: "Дизайн креативів",
    description:
      "Розробка банерів, рекламних макетів, візуалів для постів, сторіс та оголошень.",
    base_price: 900,
    unit: "за макет",
    status: "активна",
    position_id: 5,
    position_name: "Дизайнер",
  },
  {
    service_id: 5,
    service_name: "Контент-стратегія",
    description:
      "Аналіз цільової аудиторії, рубрикатор, tone of voice та план комунікації бренду.",
    base_price: 15000,
    unit: "за проєкт",
    status: "активна",
    position_id: 2,
    position_name: "Акаунт-менеджер",
  },
  {
    service_id: 6,
    service_name: "SEO-аудит",
    description:
      "Перевірка технічного стану сайту, структури сторінок, метаданих і базових SEO-помилок.",
    base_price: 7000,
    unit: "за аудит",
    status: "активна",
    position_id: 6,
    position_name: "SEO-спеціаліст",
  },
  {
    service_id: 7,
    service_name: "Лендінг під рекламу",
    description:
      "Створення промосторінки для рекламної кампанії з формою заявки та базовою аналітикою.",
    base_price: 22000,
    unit: "за проєкт",
    status: "активна",
    position_id: 7,
    position_name: "Web-розробник",
  },
  {
    service_id: 8,
    service_name: "Email-розсилка",
    description:
      "Підготовка шаблону, сегментація бази, запуск розсилки та перевірка результатів.",
    base_price: 4500,
    unit: "за розсилку",
    status: "неактивна",
    position_id: 3,
    position_name: "Контент-менеджер",
  },
  {
    service_id: 9,
    service_name: "Аналітичний звіт",
    description:
      "Підготовка звіту за рекламними кампаніями: покази, кліки, CTR, витрати та рекомендації.",
    base_price: 3500,
    unit: "за звіт",
    status: "активна",
    position_id: 4,
    position_name: "Таргетолог",
  },
];

const statusOptions: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Всі статуси" },
  { id: "активна", label: "Активні" },
  { id: "неактивна", label: "Неактивні" },
];

const cx = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(" ");

function formatMoney(value: number) {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function getServiceIcon(name: string) {
  const lower = name.toLowerCase();

  if (lower.includes("smm")) return "forum";
  if (lower.includes("таргет")) return "ads_click";
  if (lower.includes("google")) return "search";
  if (lower.includes("дизайн")) return "draw";
  if (lower.includes("стратег")) return "schema";
  if (lower.includes("seo")) return "travel_explore";
  if (lower.includes("ленд")) return "web";
  if (lower.includes("email")) return "mail";
  if (lower.includes("звіт")) return "query_stats";

  return "design_services";
}

function statusClass(status: string) {
  if (status === "активна") return styles.toneGreen;
  if (status === "неактивна") return styles.toneNeutral;

  return styles.toneNeutral;
}

export default function ServicesPage() {
  const { role } = useDashboard();

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [position, setPosition] = useState("all");

  const positions = useMemo(() => {
    return Array.from(new Set(services.map((service) => service.position_name)));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return services.filter((service) => {
      const matchStatus = status === "all" || service.status === status;
      const matchPosition = position === "all" || service.position_name === position;

      const matchQuery =
        !q ||
        service.service_name.toLowerCase().includes(q) ||
        service.description.toLowerCase().includes(q) ||
        service.position_name.toLowerCase().includes(q);

      return matchStatus && matchPosition && matchQuery;
    });
  }, [position, query, status]);

  const totals = useMemo(() => {
    const active = filtered.filter((service) => service.status === "активна").length;
    const inactive = filtered.filter(
      (service) => service.status === "неактивна"
    ).length;

    const averagePrice = filtered.length
      ? filtered.reduce((sum, service) => sum + service.base_price, 0) /
        filtered.length
      : 0;

    const maxPrice = filtered.reduce(
      (max, service) => Math.max(max, service.base_price),
      0
    );

    return {
      active,
      inactive,
      averagePrice,
      maxPrice,
    };
  }, [filtered]);

  if (!allowedRoles.includes(role)) {
    return (
      <div className={styles.denied}>
        <span className="material-symbols-rounded">lock</span>
        <h2>Немає доступу</h2>
        <p>Розділ «Послуги» доступний лише директору рекламної агенції.</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1>Послуги</h1>
          <p>Каталог послуг агентства з базовими цінами та відповідальними ролями</p>
        </div>

        <button className={styles.addButton} type="button">
          <span className="material-symbols-rounded">add</span>
          Нова послуга
        </button>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.search}>
          <span className="material-symbols-rounded">search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="text"
            placeholder="Пошук за назвою, описом або роллю..."
          />
        </div>

        <div className={styles.filterSelect}>
          <span className="material-symbols-rounded">toggle_on</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            {statusOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterSelect}>
          <span className="material-symbols-rounded">badge</span>
          <select
            value={position}
            onChange={(event) => setPosition(event.target.value)}
          >
            <option value="all">Всі ролі</option>
            {positions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            <span className="material-symbols-rounded">design_services</span>
          </span>

          <div>
            <p>У каталозі</p>
            <strong>{filtered.length}</strong>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            <span className="material-symbols-rounded">check_circle</span>
          </span>

          <div>
            <p>Активні</p>
            <strong>{totals.active}</strong>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            <span className="material-symbols-rounded">payments</span>
          </span>

          <div>
            <p>Середня ціна</p>
            <strong>{formatMoney(totals.averagePrice)} ₴</strong>
          </div>
        </article>

        <article className={styles.summaryCard}>
          <span className={styles.summaryIcon}>
            <span className="material-symbols-rounded">trending_up</span>
          </span>

          <div>
            <p>Найвища ціна</p>
            <strong>{formatMoney(totals.maxPrice)} ₴</strong>
          </div>
        </article>
      </section>

      {filtered.length > 0 ? (
        <section className={styles.serviceGrid}>
          {filtered.map((service) => (
            <article className={styles.card} key={service.service_id}>
              <div className={styles.cardTop}>
                <span className={styles.serviceIcon}>
                  <span className="material-symbols-rounded">
                    {getServiceIcon(service.service_name)}
                  </span>
                </span>

                <span className={cx(styles.badge, statusClass(service.status))}>
                  {service.status}
                </span>
              </div>

              <div className={styles.cardBody}>
                <h2>{service.service_name}</h2>
                <p>{service.description}</p>
              </div>

              <div className={styles.cardMeta}>
                <div>
                  <span>Базова ціна</span>
                  <strong>{formatMoney(service.base_price)} ₴</strong>
                  <small>{service.unit}</small>
                </div>

                <div>
                  <span>Виконує роль</span>
                  <strong>{service.position_name}</strong>
                  <small>position_id: {service.position_id}</small>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span>service_id: {service.service_id}</span>

                <button className={styles.rowAction} type="button">
                  <span className="material-symbols-rounded">edit</span>
                  Редагувати
                </button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className={styles.empty}>
          <span className="material-symbols-rounded">design_services</span>
          <p>Послуги за вибраними умовами не знайдено.</p>
        </div>
      )}
    </div>
  );
}