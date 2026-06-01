"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role, useDashboard } from "../layout";
import styles from "./page.module.css";

type InvoiceStatus =
  | "виставлено"
  | "частково оплачено"
  | "оплачено"
  | "прострочено"
  | "скасовано";

type StatusFilter = "all" | InvoiceStatus;
type ModalMode = "create" | "edit";
type NoticeType = "success" | "error";
type InvoiceAction = "cancel" | "markOverdue";

type Invoice = {
  invoice_id: number;

  client_id: number;
  client_name: string;
  client_company: string;
  client_status: string;
  client_email: string | null;
  client_phone: string | null;

  project_id: number;
  project_name: string;
  project_status: string;
  project_start_date: string;
  project_end_date: string | null;

  brief_id: number;
  brief_budget: number;

  project_client_id: number;
  project_client_name: string;
  project_client_company: string;

  total_amount: number;
  issue_date: string;
  due_date: string;
  invoice_status: InvoiceStatus | string;
  effective_status: InvoiceStatus | string;

  is_overdue: boolean;
  days_to_due: number;
  is_locked: boolean;

  payment_summary_available: boolean;
  paid_amount: number | null;
  balance_amount: number | null;

  can_edit: boolean;
  can_cancel: boolean;
  can_mark_overdue: boolean;
  can_register_payment: boolean;
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
  category?: string;
  brief_budget?: number;
  budget?: number;
};

type InvoiceForm = {
  project_id: string;
  total_amount: string;
  issue_date: string;
  due_date: string;
  invoice_status: InvoiceStatus;
};

type ApiInvoicesResponse = {
  ok: boolean;
  data?: Invoice[];
  message?: string;
};

type ApiInvoiceResponse = {
  ok: boolean;
  data?: Invoice | null;
  message?: string;
};

type ApiProjectsResponse = {
  ok: boolean;
  data?: Project[];
  message?: string;
};

const allowedRoles: Role[] = ["director", "accountant", "client"];

const invoiceStatuses: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Всі статуси" },
  { id: "виставлено", label: "Виставлено" },
  { id: "частково оплачено", label: "Частково оплачено" },
  { id: "оплачено", label: "Оплачено" },
  { id: "прострочено", label: "Прострочено" },
  { id: "скасовано", label: "Скасовано" },
];

const paymentControlledStatuses: InvoiceStatus[] = [
  "частково оплачено",
  "оплачено",
];

const lockedInvoiceStatuses: InvoiceStatus[] = ["оплачено", "скасовано"];

const MAX_INVOICE_AMOUNT = 10_000_000;
const MAX_INVOICE_TERM_DAYS = 365;

const emptyForm: InvoiceForm = {
  project_id: "",
  total_amount: "",
  issue_date: "",
  due_date: "",
  invoice_status: "виставлено",
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

function addDaysISO(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().split("T")[0];
}

function toUTC(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(from: string, to: string) {
  const day = 24 * 60 * 60 * 1000;
  return Math.ceil((toUTC(to) - toUTC(from)) / day);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";

  const normalized = iso.includes("T") ? iso.split("T")[0] : iso;
  const [year, month, day] = normalized.split("-");

  if (!year || !month || !day) return "—";

  return `${day}.${month}.${year}`;
}

function isRealISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeMoneyInput(value: string) {
  const cleaned = value.replace(/[^\d.,]/g, "").replace(",", ".");
  const parts = cleaned.split(".");

  if (parts.length <= 1) return cleaned.slice(0, 10);

  return `${parts[0].slice(0, 10)}.${parts.slice(1).join("").slice(0, 2)}`;
}

function parseMoney(value: string) {
  const number = Number(value.replace(",", ".").trim());

  if (!Number.isFinite(number)) return Number.NaN;

  return Math.round(number * 100) / 100;
}

function isInvoiceStatus(value: string): value is InvoiceStatus {
  return [
    "виставлено",
    "частково оплачено",
    "оплачено",
    "прострочено",
    "скасовано",
  ].includes(value);
}

function isLockedInvoiceStatus(status: string) {
  return lockedInvoiceStatuses.includes(status as InvoiceStatus);
}

function isPaymentControlledStatus(status: string) {
  return paymentControlledStatuses.includes(status as InvoiceStatus);
}

function getStatusClass(status: string) {
  if (status === "виставлено") return styles.toneInfo;
  if (status === "частково оплачено") return styles.toneAmber;
  if (status === "оплачено") return styles.toneGreen;
  if (status === "прострочено") return styles.toneRed;
  if (status === "скасовано") return styles.toneNeutral;

  return styles.toneNeutral;
}

function getDueLabel(invoice: Invoice) {
  if (invoice.invoice_status === "оплачено") return "Оплачено";
  if (invoice.invoice_status === "скасовано") return "Скасовано";

  const days = daysBetween(getTodayISO(), invoice.due_date);

  if (days < 0) return `Прострочено на ${Math.abs(days)} дн.`;
  if (days === 0) return "Оплатити сьогодні";

  return `${days} дн. до оплати`;
}

function getAvailableStatusOptions(invoice: Invoice | null) {
  if (!invoice) {
    return [{ id: "виставлено" as InvoiceStatus, label: "Виставлено" }];
  }

  const currentStatus = isInvoiceStatus(invoice.invoice_status)
    ? invoice.invoice_status
    : "виставлено";

  if (currentStatus === "виставлено") {
    const options = [{ id: "виставлено" as InvoiceStatus, label: "Виставлено" }];

    if (invoice.due_date < getTodayISO()) {
      options.push({ id: "прострочено", label: "Прострочено" });
    }

    return options;
  }

  if (currentStatus === "прострочено") {
    return [
      { id: "прострочено" as InvoiceStatus, label: "Прострочено" },
      { id: "виставлено" as InvoiceStatus, label: "Виставлено" },
    ];
  }

  return [{ id: currentStatus, label: currentStatus }];
}

function validateInvoiceForm(params: {
  form: InvoiceForm;
  mode: ModalMode;
  selectedProject: Project | null;
  editingInvoice: Invoice | null;
}) {
  const { form, mode, selectedProject, editingInvoice } = params;

  const projectId = Number(form.project_id);
  const totalAmount = parseMoney(form.total_amount);
  const issueDate = form.issue_date.trim();
  const dueDate = form.due_date.trim();
  const status = form.invoice_status;
  const today = getTodayISO();

  if (!Number.isInteger(projectId) || projectId <= 0 || !selectedProject) {
    return "Оберіть коректний проєкт для рахунку.";
  }

  if (selectedProject.status === "скасовано") {
    return "Не можна створювати або редагувати рахунок для скасованого проєкту.";
  }

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return "Сума рахунку має бути більшою за 0.";
  }

  if (totalAmount > MAX_INVOICE_AMOUNT) {
    return "Сума рахунку виглядає нереалістично великою.";
  }

  if (!isRealISODate(issueDate)) {
    return "Вкажіть коректну дату виставлення рахунку.";
  }

  if (!isRealISODate(dueDate)) {
    return "Вкажіть коректну дату оплати рахунку.";
  }

  if (issueDate > today) {
    return "Дата виставлення рахунку не може бути в майбутньому.";
  }

  if (dueDate < issueDate) {
    return "Дата оплати не може бути раніше дати виставлення рахунку.";
  }

  const maxDueDate = addDaysISO(issueDate, MAX_INVOICE_TERM_DAYS);

  if (dueDate > maxDueDate) {
    return `Дата оплати занадто далека. Максимальна дозволена дата: ${formatDate(
      maxDueDate
    )}.`;
  }

  if (mode === "create" && dueDate < today) {
    return "Новий рахунок не можна створити вже простроченим. Вкажіть майбутню дату оплати.";
  }

  if (!isInvoiceStatus(status)) {
    return "Оберіть коректний статус рахунку.";
  }

  if (mode === "create" && status !== "виставлено") {
    return "Новий рахунок створюється тільки зі статусом «виставлено».";
  }

  if (status === "виставлено" && dueDate < today) {
    return "Рахунок зі статусом «виставлено» не може мати прострочену дату оплати. Змініть статус на «прострочено».";
  }

  if (status === "прострочено" && dueDate >= today) {
    return "Статус «прострочено» можна встановити тільки якщо дата оплати вже минула.";
  }

  if (editingInvoice) {
    if (editingInvoice.is_locked || isLockedInvoiceStatus(editingInvoice.invoice_status)) {
      return "Оплачений або скасований рахунок заблокований від редагування.";
    }

    if (
      isPaymentControlledStatus(status) &&
      status !== editingInvoice.invoice_status
    ) {
      return "Статуси «частково оплачено» та «оплачено» встановлюються тільки через модуль платежів.";
    }

    if (
      editingInvoice.invoice_status === "частково оплачено" &&
      totalAmount !== editingInvoice.total_amount
    ) {
      return "Не можна змінювати суму частково оплаченого рахунку. Спочатку потрібно обробити платежі.";
    }
  }

  return "";
}

async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "API повернув не JSON. Перевірте route.ts і чи запущено npm run dev."
    );
  }

  return (await response.json()) as T;
}

export default function InvoicesPage() {
  const { role } = useDashboard();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const [form, setForm] = useState<InvoiceForm>({
    ...emptyForm,
    issue_date: getTodayISO(),
    due_date: addDaysISO(getTodayISO(), 14),
  });

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [detailsInvoice, setDetailsInvoice] = useState<Invoice | null>(null);

  const [actionInvoice, setActionInvoice] = useState<Invoice | null>(null);
  const [actionType, setActionType] = useState<InvoiceAction>("cancel");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState(false);

  const [pageNotice, setPageNotice] = useState<{
    type: NoticeType;
    text: string;
  } | null>(null);

  async function loadInvoices() {
    const response = await fetch("/api/invoices", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiInvoicesResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити рахунки.");
    }

    setInvoices(result.data);
  }

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

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        await Promise.all([loadInvoices(), loadProjects()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Сталася помилка під час завантаження рахунків."
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

  function upsertInvoice(invoice: Invoice) {
    setInvoices((current) => {
      const exists = current.some((item) => item.invoice_id === invoice.invoice_id);

      const next = exists
        ? current.map((item) =>
            item.invoice_id === invoice.invoice_id ? invoice : item
          )
        : [...current, invoice];

      return next.sort((a, b) => b.invoice_id - a.invoice_id);
    });
  }

  const activeProjects = useMemo(() => {
    return projects.filter((project) => project.status !== "скасовано");
  }, [projects]);

  const selectedProject = useMemo(() => {
    return projects.find((item) => String(item.project_id) === form.project_id) || null;
  }, [form.project_id, projects]);

  const visibleInvoices = useMemo(() => {
    const q = query.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const roleAllowed = role !== "client" || invoice.client_id === 1;

      const effectiveStatus = invoice.effective_status || invoice.invoice_status;

      const matchStatus =
        statusFilter === "all" ||
        invoice.invoice_status === statusFilter ||
        effectiveStatus === statusFilter;

      const matchQuery =
        !q ||
        invoice.client_name.toLowerCase().includes(q) ||
        invoice.client_company.toLowerCase().includes(q) ||
        invoice.project_name.toLowerCase().includes(q) ||
        String(invoice.invoice_id).includes(q) ||
        `inv-${String(invoice.invoice_id).padStart(4, "0")}`.includes(q);

      return roleAllowed && matchStatus && matchQuery;
    });
  }, [invoices, query, role, statusFilter]);

  const totals = useMemo(() => {
    const total = visibleInvoices.reduce(
      (sum, invoice) => sum + invoice.total_amount,
      0
    );

    const paid = visibleInvoices
      .filter((invoice) => invoice.invoice_status === "оплачено")
      .reduce((sum, invoice) => sum + invoice.total_amount, 0);

    const overdue = visibleInvoices
      .filter(
        (invoice) =>
          invoice.effective_status === "прострочено" ||
          invoice.invoice_status === "прострочено" ||
          invoice.is_overdue
      )
      .reduce((sum, invoice) => sum + invoice.total_amount, 0);

    const open = visibleInvoices.filter(
      (invoice) =>
        !["оплачено", "скасовано"].includes(invoice.invoice_status)
    ).length;

    return {
      total,
      paid,
      overdue,
      open,
    };
  }, [visibleInvoices]);

  const statusOptions = getAvailableStatusOptions(editingInvoice);

  function openCreateModal() {
    const firstProject = activeProjects[0];

    setModalMode("create");
    setEditingInvoiceId(null);
    setEditingInvoice(null);
    setForm({
      ...emptyForm,
      project_id: firstProject ? String(firstProject.project_id) : "",
      issue_date: getTodayISO(),
      due_date: addDaysISO(getTodayISO(), 14),
      invoice_status: "виставлено",
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function openEditModal(invoice: Invoice) {
    setModalMode("edit");
    setEditingInvoiceId(invoice.invoice_id);
    setEditingInvoice(invoice);
    setForm({
      project_id: String(invoice.project_id),
      total_amount: String(invoice.total_amount),
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      invoice_status: isInvoiceStatus(invoice.invoice_status)
        ? invoice.invoice_status
        : "виставлено",
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setModalMode("create");
    setEditingInvoiceId(null);
    setEditingInvoice(null);
    setForm({
      ...emptyForm,
      issue_date: getTodayISO(),
      due_date: addDaysISO(getTodayISO(), 14),
    });
    setFormError("");
    setFormSuccess("");
  }

  function updateForm<K extends keyof InvoiceForm>(key: K, value: InvoiceForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setFormError("");
    setFormSuccess("");
  }

  function handleIssueDateChange(value: string) {
    setForm((current) => {
      const nextDue =
        !current.due_date || current.due_date < value
          ? addDaysISO(value || getTodayISO(), 14)
          : current.due_date;

      return {
        ...current,
        issue_date: value,
        due_date: nextDue,
      };
    });

    setFormError("");
    setFormSuccess("");
  }

  async function handleSaveInvoice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const preparedForm: InvoiceForm = {
      project_id: form.project_id.trim(),
      total_amount: normalizeMoneyInput(form.total_amount),
      issue_date: form.issue_date.trim(),
      due_date: form.due_date.trim(),
      invoice_status:
        modalMode === "create" ? "виставлено" : form.invoice_status,
    };

    const validationError = validateInvoiceForm({
      form: preparedForm,
      mode: modalMode,
      selectedProject,
      editingInvoice,
    });

    if (validationError) {
      setForm(preparedForm);
      setFormError(validationError);
      return;
    }

    const isEditing = modalMode === "edit";

    if (isEditing && !editingInvoiceId) {
      setFormError("Не вдалося визначити рахунок для редагування.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setFormSuccess("");

      const response = await fetch(
        isEditing ? `/api/invoices/${editingInvoiceId}` : "/api/invoices",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            project_id: Number(preparedForm.project_id),
            total_amount: parseMoney(preparedForm.total_amount),
            issue_date: preparedForm.issue_date,
            due_date: preparedForm.due_date,
            invoice_status: preparedForm.invoice_status,
          }),
        }
      );

      const result = await readApiJson<ApiInvoiceResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(
          result.message ||
            (isEditing
              ? "Не вдалося оновити рахунок."
              : "Не вдалося створити рахунок.")
        );
      }

      upsertInvoice(result.data);

      if (isEditing) {
        setEditingInvoice(result.data);
        setFormSuccess("Рахунок успішно оновлено.");
        showPageNotice("success", "Рахунок оновлено.");
      } else {
        const firstProject = activeProjects[0];

        setForm({
          ...emptyForm,
          project_id: firstProject ? String(firstProject.project_id) : "",
          issue_date: getTodayISO(),
          due_date: addDaysISO(getTodayISO(), 14),
          invoice_status: "виставлено",
        });

        setFormSuccess("Рахунок створено зі статусом «виставлено».");
        showPageNotice("success", "Новий рахунок створено.");
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час збереження рахунку."
      );
    } finally {
      setSaving(false);
    }
  }

  function openActionModal(invoice: Invoice, action: InvoiceAction) {
    setActionInvoice(invoice);
    setActionType(action);
    setActionError("");
    setActionSuccess("");
  }

  function closeActionModal() {
    if (actioning) return;

    setActionInvoice(null);
    setActionType("cancel");
    setActionError("");
    setActionSuccess("");
  }

  function getActionMeta(action: InvoiceAction) {
    if (action === "markOverdue") {
      return {
        title: "Позначити рахунок простроченим?",
        button: "Так, позначити",
        icon: "warning",
        success: "Рахунок переведено у статус «прострочено».",
        note: "Це дозволено лише якщо дата оплати вже минула.",
      };
    }

    return {
      title: "Скасувати рахунок?",
      button: "Так, скасувати",
      icon: "block",
      success: "Рахунок скасовано.",
      note: "Запис не буде видалено фізично з бази, а отримає статус «скасовано».",
    };
  }

  async function confirmAction() {
    if (!actionInvoice) return;

    const meta = getActionMeta(actionType);

    try {
      setActioning(true);
      setActionError("");
      setActionSuccess("");

      let response: Response;

      if (actionType === "cancel") {
        response = await fetch(`/api/invoices/${actionInvoice.invoice_id}`, {
          method: "DELETE",
        });
      } else {
        response = await fetch(`/api/invoices/${actionInvoice.invoice_id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invoice_status: "прострочено",
          }),
        });
      }

      const result = await readApiJson<ApiInvoiceResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Не вдалося змінити статус рахунку.");
      }

      upsertInvoice(result.data);
      setActionSuccess(meta.success);
      showPageNotice("success", meta.success);

      window.setTimeout(() => {
        closeActionModal();
      }, 900);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час зміни статусу рахунку."
      );
    } finally {
      setActioning(false);
    }
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className={styles.denied}>
        <span className="material-symbols-rounded">lock</span>
        <h2>Немає доступу</h2>
        <p>Розділ «Рахунки» доступний директору, бухгалтеру та клієнту.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.empty}>
        <span className="material-symbols-rounded">sync</span>
        <p>Завантажуємо рахунки з PostgreSQL...</p>
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
    modalMode === "create" ? "Створити рахунок" : "Редагувати рахунок";

  const finalLocked =
    editingInvoice !== null &&
    (editingInvoice.is_locked ||
      isLockedInvoiceStatus(editingInvoice.invoice_status));

  const amountLocked =
    editingInvoice?.invoice_status === "частково оплачено" || finalLocked;

  return (
    <>
      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h1>Рахунки</h1>
            <p>
              Фінансові документи за проєктами, клієнтами та строками оплати
            </p>
          </div>

          <div className={styles.headActions}>
            {role !== "client" && (
              <button
                className={styles.addButton}
                type="button"
                onClick={openCreateModal}
              >
                <span className="material-symbols-rounded">add</span>
                Новий рахунок
              </button>
            )}
          </div>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.search}>
            <span className="material-symbols-rounded">search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="text"
              placeholder="Пошук за клієнтом, компанією, проєктом або номером..."
            />
          </div>

          <div className={styles.filterSelect}>
            <span className="material-symbols-rounded">receipt_long</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
            >
              {invoiceStatuses.map((item) => (
                <option key={item.id} value={item.id}>
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

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">payments</span>
            </span>
            <div>
              <p>Загальна сума</p>
              <strong>{formatMoney(totals.total)} ₴</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">check_circle</span>
            </span>
            <div>
              <p>Оплачено</p>
              <strong>{formatMoney(totals.paid)} ₴</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">warning</span>
            </span>
            <div>
              <p>Прострочено</p>
              <strong>{formatMoney(totals.overdue)} ₴</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">pending_actions</span>
            </span>
            <div>
              <p>Відкриті рахунки</p>
              <strong>{totals.open}</strong>
            </div>
          </article>
        </section>

        <section className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Рахунок</th>
                <th>Клієнт</th>
                <th>Проєкт</th>
                <th>Сума</th>
                <th>Дата</th>
                <th>Оплатити до</th>
                <th>Статус</th>
                <th className={styles.actionsCol}>Дії</th>
              </tr>
            </thead>

            <tbody>
              {visibleInvoices.map((invoice) => {
                const status = invoice.effective_status || invoice.invoice_status;

                return (
                  <tr key={invoice.invoice_id}>
                    <td>
                      <div className={styles.invoiceCell}>
                        <strong>
                          INV-{String(invoice.invoice_id).padStart(4, "0")}
                        </strong>
                        <span>project_id: {invoice.project_id}</span>
                      </div>
                    </td>

                    <td>
                      <div className={styles.invoiceCell}>
                        <strong>{invoice.client_company}</strong>
                        <span>{invoice.client_name}</span>
                      </div>
                    </td>

                    <td className={styles.muted}>{invoice.project_name}</td>
                    <td>{formatMoney(invoice.total_amount)} ₴</td>
                    <td className={styles.muted}>{formatDate(invoice.issue_date)}</td>

                    <td>
                      <div className={styles.dueCell}>
                        <span>{formatDate(invoice.due_date)}</span>
                        <small
                          className={cx(
                            status === "прострочено"
                              ? styles.dueDanger
                              : styles.dueNormal
                          )}
                        >
                          {getDueLabel(invoice)}
                        </small>
                      </div>
                    </td>

                    <td>
                      <span
                        className={cx(styles.badge, getStatusClass(status))}
                      >
                        {status}
                      </span>
                    </td>

                    <td>
                      <div className={styles.actionCell}>
                        <button
                          className={styles.iconButton}
                          type="button"
                          title="Деталі"
                          onClick={() => setDetailsInvoice(invoice)}
                        >
                          <span className="material-symbols-rounded">
                            visibility
                          </span>
                        </button>

                        {role !== "client" && invoice.can_edit && (
                          <button
                            className={styles.iconButton}
                            type="button"
                            title="Редагувати"
                            onClick={() => openEditModal(invoice)}
                          >
                            <span className="material-symbols-rounded">edit</span>
                          </button>
                        )}

                        {role !== "client" && invoice.can_mark_overdue && (
                          <button
                            className={styles.iconButtonDanger}
                            type="button"
                            title="Позначити простроченим"
                            onClick={() => openActionModal(invoice, "markOverdue")}
                          >
                            <span className="material-symbols-rounded">
                              warning
                            </span>
                          </button>
                        )}

                        {role !== "client" && invoice.can_cancel && (
                          <button
                            className={styles.iconButtonDanger}
                            type="button"
                            title="Скасувати"
                            onClick={() => openActionModal(invoice, "cancel")}
                          >
                            <span className="material-symbols-rounded">
                              block
                            </span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {visibleInvoices.length === 0 && (
            <div className={styles.empty}>
              <span className="material-symbols-rounded">receipt_long</span>
              <p>Рахунки за вибраними умовами не знайдено.</p>
            </div>
          )}
        </section>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeModal}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>
                  {modalMode === "create"
                    ? "Новий рахунок PostgreSQL"
                    : "Оновлення рахунку PostgreSQL"}
                </span>
                <h2 id="invoice-modal-title">{modalTitle}</h2>
                <p>
                  Новий рахунок створюється тільки зі статусом «виставлено».
                  Оплата буде фіксуватися окремо через модуль платежів.
                </p>
              </div>

              <button className={styles.modalClose} type="button" onClick={closeModal}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSaveInvoice} noValidate>
              {activeProjects.length === 0 && modalMode === "create" && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">info</span>
                  Немає активних проєктів для створення рахунку.
                </div>
              )}

              {finalLocked && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">lock</span>
                  Оплачений або скасований рахунок заблокований від редагування.
                </div>
              )}

              {editingInvoice?.invoice_status === "частково оплачено" && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">payments</span>
                  Суму частково оплаченого рахунку змінювати не можна. Статус
                  буде оновлювати модуль платежів.
                </div>
              )}

              <div className={styles.formGrid}>
                <label className={cx(styles.field, styles.fieldWide)}>
                  <span>Проєкт</span>
                  <select
                    value={form.project_id}
                    onChange={(event) =>
                      updateForm("project_id", event.target.value)
                    }
                    disabled={modalMode === "edit" || finalLocked}
                  >
                    <option value="">Оберіть проєкт</option>

                    {modalMode === "create" &&
                      activeProjects.map((project) => (
                        <option value={project.project_id} key={project.project_id}>
                          #{project.project_id} · {project.project_name} ·{" "}
                          {project.client_company || project.client_name || "клієнт"}
                        </option>
                      ))}

                    {modalMode === "edit" && editingInvoice && (
                      <option value={editingInvoice.project_id}>
                        #{editingInvoice.project_id} · {editingInvoice.project_name}
                      </option>
                    )}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Сума рахунку, грн</span>
                  <input
                    value={form.total_amount}
                    onChange={(event) =>
                      updateForm("total_amount", normalizeMoneyInput(event.target.value))
                    }
                    inputMode="decimal"
                    placeholder="25000"
                    disabled={amountLocked}
                  />
                </label>

                <label className={styles.field}>
                  <span>Дата виставлення</span>
                  <input
                    value={form.issue_date}
                    onChange={(event) => handleIssueDateChange(event.target.value)}
                    type="date"
                    max={getTodayISO()}
                    disabled={finalLocked}
                  />
                </label>

                <label className={styles.field}>
                  <span>Оплатити до</span>
                  <input
                    value={form.due_date}
                    onChange={(event) => updateForm("due_date", event.target.value)}
                    type="date"
                    min={form.issue_date || undefined}
                    max={
                      form.issue_date
                        ? addDaysISO(form.issue_date, MAX_INVOICE_TERM_DAYS)
                        : undefined
                    }
                    disabled={finalLocked}
                  />
                </label>

                <label className={styles.field}>
                  <span>Статус</span>
                  <select
                    value={form.invoice_status}
                    onChange={(event) =>
                      updateForm("invoice_status", event.target.value as InvoiceStatus)
                    }
                    disabled={modalMode === "create" || finalLocked}
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

                <button
                  className={styles.primaryButton}
                  type="submit"
                  disabled={
                    saving ||
                    finalLocked ||
                    (modalMode === "create" && activeProjects.length === 0)
                  }
                >
                  <span className="material-symbols-rounded">
                    {saving ? "sync" : modalMode === "create" ? "add" : "save"}
                  </span>
                  {saving
                    ? "Збереження..."
                    : modalMode === "create"
                    ? "Створити рахунок"
                    : "Зберегти зміни"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailsInvoice && (
        <div
          className={styles.modalOverlay}
          onMouseDown={() => setDetailsInvoice(null)}
        >
          <section
            className={cx(styles.modal, styles.detailsModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>Деталі рахунку</span>
                <h2 id="invoice-details-title">
                  INV-{String(detailsInvoice.invoice_id).padStart(4, "0")}
                </h2>
                <p>
                  {detailsInvoice.client_company} · {detailsInvoice.project_name}
                </p>
              </div>

              <button
                className={styles.modalClose}
                type="button"
                onClick={() => setDetailsInvoice(null)}
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
                      styles.badge,
                      getStatusClass(detailsInvoice.effective_status)
                    )}
                  >
                    {detailsInvoice.effective_status}
                  </span>
                </div>

                <div>
                  <small>Сума</small>
                  <strong>{formatMoney(detailsInvoice.total_amount)} грн</strong>
                </div>

                <div>
                  <small>До оплати</small>
                  <strong>{getDueLabel(detailsInvoice)}</strong>
                </div>

                <div>
                  <small>Клієнт</small>
                  <strong>{detailsInvoice.client_company}</strong>
                </div>

                <div>
                  <small>Проєкт</small>
                  <strong>{detailsInvoice.project_name}</strong>
                </div>

                <div>
                  <small>Бюджет брифа</small>
                  <strong>{formatMoney(detailsInvoice.brief_budget)} грн</strong>
                </div>

                <div>
                  <small>Дата виставлення</small>
                  <strong>{formatDate(detailsInvoice.issue_date)}</strong>
                </div>

                <div>
                  <small>Оплатити до</small>
                  <strong>{formatDate(detailsInvoice.due_date)}</strong>
                </div>

                <div>
                  <small>Контакти</small>
                  <strong>
                    {detailsInvoice.client_email || detailsInvoice.client_phone || "—"}
                  </strong>
                </div>
              </div>

              <div className={styles.modalActions}>
                {role !== "client" && detailsInvoice.can_edit && (
                  <button
                    className={styles.primaryButton}
                    type="button"
                    onClick={() => {
                      setDetailsInvoice(null);
                      openEditModal(detailsInvoice);
                    }}
                  >
                    <span className="material-symbols-rounded">edit</span>
                    Редагувати
                  </button>
                )}

                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setDetailsInvoice(null)}
                >
                  Закрити
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {actionInvoice && (
        <div className={styles.modalOverlay} onMouseDown={closeActionModal}>
          <section
            className={cx(styles.modal, styles.confirmModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-action-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <span className="material-symbols-rounded">
                {getActionMeta(actionType).icon}
              </span>
            </div>

            <div className={styles.confirmContent}>
              <span className={styles.modalKicker}>Зміна статусу PostgreSQL</span>

              <h2 id="invoice-action-title">{getActionMeta(actionType).title}</h2>

              <p>
                Рахунок{" "}
                <strong>
                  INV-{String(actionInvoice.invoice_id).padStart(4, "0")}
                </strong>{" "}
                для <strong>{actionInvoice.client_company}</strong> буде оновлено.
              </p>

              <p className={styles.confirmNote}>
                {getActionMeta(actionType).note}
              </p>

              {(actionError || actionSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    actionError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {actionError ? "error" : "check_circle"}
                  </span>
                  {actionError || actionSuccess}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={closeActionModal}
                disabled={actioning}
              >
                Назад
              </button>

              <button
                className={
                  actionType === "cancel"
                    ? styles.dangerButton
                    : styles.primaryButton
                }
                type="button"
                onClick={confirmAction}
                disabled={actioning || Boolean(actionSuccess)}
              >
                <span className="material-symbols-rounded">
                  {actioning ? "sync" : getActionMeta(actionType).icon}
                </span>
                {actioning ? "Оновлення..." : getActionMeta(actionType).button}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}