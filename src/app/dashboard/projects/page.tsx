"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role, useDashboard } from "../layout";
import styles from "./page.module.css";

type ProjectStatus =
  | "новий"
  | "в роботі"
  | "матеріали погоджено"
  | "завершено"
  | "зупинено"
  | "скасовано";

type Tone = "info" | "amber" | "green" | "neutral" | "red";
type ModalMode = "create" | "edit";
type NoticeType = "success" | "error";

type Project = {
  project_id: number;
  brief_id: number;
  project_name: string;
  start_date: string;
  end_date: string | null;
  status: string;

  client_id: number;
  client_name: string;
  client_company: string;
  client_status?: string;

  category: string;
  brief_status?: string;
  requirement_desc?: string;
  budget?: number;

  is_final?: boolean;
  can_edit?: boolean;
  can_cancel?: boolean;
  can_finish?: boolean;
};

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
};

type ProjectForm = {
  brief_id: string;
  project_name: string;
  start_date: string;
  end_date: string;
  status: ProjectStatus;
};

type ApiProjectsResponse = {
  ok: boolean;
  data?: Project[];
  message?: string;
};

type ApiProjectResponse = {
  ok: boolean;
  data?: Project | null;
  message?: string;
};

type ApiBriefsResponse = {
  ok: boolean;
  data?: Brief[];
  message?: string;
};

const allowedRoles: Role[] = ["director", "manager", "client"];
const CURRENT_CLIENT_ID = 1;

const finalStatuses: ProjectStatus[] = ["завершено", "зупинено", "скасовано"];

const statusOptions: { id: ProjectStatus; label: string; tone: Tone; hint: string }[] = [
  {
    id: "новий",
    label: "Новий",
    tone: "info",
    hint: "Проєкт створено, але робота ще не почалась",
  },
  {
    id: "в роботі",
    label: "В роботі",
    tone: "amber",
    hint: "Команда виконує задачі по проєкту",
  },
  {
    id: "матеріали погоджено",
    label: "Матеріали погоджено",
    tone: "green",
    hint: "Клієнт погодив матеріали або ключовий етап",
  },
  {
    id: "завершено",
    label: "Завершено",
    tone: "neutral",
    hint: "Проєкт завершено, дата завершення обовʼязкова",
  },
  {
    id: "зупинено",
    label: "Зупинено",
    tone: "red",
    hint: "Проєкт зупинено, дата завершення обовʼязкова",
  },
  {
    id: "скасовано",
    label: "Скасовано",
    tone: "red",
    hint: "Проєкт скасовано без фізичного видалення",
  },
];

const allowedTransitions: Record<ProjectStatus, ProjectStatus[]> = {
  новий: ["новий", "в роботі", "скасовано"],
  "в роботі": ["в роботі", "матеріали погоджено", "зупинено", "скасовано"],
  "матеріали погоджено": [
    "матеріали погоджено",
    "в роботі",
    "завершено",
    "зупинено",
    "скасовано",
  ],
  завершено: ["завершено"],
  зупинено: ["зупинено"],
  скасовано: ["скасовано"],
};

const emptyForm: ProjectForm = {
  brief_id: "",
  project_name: "",
  start_date: "",
  end_date: "",
  status: "новий",
};

const dotClass: Record<Tone, string> = {
  info: styles.dotInfo,
  amber: styles.dotAmber,
  green: styles.dotGreen,
  neutral: styles.dotNeutral,
  red: styles.dotRed,
};

const accentClass: Record<Tone, string> = {
  info: styles.accentInfo,
  amber: styles.accentAmber,
  green: styles.accentGreen,
  neutral: styles.accentNeutral,
  red: styles.accentRed,
};

const cx = (...classes: (string | false | undefined)[]) =>
  classes.filter(Boolean).join(" ");

function getTodayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeProjectNameInput(value: string) {
  return value
    .replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9'ʼ`\-.,&() /№\s]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 150);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const normalized = value.includes("T") ? value.split("T")[0] : value;
  const [year, month, day] = normalized.split("-");

  if (!year || !month || !day) {
    return "—";
  }

  return `${day}.${month}.${year}`;
}

function formatMoney(value?: number) {
  return "₴ " + String(Math.round(Number(value || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function isRealISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isProjectStatus(value: string): value is ProjectStatus {
  return statusOptions.some((status) => status.id === value);
}

function isFinalStatus(status: string) {
  return finalStatuses.includes(status as ProjectStatus);
}

function getStatusMeta(status: string) {
  return (
    statusOptions.find((item) => item.id === status) || {
      id: "новий",
      label: status || "Невідомо",
      tone: "neutral" as Tone,
      hint: "Невідомий статус",
    }
  );
}

function getProjectCapabilities(project: Project) {
  const final = Boolean(project.is_final) || isFinalStatus(project.status);

  return {
    isFinal: final,
    canEdit: project.can_edit !== undefined ? project.can_edit : !final,
    canCancel: project.can_cancel !== undefined ? project.can_cancel : !final,
    canFinish:
      project.can_finish !== undefined
        ? project.can_finish
        : ["в роботі", "матеріали погоджено"].includes(project.status),
  };
}

function getAvailableStatusOptions(project: Project | null) {
  if (!project) {
    return statusOptions.filter((item) => item.id === "новий");
  }

  const currentStatus = isProjectStatus(project.status)
    ? project.status
    : "новий";

  const allowed = allowedTransitions[currentStatus] || [currentStatus];

  return statusOptions.filter((item) => allowed.includes(item.id));
}

function validateProjectForm(
  form: ProjectForm,
  mode: ModalMode,
  editingProject: Project | null
) {
  const briefId = Number(form.brief_id);
  const projectName = normalizeSpaces(form.project_name);
  const startDate = form.start_date;
  const endDate = form.end_date.trim();
  const status = form.status;
  const capabilities = editingProject ? getProjectCapabilities(editingProject) : null;

  if (mode === "create" && (!Number.isInteger(briefId) || briefId <= 0)) {
    return "Оберіть бриф, на основі якого створюється проєкт.";
  }

  if (projectName.length < 3) {
    return "Назва проєкту має містити мінімум 3 символи.";
  }

  if (projectName.length > 150) {
    return "Назва проєкту не може бути довшою за 150 символів.";
  }

  if (!/^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9'ʼ`\-.,&() /№\s]+$/.test(projectName)) {
    return "Назва проєкту містить недопустимі символи.";
  }

  if (!isRealISODate(startDate)) {
    return "Вкажіть коректну дату початку проєкту.";
  }

  if (endDate && !isRealISODate(endDate)) {
    return "Вкажіть коректну дату завершення проєкту.";
  }

  if (endDate && endDate < startDate) {
    return "Дата завершення не може бути раніше дати початку.";
  }

  if (!isProjectStatus(status)) {
    return "Оберіть коректний статус проєкту.";
  }

  if (mode === "create" && status !== "новий") {
    return "Новий проєкт створюється тільки зі статусом «новий».";
  }

  if (isFinalStatus(status) && !endDate) {
    return "Для статусів «завершено», «зупинено» або «скасовано» потрібно вказати дату завершення.";
  }

  if (mode === "edit" && editingProject && capabilities?.isFinal) {
    return "Фінальний проєкт заблоковано від редагування, щоб не порушити історію CRM.";
  }

  if (mode === "edit" && editingProject && isProjectStatus(editingProject.status)) {
    const allowed = allowedTransitions[editingProject.status];

    if (!allowed.includes(status)) {
      return `Некоректний перехід статусу: «${editingProject.status}» → «${status}».`;
    }
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

export default function ProjectsPage() {
  const { role } = useDashboard();

  const [projects, setProjects] = useState<Project[]>([]);
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const [form, setForm] = useState<ProjectForm>({
    ...emptyForm,
    start_date: getTodayISO(),
  });

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [detailsProject, setDetailsProject] = useState<Project | null>(null);

  const [cancelProject, setCancelProject] = useState<Project | null>(null);
  const [cancelError, setCancelError] = useState("");
  const [cancelSuccess, setCancelSuccess] = useState("");

  const [saving, setSaving] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const [pageNotice, setPageNotice] = useState<{
    type: NoticeType;
    text: string;
  } | null>(null);

  const isClient = role === "client";
  const canManage = role === "director" || role === "manager";

  async function loadProjects() {
    const response = await fetch("/api/projects", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiProjectsResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити проєкти.");
    }

    setProjects(result.data);
  }

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

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        await Promise.all([loadProjects(), loadBriefs()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Сталася помилка під час завантаження проєктів."
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

  function upsertProject(project: Project) {
    setProjects((current) => {
      const exists = current.some((item) => item.project_id === project.project_id);

      const next = exists
        ? current.map((item) =>
            item.project_id === project.project_id ? project : item
          )
        : [...current, project];

      return next.sort((a, b) => a.project_id - b.project_id);
    });
  }

  const visibleProjects = useMemo(() => {
    return isClient
      ? projects.filter((project) => project.client_id === CURRENT_CLIENT_ID)
      : projects;
  }, [isClient, projects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return visibleProjects.filter((project) => {
      return (
        !q ||
        project.project_name.toLowerCase().includes(q) ||
        project.client_name.toLowerCase().includes(q) ||
        project.client_company.toLowerCase().includes(q) ||
        project.category.toLowerCase().includes(q) ||
        project.status.toLowerCase().includes(q)
      );
    });
  }, [query, visibleProjects]);

  const availableBriefs = useMemo(() => {
    return briefs.filter((brief) => {
      const hasProject = Boolean(brief.has_project) || Number(brief.project_count || 0) > 0;
      const clientIsAllowed = !isClient || brief.client_id === CURRENT_CLIENT_ID;
      const canCreate =
        Boolean(brief.can_create_project) ||
        (brief.status === "нове" && brief.client_status === "активний" && !hasProject);

      return clientIsAllowed && canCreate;
    });
  }, [briefs, isClient]);

  const totals = useMemo(() => {
    const active = visibleProjects.filter((project) => !isFinalStatus(project.status)).length;
    const final = visibleProjects.filter((project) => isFinalStatus(project.status)).length;
    const budget = visibleProjects.reduce(
      (sum, project) => sum + Number(project.budget || 0),
      0
    );

    return {
      total: visibleProjects.length,
      active,
      final,
      budget,
      availableBriefs: availableBriefs.length,
    };
  }, [availableBriefs.length, visibleProjects]);

  function openCreateModal() {
    setModalMode("create");
    setEditingProjectId(null);
    setEditingProject(null);
    setForm({
      ...emptyForm,
      brief_id: "",
      start_date: getTodayISO(),
      status: "новий",
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function openEditModal(project: Project) {
    const safeStatus = isProjectStatus(project.status) ? project.status : "новий";

    setModalMode("edit");
    setEditingProjectId(project.project_id);
    setEditingProject(project);
    setForm({
      brief_id: String(project.brief_id),
      project_name: project.project_name,
      start_date: project.start_date,
      end_date: project.end_date || "",
      status: safeStatus,
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setModalMode("create");
    setEditingProjectId(null);
    setEditingProject(null);
    setForm({
      ...emptyForm,
      start_date: getTodayISO(),
    });
    setFormError("");
    setFormSuccess("");
  }

  function updateForm<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setFormError("");
    setFormSuccess("");
  }

  async function handleSaveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const preparedForm: ProjectForm = {
      ...form,
      project_name: normalizeSpaces(form.project_name),
      end_date: form.end_date.trim(),
      status: modalMode === "create" ? "новий" : form.status,
    };

    const validationError = validateProjectForm(
      preparedForm,
      modalMode,
      editingProject
    );

    if (validationError) {
      setForm(preparedForm);
      setFormError(validationError);
      return;
    }

    const isEditing = modalMode === "edit";

    if (isEditing && !editingProjectId) {
      setFormError("Не вдалося визначити проєкт для редагування.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setFormSuccess("");

      const response = await fetch(
        isEditing ? `/api/projects/${editingProjectId}` : "/api/projects",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            brief_id: Number(preparedForm.brief_id),
            project_name: preparedForm.project_name,
            start_date: preparedForm.start_date,
            end_date: preparedForm.end_date || null,
            status: preparedForm.status,
          }),
        }
      );

      const result = await readApiJson<ApiProjectResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(
          result.message ||
            (isEditing
              ? "Не вдалося оновити проєкт."
              : "Не вдалося створити проєкт.")
        );
      }

      upsertProject(result.data);

      if (isEditing) {
        setEditingProject(result.data);
        setFormSuccess("Дані проєкту успішно оновлено в PostgreSQL.");
        showPageNotice("success", "Дані проєкту оновлено.");
      } else {
        await loadBriefs();

        setForm({
          ...emptyForm,
          start_date: getTodayISO(),
        });
        setFormSuccess(
          "Проєкт створено. Повʼязаний бриф автоматично переведено у статус «прийнято»."
        );
        showPageNotice(
          "success",
          "Проєкт створено, бриф переведено у статус «прийнято»."
        );
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час збереження проєкту."
      );
    } finally {
      setSaving(false);
    }
  }

  function requestCancelProject(project: Project) {
    const capabilities = getProjectCapabilities(project);

    if (!capabilities.canCancel) {
      showPageNotice(
        "error",
        isFinalStatus(project.status)
          ? "Фінальний проєкт не можна скасувати повторно."
          : "Цей проєкт не можна скасувати."
      );
      return;
    }

    setCancelProject(project);
    setCancelError("");
    setCancelSuccess("");
  }

  function closeCancelModal() {
    if (canceling) return;

    setCancelProject(null);
    setCancelError("");
    setCancelSuccess("");
  }

  async function confirmCancelProject() {
    if (!cancelProject) return;

    try {
      setCanceling(true);
      setCancelError("");
      setCancelSuccess("");

      const response = await fetch(`/api/projects/${cancelProject.project_id}`, {
        method: "DELETE",
      });

      const result = await readApiJson<ApiProjectResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Не вдалося скасувати проєкт.");
      }

      upsertProject(result.data);

      setCancelSuccess(
        "Проєкт переведено у статус «скасовано». Запис залишився в історії CRM."
      );

      showPageNotice(
        "success",
        "Проєкт скасовано без фізичного видалення з бази."
      );

      window.setTimeout(() => {
        setCancelProject(null);
        setCancelSuccess("");
      }, 900);
    } catch (err) {
      setCancelError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час зміни статусу проєкту."
      );
    } finally {
      setCanceling(false);
    }
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className={styles.denied}>
        <span className="material-symbols-rounded">lock</span>
        <h2>Немає доступу</h2>
        <p>Розділ «Проєкти» доступний для клієнта, акаунт-менеджера та директора.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.emptyState}>
        <span className="material-symbols-rounded">sync</span>
        <p>Завантажуємо проєкти з PostgreSQL...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.emptyState}>
        <span className="material-symbols-rounded">error</span>
        <p>{error}</p>
      </div>
    );
  }

  const modalTitle =
    modalMode === "create" ? "Створити проєкт" : "Редагувати проєкт";

  const modalDescription =
    modalMode === "create"
      ? "Оберіть доступний бриф і створіть проєкт. Після створення бриф автоматично стане «прийнято»."
      : "Оновіть дані проєкту. Фінальні проєкти заблоковані від редагування.";

  const editingCapabilities = editingProject
    ? getProjectCapabilities(editingProject)
    : null;

  const modalStatusOptions = getAvailableStatusOptions(editingProject);

  return (
    <>
      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h1>Проєкти</h1>
            <p>
              {isClient ? "Ваші проєкти та їхні статуси" : "Усі проєкти агенції"} ·
              Усього: {totals.total} · Активних: {totals.active} · Архівних:{" "}
              {totals.final}
            </p>
          </div>

          {canManage && (
            <button className={styles.addButton} type="button" onClick={openCreateModal}>
              <span className="material-symbols-rounded">add_task</span>
              Створити проєкт
            </button>
          )}
        </header>

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">dashboard_customize</span>
            </span>
            <div>
              <p>Усього</p>
              <strong>{totals.total}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">play_circle</span>
            </span>
            <div>
              <p>Активні</p>
              <strong>{totals.active}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">description</span>
            </span>
            <div>
              <p>Доступні брифи</p>
              <strong>{totals.availableBriefs}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">payments</span>
            </span>
            <div>
              <p>Бюджет брифів</p>
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
              placeholder="Пошук за назвою, клієнтом, компанією, категорією або статусом..."
            />
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

        <div className={styles.board}>
          {statusOptions.map((column) => {
            const cards = filtered.filter((project) => project.status === column.id);

            return (
              <section className={styles.column} key={column.id}>
                <div className={styles.columnHead}>
                  <span className={styles.columnTitle}>
                    <span className={cx(styles.dot, dotClass[column.tone])} />
                    {column.label}
                  </span>
                  <span className={styles.count}>{cards.length}</span>
                </div>

                <div className={styles.columnHint}>{column.hint}</div>

                <div className={styles.columnCards}>
                  {cards.length > 0 ? (
                    cards.map((project) => {
                      const meta = getStatusMeta(project.status);

                      return (
                        <article
                          className={cx(styles.card, accentClass[meta.tone])}
                          key={project.project_id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setDetailsProject(project)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              setDetailsProject(project);
                            }
                          }}
                        >
                          <strong className={styles.cardName}>
                            {project.project_name}
                          </strong>

                          <span className={styles.cardClient}>
                            <span className="material-symbols-rounded">apartment</span>
                            {project.client_company || project.client_name}
                          </span>

                          <span className={styles.cardCategory}>
                            {project.category}
                          </span>

                          <div className={styles.cardDates}>
                            <span className="material-symbols-rounded">date_range</span>
                            {formatDate(project.start_date)} —{" "}
                            {formatDate(project.end_date)}
                          </div>

                          <div className={styles.cardFooter}>
                            <span className={styles.cardBudget}>
                              {formatMoney(project.budget)}
                            </span>
                            <span className={styles.cardLink}>Деталі</span>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className={styles.columnEmpty}>Немає проєктів</div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeModal}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>
                  {modalMode === "create"
                    ? "Новий запис PostgreSQL"
                    : "Оновлення запису PostgreSQL"}
                </span>

                <h2 id="project-modal-title">{modalTitle}</h2>
                <p>{modalDescription}</p>
              </div>

              <button className={styles.modalClose} type="button" onClick={closeModal}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSaveProject} noValidate>
              {modalMode === "create" && availableBriefs.length === 0 && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">info</span>
                  Немає доступних брифів для створення проєкту. Бриф має бути новим,
                  активного клієнта і без уже створеного проєкту.
                </div>
              )}

              {editingCapabilities?.isFinal && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">lock</span>
                  Цей проєкт знаходиться у фінальному статусі. Редагування заблоковано,
                  щоб не порушити історію CRM.
                </div>
              )}

              <div className={styles.formGrid}>
                <label className={cx(styles.field, styles.fieldWide)}>
                  <span>Бриф</span>

                  <select
                    value={form.brief_id}
                    onChange={(event) => updateForm("brief_id", event.target.value)}
                    disabled={modalMode === "edit" || Boolean(editingCapabilities?.isFinal)}
                  >
                    <option value="">Оберіть бриф</option>

                    {modalMode === "create" &&
                      availableBriefs.map((brief) => (
                        <option value={brief.brief_id} key={brief.brief_id}>
                          #{brief.brief_id} · {brief.client_name} · {brief.category} ·{" "}
                          {formatMoney(brief.budget)}
                        </option>
                      ))}

                    {modalMode === "edit" && editingProject && (
                      <option value={editingProject.brief_id}>
                        #{editingProject.brief_id} · {editingProject.client_name} ·{" "}
                        {editingProject.category}
                      </option>
                    )}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Назва проєкту</span>
                  <input
                    value={form.project_name}
                    onChange={(event) =>
                      updateForm(
                        "project_name",
                        normalizeProjectNameInput(event.target.value)
                      )
                    }
                    onBlur={() =>
                      updateForm("project_name", normalizeSpaces(form.project_name))
                    }
                    type="text"
                    placeholder="Наприклад: Запуск рекламної кампанії"
                    maxLength={150}
                    disabled={Boolean(editingCapabilities?.isFinal)}
                  />
                </label>

                <label className={styles.field}>
                  <span>Статус</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm("status", event.target.value as ProjectStatus)
                    }
                    disabled={modalMode === "create" || Boolean(editingCapabilities?.isFinal)}
                  >
                    {modalStatusOptions.map((status) => (
                      <option value={status.id} key={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Дата початку</span>
                  <input
                    value={form.start_date}
                    onChange={(event) => updateForm("start_date", event.target.value)}
                    type="date"
                    disabled={Boolean(editingCapabilities?.isFinal)}
                  />
                </label>

                <label className={styles.field}>
                  <span>Дата завершення</span>
                  <input
                    value={form.end_date}
                    onChange={(event) => updateForm("end_date", event.target.value)}
                    type="date"
                    min={form.start_date || undefined}
                    disabled={Boolean(editingCapabilities?.isFinal)}
                  />
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

                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={
                    saving ||
                    Boolean(editingCapabilities?.isFinal) ||
                    (modalMode === "create" && availableBriefs.length === 0)
                  }
                >
                  <span className="material-symbols-rounded">
                    {saving ? "sync" : modalMode === "create" ? "add_task" : "save"}
                  </span>
                  {saving
                    ? "Збереження..."
                    : modalMode === "create"
                    ? "Створити проєкт"
                    : "Зберегти зміни"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailsProject && (
        <div className={styles.modalOverlay} onMouseDown={() => setDetailsProject(null)}>
          <section
            className={cx(styles.modal, styles.detailsModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>Деталі проєкту</span>
                <h2 id="project-details-title">{detailsProject.project_name}</h2>
                <p>
                  {detailsProject.client_name} · {detailsProject.client_company} ·{" "}
                  {detailsProject.category}
                </p>
              </div>

              <button
                className={styles.modalClose}
                type="button"
                onClick={() => setDetailsProject(null)}
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <div className={styles.detailsBody}>
              <div className={styles.detailsGrid}>
                <div>
                  <small>Статус</small>
                  <span
                    className={cx(
                      styles.statusPill,
                      styles[`status_${getStatusMeta(detailsProject.status).tone}`]
                    )}
                  >
                    {detailsProject.status}
                  </span>
                </div>

                <div>
                  <small>Бриф</small>
                  <strong>#{detailsProject.brief_id}</strong>
                </div>

                <div>
                  <small>Бюджет брифу</small>
                  <strong>{formatMoney(detailsProject.budget)}</strong>
                </div>

                <div>
                  <small>Дата початку</small>
                  <strong>{formatDate(detailsProject.start_date)}</strong>
                </div>

                <div>
                  <small>Дата завершення</small>
                  <strong>{formatDate(detailsProject.end_date)}</strong>
                </div>

                <div>
                  <small>Клієнт</small>
                  <strong>{detailsProject.client_name}</strong>
                </div>
              </div>

              <div className={styles.detailsText}>
                <small>Опис вимог з брифу</small>
                <p>{detailsProject.requirement_desc || "Опис не вказано."}</p>
              </div>

              {canManage && (
                <div className={styles.modalActions}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => {
                      setDetailsProject(null);
                      openEditModal(detailsProject);
                    }}
                    disabled={!getProjectCapabilities(detailsProject).canEdit}
                  >
                    <span className="material-symbols-rounded">edit</span>
                    Редагувати
                  </button>

                  <button
                    className={styles.dangerButton}
                    type="button"
                    onClick={() => {
                      setDetailsProject(null);
                      requestCancelProject(detailsProject);
                    }}
                    disabled={!getProjectCapabilities(detailsProject).canCancel}
                  >
                    <span className="material-symbols-rounded">block</span>
                    Скасувати проєкт
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {cancelProject && (
        <div className={styles.modalOverlay} onMouseDown={closeCancelModal}>
          <section
            className={cx(styles.modal, styles.confirmModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-project-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <span className="material-symbols-rounded">
                {cancelSuccess ? "check_circle" : "block"}
              </span>
            </div>

            <div className={styles.confirmContent}>
              <span className={styles.modalKicker}>Зміна статусу в PostgreSQL</span>

              <h2 id="cancel-project-title">Скасувати проєкт?</h2>

              <p>
                Проєкт <strong>«{cancelProject.project_name}»</strong> буде
                переведений у статус <strong>«скасовано»</strong>.
              </p>

              <p className={styles.confirmNote}>
                Запис не буде видалено фізично з бази. Це потрібно, щоб зберегти
                історію задач, кампаній, рахунків і оплат.
              </p>

              {(cancelError || cancelSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    cancelError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {cancelError ? "error" : "check_circle"}
                  </span>
                  {cancelError || cancelSuccess}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={closeCancelModal}
                disabled={canceling}
              >
                Скасувати
              </button>

              <button
                className={styles.dangerButton}
                type="button"
                onClick={confirmCancelProject}
                disabled={canceling || Boolean(cancelSuccess)}
              >
                <span className="material-symbols-rounded">
                  {canceling ? "sync" : "block"}
                </span>
                {canceling ? "Оновлення..." : "Так, скасувати"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}