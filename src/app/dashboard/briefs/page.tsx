"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role, useDashboard } from "../layout";
import styles from "./page.module.css";

type BriefStatus = "нове" | "в роботі" | "прийнято" | "відхилено";
type BriefCategory =
  | "SMM"
  | "Google Ads"
  | "Branding"
  | "SEO"
  | "Meta Ads"
  | "Комплексна реклама";

type StatusFilter = "all" | BriefStatus;
type ModalMode = "create" | "edit";
type NoticeType = "success" | "error";

type Brief = {
  brief_id: number;
  client_id: number;
  client_name: string;
  client_company: string;
  client_status?: string;
  category: string;
  requirement_desc: string;
  budget: number;
  created_date: string;
  status: string;
  project_count?: number;
  has_project?: boolean;
  can_create_project?: boolean;
  can_edit_core?: boolean;
  can_reject?: boolean;
};

type Client = {
  client_id: number;
  full_name: string;
  company_name: string;
  phone: string;
  email: string;
  status: string;
};

type BriefForm = {
  client_id: string;
  category: string;
  requirement_desc: string;
  budget: string;
  status: BriefStatus;
};

type ApiBriefsResponse = {
  ok: boolean;
  data?: Brief[];
  message?: string;
};

type ApiBriefResponse = {
  ok: boolean;
  data?: Brief | null;
  message?: string;
};

type ApiClientsResponse = {
  ok: boolean;
  data?: Client[];
  message?: string;
};

const allowedRoles: Role[] = ["director", "manager", "client"];

const CURRENT_CLIENT_ID = 1;

const briefCategories: { id: BriefCategory; label: string; hint: string }[] = [
  {
    id: "SMM",
    label: "SMM",
    hint: "Соцмережі, контент-план, публікації",
  },
  {
    id: "Google Ads",
    label: "Google Ads",
    hint: "Пошукова та контекстна реклама Google",
  },
  {
    id: "Branding",
    label: "Branding",
    hint: "Айдентика, логотип, фірмовий стиль",
  },
  {
    id: "SEO",
    label: "SEO",
    hint: "Оптимізація сайту та органічне просування",
  },
  {
    id: "Meta Ads",
    label: "Meta Ads",
    hint: "Facebook / Instagram реклама",
  },
  {
    id: "Комплексна реклама",
    label: "Комплексна реклама",
    hint: "Повний digital-супровід і кілька каналів",
  },
];

const statusFilters: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Всі статуси" },
  { id: "нове", label: "Нові" },
  { id: "в роботі", label: "В роботі" },
  { id: "прийнято", label: "Прийняті" },
  { id: "відхилено", label: "Відхилені" },
];

const statusOptions: { id: BriefStatus; label: string; hint: string }[] = [
  {
    id: "нове",
    label: "Нове",
    hint: "Бриф тільки створено, проєкт ще не відкрито",
  },
  {
    id: "в роботі",
    label: "В роботі",
    hint: "Менеджер або директор обробляє заявку",
  },
  {
    id: "прийнято",
    label: "Прийнято",
    hint: "Бриф прийнято, на його основі може бути або вже створено проєкт",
  },
  {
    id: "відхилено",
    label: "Відхилено",
    hint: "Заявку відхилено без фізичного видалення з бази",
  },
];

const emptyForm: BriefForm = {
  client_id: "",
  category: "",
  requirement_desc: "",
  budget: "",
  status: "нове",
};

const cx = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(" ");

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatMoney(value: number) {
  return "₴ " + String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatDate(iso: string) {
  const normalized = iso.includes("T") ? iso.split("T")[0] : iso;
  const [year, month, day] = normalized.split("-");

  if (!year || !month || !day) {
    return "—";
  }

  return `${day}.${month}.${year}`;
}

function statusTone(status: string) {
  if (status === "прийнято") return styles.toneGreen;
  if (status === "в роботі") return styles.toneAmber;
  if (status === "відхилено") return styles.toneRed;
  return styles.toneInfo;
}

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeRequirementInput(value: string) {
  return value.replace(/\s{3,}/g, " ").slice(0, 500);
}

function normalizeBudgetInput(value: string) {
  const normalized = value
    .replace(/[^\d.,]/g, "")
    .replace(",", ".")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 12);

  const parts = normalized.split(".");

  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join("").slice(0, 2)}`;
  }

  if (parts[1]?.length > 2) {
    return `${parts[0]}.${parts[1].slice(0, 2)}`;
  }

  return normalized;
}

function parseBudget(value: string) {
  const prepared = value.replace(/\s/g, "").replace(",", ".");

  if (!/^\d+(\.\d{1,2})?$/.test(prepared)) {
    return null;
  }

  const budget = Number(prepared);

  if (!Number.isFinite(budget)) {
    return null;
  }

  return Math.round(budget * 100) / 100;
}

function isBriefCategory(value: string): value is BriefCategory {
  return briefCategories.some((item) => item.id === value);
}

function isBriefStatus(value: string): value is BriefStatus {
  return statusOptions.some((item) => item.id === value);
}

function getBriefCapabilities(brief: Brief) {
  const projectCount = brief.project_count ?? 0;
  const hasProject = Boolean(brief.has_project) || projectCount > 0;
  const clientIsActive = brief.client_status === "активний" || !brief.client_status;

  return {
    hasProject,
    projectCount,
    canCreateProject:
      Boolean(brief.can_create_project) ||
      (brief.status === "нове" && clientIsActive && !hasProject),
    canEditCore:
      brief.can_edit_core !== undefined ? brief.can_edit_core : !hasProject,
    canReject:
      brief.can_reject !== undefined
        ? brief.can_reject
        : !hasProject && brief.status !== "відхилено",
  };
}

function validateBriefForm(
  form: BriefForm,
  mode: ModalMode,
  editingBrief: Brief | null
) {
  const clientId = Number(form.client_id);
  const category = normalizeSpaces(form.category);
  const requirement = normalizeSpaces(form.requirement_desc);
  const budget = parseBudget(form.budget);
  const status = form.status;
  const capabilities = editingBrief ? getBriefCapabilities(editingBrief) : null;

  if (!Number.isInteger(clientId) || clientId <= 0) {
    return "Оберіть клієнта для брифу.";
  }

  if (!isBriefCategory(category)) {
    return "Оберіть категорію зі списку: SMM, Google Ads, Branding, SEO, Meta Ads або Комплексна реклама.";
  }

  if (requirement.length < 10) {
    return "Опис вимог має містити мінімум 10 символів.";
  }

  if (requirement.length > 500) {
    return "Опис вимог не може бути довшим за 500 символів.";
  }

  if (budget === null || budget < 100 || budget > 1000000) {
    return "Бюджет має бути числом від 100 до 1 000 000 грн, максимум з 2 знаками після коми.";
  }

  if (mode === "create" && status !== "нове") {
    return "Новий бриф створюється тільки зі статусом «нове».";
  }

  if (!isBriefStatus(status)) {
    return "Оберіть коректний статус брифу.";
  }

  if (mode === "edit" && capabilities?.hasProject && status !== "прийнято") {
    return "Якщо за брифом вже створено проєкт, статус брифу має бути «прийнято».";
  }

  return "";
}

async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "API повернув не JSON. Перевірте, чи існує route.ts і чи запущено npm run dev."
    );
  }

  return (await response.json()) as T;
}

export default function BriefsPage() {
  const { role } = useDashboard();

  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingBriefId, setEditingBriefId] = useState<number | null>(null);
  const [editingBrief, setEditingBrief] = useState<Brief | null>(null);

  const [form, setForm] = useState<BriefForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [detailsBrief, setDetailsBrief] = useState<Brief | null>(null);
  const [rejectBrief, setRejectBrief] = useState<Brief | null>(null);
  const [rejectError, setRejectError] = useState("");
  const [rejectSuccess, setRejectSuccess] = useState("");

  const [projectBrief, setProjectBrief] = useState<Brief | null>(null);

  const [saving, setSaving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const [pageNotice, setPageNotice] = useState<{
    type: NoticeType;
    text: string;
  } | null>(null);

  const isClient = role === "client";
  const canManage = role === "director" || role === "manager";

  async function loadBriefs() {
    const response = await fetch("/api/briefs", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiBriefsResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити брифи.");
    }

    setBriefs(result.data);
  }

  async function loadClients() {
    const response = await fetch("/api/clients", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiClientsResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити клієнтів.");
    }

    setClients(result.data);
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        await Promise.all([loadBriefs(), loadClients()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Сталася помилка під час завантаження брифів."
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  function showPageNotice(type: NoticeType, text: string) {
    setPageNotice({ type, text });

    window.setTimeout(() => {
      setPageNotice(null);
    }, 3800);
  }

  function upsertBrief(brief: Brief) {
    setBriefs((current) => {
      const exists = current.some((item) => item.brief_id === brief.brief_id);

      const next = exists
        ? current.map((item) => (item.brief_id === brief.brief_id ? brief : item))
        : [...current, brief];

      return next.sort((a, b) => a.brief_id - b.brief_id);
    });
  }

  const availableClients = useMemo(() => {
    if (isClient) {
      return clients.filter((client) => client.client_id === CURRENT_CLIENT_ID);
    }

    return clients.filter((client) => client.status === "активний");
  }, [clients, isClient]);

  const visibleBriefs = useMemo(() => {
    return isClient
      ? briefs.filter((brief) => brief.client_id === CURRENT_CLIENT_ID)
      : briefs;
  }, [briefs, isClient]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return visibleBriefs.filter((brief) => {
      const matchStatus = status === "all" || brief.status === status;

      const matchQuery =
        !q ||
        brief.client_name.toLowerCase().includes(q) ||
        brief.client_company.toLowerCase().includes(q) ||
        brief.category.toLowerCase().includes(q) ||
        brief.requirement_desc.toLowerCase().includes(q);

      return matchStatus && matchQuery;
    });
  }, [query, status, visibleBriefs]);

  const totals = useMemo(() => {
    const source = visibleBriefs;
    const budget = source.reduce((sum, brief) => sum + Number(brief.budget || 0), 0);

    return {
      total: source.length,
      newCount: source.filter((brief) => brief.status === "нове").length,
      inWork: source.filter((brief) => brief.status === "в роботі").length,
      accepted: source.filter((brief) => brief.status === "прийнято").length,
      rejected: source.filter((brief) => brief.status === "відхилено").length,
      budget,
    };
  }, [visibleBriefs]);

  function openCreateModal() {
    const clientId = isClient ? String(CURRENT_CLIENT_ID) : "";

    setModalMode("create");
    setEditingBriefId(null);
    setEditingBrief(null);
    setForm({
      ...emptyForm,
      client_id: clientId,
      status: "нове",
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function openEditModal(brief: Brief) {
    const capabilities = getBriefCapabilities(brief);

    setModalMode("edit");
    setEditingBriefId(brief.brief_id);
    setEditingBrief(brief);
    setForm({
      client_id: String(brief.client_id),
      category: brief.category,
      requirement_desc: brief.requirement_desc,
      budget: String(brief.budget),
      status: capabilities.hasProject ? "прийнято" : (brief.status as BriefStatus),
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setModalMode("create");
    setEditingBriefId(null);
    setEditingBrief(null);
    setForm(emptyForm);
    setFormError("");
    setFormSuccess("");
  }

  function updateForm<K extends keyof BriefForm>(key: K, value: BriefForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setFormError("");
    setFormSuccess("");
  }

  async function handleSaveBrief(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedBudget = parseBudget(form.budget);

    const preparedForm: BriefForm = {
      ...form,
      category: normalizeSpaces(form.category),
      requirement_desc: normalizeSpaces(form.requirement_desc),
      budget: parsedBudget === null ? form.budget : String(parsedBudget),
      status: modalMode === "create" ? "нове" : form.status,
    };

    const validationError = validateBriefForm(preparedForm, modalMode, editingBrief);

    if (validationError) {
      setForm(preparedForm);
      setFormError(validationError);
      return;
    }

    const isEditing = modalMode === "edit";

    if (isEditing && !editingBriefId) {
      setFormError("Не вдалося визначити бриф для редагування.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setFormSuccess("");

      const response = await fetch(
        isEditing ? `/api/briefs/${editingBriefId}` : "/api/briefs",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            client_id: Number(preparedForm.client_id),
            category: preparedForm.category,
            requirement_desc: preparedForm.requirement_desc,
            budget: Number(preparedForm.budget),
            status: preparedForm.status,
          }),
        }
      );

      const result = await readApiJson<ApiBriefResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(
          result.message ||
            (isEditing ? "Не вдалося оновити бриф." : "Не вдалося створити бриф.")
        );
      }

      upsertBrief(result.data);

      if (isEditing) {
        setFormSuccess("Дані брифу успішно оновлено в PostgreSQL.");
        setEditingBrief(result.data);
        showPageNotice("success", "Дані брифу оновлено.");
      } else {
        setForm({
          ...emptyForm,
          client_id: isClient ? String(CURRENT_CLIENT_ID) : "",
        });
        setFormSuccess(
          "Бриф успішно створено в PostgreSQL. Можете створити ще один або закрити вікно."
        );
        showPageNotice("success", "Новий бриф створено.");
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час збереження брифу."
      );
    } finally {
      setSaving(false);
    }
  }

  function requestRejectBrief(brief: Brief) {
    const capabilities = getBriefCapabilities(brief);

    if (!capabilities.canReject) {
      showPageNotice(
        "error",
        capabilities.hasProject
          ? "Бриф не можна відхилити, бо за ним вже створено проєкт."
          : "Цей бриф вже відхилено."
      );
      return;
    }

    setRejectBrief(brief);
    setRejectError("");
    setRejectSuccess("");
  }

  function closeRejectModal() {
    if (rejecting) return;

    setRejectBrief(null);
    setRejectError("");
    setRejectSuccess("");
  }

  async function confirmRejectBrief() {
    if (!rejectBrief) return;

    try {
      setRejecting(true);
      setRejectError("");
      setRejectSuccess("");

      const response = await fetch(`/api/briefs/${rejectBrief.brief_id}`, {
        method: "DELETE",
      });

      const result = await readApiJson<ApiBriefResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Не вдалося відхилити бриф.");
      }

      upsertBrief(result.data);

      setRejectSuccess(
        "Бриф переведено у статус «відхилено». Запис залишився в історії клієнта."
      );

      showPageNotice(
        "success",
        "Бриф відхилено без фізичного видалення з бази."
      );

      window.setTimeout(() => {
        setRejectBrief(null);
        setRejectSuccess("");
      }, 900);
    } catch (err) {
      setRejectError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час зміни статусу брифу."
      );
    } finally {
      setRejecting(false);
    }
  }

  function openProjectInfo(brief: Brief) {
    const capabilities = getBriefCapabilities(brief);

    if (!capabilities.canCreateProject) {
      showPageNotice(
        "error",
        capabilities.hasProject
          ? "За цим брифом вже створено проєкт."
          : "Проєкт можна створити тільки з нового брифу активного клієнта."
      );
      return;
    }

    setProjectBrief(brief);
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className={styles.denied}>
        <span className="material-symbols-rounded">lock</span>
        <h2>Немає доступу</h2>
        <p>Розділ «Брифи» доступний для клієнта, акаунт-менеджера та директора.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.empty}>
        <span className="material-symbols-rounded">sync</span>
        <p>Завантажуємо брифи з PostgreSQL...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.empty}>
        <span className="material-symbols-rounded">error</span>
        <p>{error}</p>
      </div>
    );
  }

  const modalTitle =
    modalMode === "create" ? "Створити бриф" : "Редагувати бриф";

  const modalDescription =
    modalMode === "create"
      ? "Заповніть заявку клієнта. Категорія і статус відповідають CHECK-обмеженням PostgreSQL."
      : "Оновіть дані брифу. Якщо за брифом вже створено проєкт, ключові дані захищені від зміни.";

  const editingCapabilities = editingBrief ? getBriefCapabilities(editingBrief) : null;

  return (
    <>
      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h1>Брифи</h1>
            <p>
              {isClient ? "Ваші заявки на послуги" : "Заявки клієнтів на послуги"} ·
              Усього: {totals.total} · Нових: {totals.newCount} · Бюджет:{" "}
              {formatMoney(totals.budget)}
            </p>
          </div>

          <button className={styles.addButton} type="button" onClick={openCreateModal}>
            <span className="material-symbols-rounded">add</span>
            {isClient ? "Створити заявку" : "Створити бриф"}
          </button>
        </header>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">description</span>
            </span>
            <div>
              <p>Усього</p>
              <strong>{totals.total}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">fiber_new</span>
            </span>
            <div>
              <p>Нові</p>
              <strong>{totals.newCount}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">pending_actions</span>
            </span>
            <div>
              <p>В роботі</p>
              <strong>{totals.inWork}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">payments</span>
            </span>
            <div>
              <p>Загальний бюджет</p>
              <strong>{formatMoney(totals.budget)}</strong>
            </div>
          </article>
        </section>

        <div className={styles.toolbar}>
          <div className={styles.search}>
            <span className="material-symbols-rounded">search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="text"
              placeholder="Пошук за клієнтом, компанією, категорією або описом..."
            />
          </div>

          <div className={styles.filterSelect}>
            <span className="material-symbols-rounded">filter_list</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
            >
              {statusFilters.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {pageNotice && (
          <div
            className={cx(
              styles.formMessage,
              pageNotice.type === "error"
                ? styles.formMessageError
                : styles.formMessageSuccess
            )}
          >
            <span className="material-symbols-rounded">
              {pageNotice.type === "error" ? "error" : "check_circle"}
            </span>
            {pageNotice.text}
          </div>
        )}

        {filtered.length > 0 ? (
          <div className={styles.grid}>
            {filtered.map((brief) => {
              const capabilities = getBriefCapabilities(brief);
              const canCreateProject = canManage && capabilities.canCreateProject;

              return (
                <article className={styles.card} key={brief.brief_id}>
                  <div className={styles.cardTop}>
                    <div className={styles.client}>
                      <span className={styles.avatar}>
                        {getInitials(brief.client_name)}
                      </span>

                      <div className={styles.clientText}>
                        <strong className={styles.clientName}>
                          {brief.client_name}
                        </strong>

                        {brief.client_company && (
                          <span className={styles.clientCompany}>
                            {brief.client_company}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={cx(styles.badge, statusTone(brief.status))}>
                      {brief.status}
                    </span>
                  </div>

                  <span className={styles.category}>
                    <span className="material-symbols-rounded">sell</span>
                    {brief.category}
                  </span>

                  <p className={styles.desc}>{brief.requirement_desc}</p>

                  <div className={styles.meta}>
                    <span className={styles.metaItem}>
                      <span className="material-symbols-rounded">payments</span>
                      {formatMoney(brief.budget)}
                    </span>

                    <span className={styles.metaItem}>
                      <span className="material-symbols-rounded">event</span>
                      {formatDate(brief.created_date)}
                    </span>
                  </div>

                  {capabilities.hasProject && (
                    <div className={styles.lockNote}>
                      <span className="material-symbols-rounded">lock</span>
                      За брифом вже створено проєкт. Клієнт, категорія, опис і
                      бюджет захищені від зміни.
                    </div>
                  )}

                  <div className={styles.actionStack}>
                    <button
                      className={cx(
                        styles.action,
                        canCreateProject && styles.actionPrimary
                      )}
                      type="button"
                      onClick={() =>
                        canCreateProject ? openProjectInfo(brief) : setDetailsBrief(brief)
                      }
                    >
                      <span className="material-symbols-rounded">
                        {canCreateProject ? "add_task" : "visibility"}
                      </span>
                      {canCreateProject ? "Створити проєкт" : "Деталі"}
                    </button>

                    {canManage && (
                      <div className={styles.secondaryActions}>
                        <button
                          className={styles.smallAction}
                          type="button"
                          onClick={() => openEditModal(brief)}
                        >
                          <span className="material-symbols-rounded">edit</span>
                          Редагувати
                        </button>

                        <button
                          className={styles.smallAction}
                          type="button"
                          onClick={() => requestRejectBrief(brief)}
                          disabled={!capabilities.canReject || rejecting}
                        >
                          <span className="material-symbols-rounded">block</span>
                          Відхилити
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>
            <span className="material-symbols-rounded">search_off</span>
            <p>Заявок за заданими умовами не знайдено.</p>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeModal}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="brief-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>
                  {modalMode === "create"
                    ? "Новий запис PostgreSQL"
                    : "Оновлення запису PostgreSQL"}
                </span>

                <h2 id="brief-modal-title">{modalTitle}</h2>
                <p>{modalDescription}</p>
              </div>

              <button className={styles.modalClose} type="button" onClick={closeModal}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSaveBrief} noValidate>
              {editingCapabilities?.hasProject && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">shield_lock</span>
                  За цим брифом вже створено проєкт. Клієнт, категорія, опис і бюджет
                  заблоковані, щоб не порушити історію CRM.
                </div>
              )}

              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Клієнт</span>
                  <select
                    value={form.client_id}
                    onChange={(event) => updateForm("client_id", event.target.value)}
                    disabled={isClient || Boolean(editingCapabilities?.hasProject)}
                  >
                    <option value="">Оберіть клієнта</option>

                    {availableClients.map((client) => (
                      <option value={client.client_id} key={client.client_id}>
                        {client.full_name} · {client.company_name || "Без компанії"}
                      </option>
                    ))}

                    {modalMode === "edit" &&
                      editingBrief &&
                      !availableClients.some(
                        (client) => client.client_id === editingBrief.client_id
                      ) && (
                        <option value={editingBrief.client_id}>
                          {editingBrief.client_name} · {editingBrief.client_company}
                        </option>
                      )}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Категорія</span>
                  <select
                    value={form.category}
                    onChange={(event) => updateForm("category", event.target.value)}
                    disabled={Boolean(editingCapabilities?.hasProject)}
                  >
                    <option value="">Оберіть категорію</option>

                    {briefCategories.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={cx(styles.field, styles.fieldWide)}>
                  <span>Опис вимог</span>
                  <textarea
                    value={form.requirement_desc}
                    onChange={(event) =>
                      updateForm(
                        "requirement_desc",
                        normalizeRequirementInput(event.target.value)
                      )
                    }
                    onBlur={() =>
                      updateForm(
                        "requirement_desc",
                        normalizeSpaces(form.requirement_desc)
                      )
                    }
                    placeholder="Опишіть задачу клієнта, очікуваний результат, канали просування, обмеження та побажання..."
                    maxLength={500}
                    disabled={Boolean(editingCapabilities?.hasProject)}
                  />
                  <small>{form.requirement_desc.length}/500 символів</small>
                </label>

                <label className={styles.field}>
                  <span>Бюджет, грн</span>
                  <input
                    value={form.budget}
                    onChange={(event) =>
                      updateForm("budget", normalizeBudgetInput(event.target.value))
                    }
                    type="text"
                    inputMode="decimal"
                    placeholder="Наприклад: 25000"
                    disabled={Boolean(editingCapabilities?.hasProject)}
                  />
                </label>

                <label className={styles.field}>
                  <span>Статус</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm("status", event.target.value as BriefStatus)
                    }
                    disabled={modalMode === "create"}
                  >
                    {statusOptions.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {(formError || formSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    formError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {formError ? "error" : "check_circle"}
                  </span>
                  {formError || formSuccess}
                </div>
              )}

              <div className={styles.modalActions}>
                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Скасувати
                </button>

                <button className={styles.primaryButton} type="submit" disabled={saving}>
                  <span className="material-symbols-rounded">
                    {saving ? "sync" : modalMode === "create" ? "add" : "save"}
                  </span>
                  {saving
                    ? "Збереження..."
                    : modalMode === "create"
                    ? "Створити бриф"
                    : "Зберегти зміни"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailsBrief && (
        <div className={styles.modalOverlay} onMouseDown={() => setDetailsBrief(null)}>
          <section
            className={cx(styles.modal, styles.detailsModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="brief-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>Деталі брифу</span>
                <h2 id="brief-details-title">{detailsBrief.category}</h2>
                <p>
                  Клієнт: {detailsBrief.client_name} · {detailsBrief.client_company}
                </p>
              </div>

              <button
                className={styles.modalClose}
                type="button"
                onClick={() => setDetailsBrief(null)}
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <div className={styles.detailsBody}>
              <div className={styles.detailsGrid}>
                <div>
                  <small>Статус</small>
                  <span className={cx(styles.badge, statusTone(detailsBrief.status))}>
                    {detailsBrief.status}
                  </span>
                </div>

                <div>
                  <small>Категорія</small>
                  <strong>{detailsBrief.category}</strong>
                </div>

                <div>
                  <small>Бюджет</small>
                  <strong>{formatMoney(detailsBrief.budget)}</strong>
                </div>

                <div>
                  <small>Дата створення</small>
                  <strong>{formatDate(detailsBrief.created_date)}</strong>
                </div>

                <div>
                  <small>Проєкти</small>
                  <strong>{detailsBrief.project_count ?? 0}</strong>
                </div>

                <div>
                  <small>Клієнт</small>
                  <strong>{detailsBrief.client_name}</strong>
                </div>
              </div>

              <div className={styles.detailsText}>
                <small>Опис вимог</small>
                <p>{detailsBrief.requirement_desc}</p>
              </div>
            </div>
          </section>
        </div>
      )}

      {rejectBrief && (
        <div className={styles.modalOverlay} onMouseDown={closeRejectModal}>
          <section
            className={cx(styles.modal, styles.confirmModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-brief-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <span className="material-symbols-rounded">
                {rejectSuccess ? "check_circle" : "block"}
              </span>
            </div>

            <div className={styles.confirmContent}>
              <span className={styles.modalKicker}>Зміна статусу в PostgreSQL</span>

              <h2 id="reject-brief-title">Відхилити бриф?</h2>

              <p>
                Бриф <strong>«{rejectBrief.category}»</strong> для клієнта{" "}
                <strong>{rejectBrief.client_name}</strong> буде переведений у статус{" "}
                <strong>«відхилено»</strong>.
              </p>

              <p className={styles.confirmNote}>
                Запис не буде видалено фізично з бази. Якщо по брифу вже створено
                проєкт, система не дозволить його відхилити.
              </p>

              {(rejectError || rejectSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    rejectError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {rejectError ? "error" : "check_circle"}
                  </span>
                  {rejectError || rejectSuccess}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={closeRejectModal}
                disabled={rejecting}
              >
                Скасувати
              </button>

              <button
                className={styles.dangerButton}
                type="button"
                onClick={confirmRejectBrief}
                disabled={rejecting || Boolean(rejectSuccess)}
              >
                <span className="material-symbols-rounded">
                  {rejecting ? "sync" : "block"}
                </span>
                {rejecting ? "Оновлення..." : "Так, відхилити"}
              </button>
            </div>
          </section>
        </div>
      )}

      {projectBrief && (
        <div className={styles.modalOverlay} onMouseDown={() => setProjectBrief(null)}>
          <section
            className={cx(styles.modal, styles.confirmModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-info-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <span className="material-symbols-rounded">add_task</span>
            </div>

            <div className={styles.confirmContent}>
              <span className={styles.modalKicker}>Наступний етап CRM</span>

              <h2 id="project-info-title">Створення проєкту</h2>

              <p>
                Бриф <strong>«{projectBrief.category}»</strong> готовий для створення
                проєкту.
              </p>

              <p className={styles.confirmNote}>
                Наступним кроком зробимо API проєктів: створення запису у таблиці
                project, привʼязка до brief_id і автоматичний перехід брифу у статус
                «прийнято».
              </p>
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={() => setProjectBrief(null)}
              >
                <span className="material-symbols-rounded">check</span>
                Зрозуміло
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}