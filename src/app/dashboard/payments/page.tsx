"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role, useDashboard } from "../layout";
import styles from "./page.module.css";

type PaymentMethod = "картка" | "готівка" | "банківський переказ";
type MethodFilter = "all" | PaymentMethod;

type InvoiceStatus =
  | "виставлено"
  | "частково оплачено"
  | "оплачено"
  | "прострочено"
  | "скасовано";

type StatusFilter = "all" | InvoiceStatus;
type ModalMode = "create" | "edit";
type NoticeType = "success" | "error";

type Payment = {
  payment_id: number;

  invoice_id: number;
  invoice_status: string;
  invoice_effective_status: string;
  invoice_total_amount: number;
  invoice_issue_date: string;
  invoice_due_date: string;

  paid_total: number;
  balance_amount: number;
  payment_progress_percent: number;

  amount_paid: number;
  payment_date: string;
  payment_method: string;

  client_id: number;
  client_name: string;
  client_company: string;
  client_status: string;
  client_email: string | null;
  client_phone: string | null;

  project_id: number;
  project_name: string;
  project_status: string;

  brief_id: number;
  brief_budget: number;

  can_edit: boolean;
  can_delete: boolean;
  can_create_more_payments: boolean;
};

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

  total_amount: number;
  issue_date: string;
  due_date: string;
  invoice_status: string;
  effective_status: string;

  is_overdue: boolean;
  days_to_due: number;
  is_locked: boolean;

  can_edit: boolean;
  can_cancel: boolean;
  can_mark_overdue: boolean;
  can_register_payment: boolean;
};

type PaymentForm = {
  invoice_id: string;
  amount_paid: string;
  payment_date: string;
  payment_method: PaymentMethod | "";
};

type ApiPaymentsResponse = {
  ok: boolean;
  data?: Payment[];
  message?: string;
};

type ApiPaymentResponse = {
  ok: boolean;
  data?: Payment | { payment_id: number; invoice_id: number } | null;
  message?: string;
};

type ApiInvoicesResponse = {
  ok: boolean;
  data?: Invoice[];
  message?: string;
};

const allowedRoles: Role[] = ["director", "accountant"];

const paymentMethods: { id: MethodFilter; label: string }[] = [
  { id: "all", label: "Всі методи" },
  { id: "картка", label: "Картка" },
  { id: "готівка", label: "Готівка" },
  { id: "банківський переказ", label: "Банківський переказ" },
];

const invoiceStatuses: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Всі рахунки" },
  { id: "виставлено", label: "Виставлено" },
  { id: "частково оплачено", label: "Частково оплачено" },
  { id: "оплачено", label: "Оплачено" },
  { id: "прострочено", label: "Прострочено" },
  { id: "скасовано", label: "Скасовано" },
];

const paymentMethodValues: PaymentMethod[] = [
  "картка",
  "готівка",
  "банківський переказ",
];

const MAX_PAYMENT_AMOUNT = 10_000_000;

const emptyForm: PaymentForm = {
  invoice_id: "",
  amount_paid: "",
  payment_date: "",
  payment_method: "",
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

function toUTC(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
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

function methodIcon(method: string) {
  if (method === "картка") return "credit_card";
  if (method === "готівка") return "payments";
  if (method === "банківський переказ") return "account_balance";

  return "receipt_long";
}

function methodClass(method: string) {
  if (method === "картка") return styles.toneInfo;
  if (method === "готівка") return styles.toneGreen;
  if (method === "банківський переказ") return styles.toneAmber;

  return styles.toneNeutral;
}

function invoiceStatusClass(status: string) {
  if (status === "оплачено") return styles.toneGreen;
  if (status === "частково оплачено") return styles.toneAmber;
  if (status === "прострочено") return styles.toneRed;
  if (status === "виставлено") return styles.toneInfo;
  if (status === "скасовано") return styles.toneNeutral;

  return styles.toneNeutral;
}

function getPaymentPercent(amount: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((amount / total) * 100));
}

function getInvoicePaidTotal(params: {
  invoiceId: number;
  payments: Payment[];
  excludePaymentId?: number | null;
}) {
  return params.payments
    .filter((payment) => {
      if (payment.invoice_id !== params.invoiceId) return false;

      if (
        params.excludePaymentId &&
        payment.payment_id === params.excludePaymentId
      ) {
        return false;
      }

      return true;
    })
    .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);
}

function getInvoiceBalance(params: {
  invoice: Invoice;
  payments: Payment[];
  excludePaymentId?: number | null;
}) {
  const alreadyPaid = getInvoicePaidTotal({
    invoiceId: params.invoice.invoice_id,
    payments: params.payments,
    excludePaymentId: params.excludePaymentId,
  });

  return Math.max(0, Math.round((params.invoice.total_amount - alreadyPaid) * 100) / 100);
}

function getInvoiceProgress(invoice: Invoice, payments: Payment[]) {
  const paid = getInvoicePaidTotal({
    invoiceId: invoice.invoice_id,
    payments,
  });

  return {
    paid,
    balance: Math.max(0, invoice.total_amount - paid),
    percent: getPaymentPercent(paid, invoice.total_amount),
  };
}

function canUseInvoiceForNewPayment(invoice: Invoice, payments: Payment[]) {
  if (invoice.invoice_status === "скасовано") return false;
  if (invoice.invoice_status === "оплачено") return false;
  if (!invoice.can_register_payment) return false;

  return getInvoiceBalance({ invoice, payments }) > 0;
}

function validatePaymentForm(params: {
  form: PaymentForm;
  selectedInvoice: Invoice | null;
  payments: Payment[];
  mode: ModalMode;
  editingPaymentId: number | null;
}) {
  const invoiceId = Number(params.form.invoice_id);
  const amountPaid = parseMoney(params.form.amount_paid);
  const paymentDate = params.form.payment_date.trim();
  const method = params.form.payment_method;

  if (!Number.isInteger(invoiceId) || invoiceId <= 0 || !params.selectedInvoice) {
    return "Оберіть коректний рахунок для платежу.";
  }

  if (params.selectedInvoice.invoice_status === "скасовано") {
    return "Не можна додати або редагувати платіж скасованого рахунку.";
  }

  if (params.mode === "create" && params.selectedInvoice.invoice_status === "оплачено") {
    return "Рахунок вже повністю оплачено.";
  }

  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    return "Сума платежу має бути більшою за 0.";
  }

  if (amountPaid > MAX_PAYMENT_AMOUNT) {
    return "Сума платежу виглядає нереалістично великою.";
  }

  if (!isRealISODate(paymentDate)) {
    return "Вкажіть коректну дату платежу.";
  }

  if (paymentDate > getTodayISO()) {
    return "Дата платежу не може бути в майбутньому.";
  }

  if (paymentDate < params.selectedInvoice.issue_date) {
    return "Дата платежу не може бути раніше дати виставлення рахунку.";
  }

  if (!method || !paymentMethodValues.includes(method)) {
    return "Метод оплати може бути тільки: картка, готівка або банківський переказ.";
  }

  const maxAllowed = getInvoiceBalance({
    invoice: params.selectedInvoice,
    payments: params.payments,
    excludePaymentId: params.editingPaymentId,
  });

  if (amountPaid > maxAllowed + 0.009) {
    return `Сума платежу перевищує залишок по рахунку. Максимально можна внести ${formatMoney(
      maxAllowed
    )} грн.`;
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

export default function PaymentsPage() {
  const { role } = useDashboard();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const [form, setForm] = useState<PaymentForm>({
    ...emptyForm,
    payment_date: getTodayISO(),
  });

  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [detailsPayment, setDetailsPayment] = useState<Payment | null>(null);

  const [deletePayment, setDeletePayment] = useState<Payment | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [pageNotice, setPageNotice] = useState<{
    type: NoticeType;
    text: string;
  } | null>(null);

  async function loadPayments() {
    const response = await fetch("/api/payments", {
      cache: "no-store",
    });

    const result = await readApiJson<ApiPaymentsResponse>(response);

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити платежі.");
    }

    setPayments(result.data);
  }

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

  async function reloadData() {
    await Promise.all([loadPayments(), loadInvoices()]);
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");
        await reloadData();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Сталася помилка під час завантаження платежів."
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

  const availableInvoices = useMemo(() => {
    return invoices.filter((invoice) => canUseInvoiceForNewPayment(invoice, payments));
  }, [invoices, payments]);

  const selectedInvoice = useMemo(() => {
    return (
      invoices.find((invoice) => String(invoice.invoice_id) === form.invoice_id) ||
      null
    );
  }, [form.invoice_id, invoices]);

  const invoiceBalanceInfo = useMemo(() => {
    if (!selectedInvoice) return null;

    const paidWithoutCurrent = getInvoicePaidTotal({
      invoiceId: selectedInvoice.invoice_id,
      payments,
      excludePaymentId: editingPaymentId,
    });

    const currentAmount = parseMoney(form.amount_paid || "0");
    const totalAfterCurrent = Number.isFinite(currentAmount)
      ? paidWithoutCurrent + currentAmount
      : paidWithoutCurrent;

    const balanceBeforeCurrent = Math.max(
      0,
      selectedInvoice.total_amount - paidWithoutCurrent
    );

    const balanceAfterCurrent = Math.max(
      0,
      selectedInvoice.total_amount - totalAfterCurrent
    );

    return {
      invoiceTotal: selectedInvoice.total_amount,
      paidWithoutCurrent,
      totalAfterCurrent,
      balanceBeforeCurrent,
      balanceAfterCurrent,
      percent:
        selectedInvoice.total_amount > 0
          ? Math.min(100, (totalAfterCurrent / selectedInvoice.total_amount) * 100)
          : 0,
      isOverLimit: totalAfterCurrent > selectedInvoice.total_amount + 0.009,
    };
  }, [editingPaymentId, form.amount_paid, payments, selectedInvoice]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchMethod = method === "all" || payment.payment_method === method;

      const status = payment.invoice_effective_status || payment.invoice_status;

      const matchStatus =
        statusFilter === "all" ||
        payment.invoice_status === statusFilter ||
        status === statusFilter;

      const matchQuery =
        !q ||
        payment.client_name.toLowerCase().includes(q) ||
        payment.client_company.toLowerCase().includes(q) ||
        payment.project_name.toLowerCase().includes(q) ||
        String(payment.invoice_id).includes(q) ||
        String(payment.payment_id).includes(q) ||
        `pay-${String(payment.payment_id).padStart(4, "0")}`.includes(q) ||
        `inv-${String(payment.invoice_id).padStart(4, "0")}`.includes(q);

      return matchMethod && matchStatus && matchQuery;
    });
  }, [method, payments, query, statusFilter]);

  const totals = useMemo(() => {
    const totalPaid = filtered.reduce(
      (sum, payment) => sum + Number(payment.amount_paid || 0),
      0
    );

    const card = filtered
      .filter((payment) => payment.payment_method === "картка")
      .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);

    const cash = filtered
      .filter((payment) => payment.payment_method === "готівка")
      .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);

    const bank = filtered
      .filter((payment) => payment.payment_method === "банківський переказ")
      .reduce((sum, payment) => sum + Number(payment.amount_paid || 0), 0);

    return {
      totalPaid,
      card,
      cash,
      bank,
      count: filtered.length,
    };
  }, [filtered]);

  const invoiceGroups = useMemo(() => {
    return invoices
      .map((invoice) => {
        const progress = getInvoiceProgress(invoice, payments);

        return {
          invoice_id: invoice.invoice_id,
          client_name: invoice.client_name,
          client_company: invoice.client_company,
          project_name: invoice.project_name,
          invoice_total: invoice.total_amount,
          invoice_status: invoice.effective_status || invoice.invoice_status,
          paid: progress.paid,
          balance: progress.balance,
          percent: progress.percent,
        };
      })
      .filter((invoice) => invoice.paid > 0 || invoice.invoice_status !== "скасовано")
      .sort((a, b) => b.paid - a.paid)
      .slice(0, 5);
  }, [invoices, payments]);

  function resetFormState() {
    setModalOpen(false);
    setModalMode("create");
    setEditingPaymentId(null);
    setEditingPayment(null);
    setForm({
      ...emptyForm,
      payment_date: getTodayISO(),
    });
    setFormError("");
    setFormSuccess("");
  }

  function openCreateModal() {
    const firstInvoice = availableInvoices[0];

    setModalMode("create");
    setEditingPaymentId(null);
    setEditingPayment(null);
    setForm({
      ...emptyForm,
      invoice_id: firstInvoice ? String(firstInvoice.invoice_id) : "",
      payment_date: getTodayISO(),
      payment_method: "картка",
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function openEditModal(payment: Payment) {
    setModalMode("edit");
    setEditingPaymentId(payment.payment_id);
    setEditingPayment(payment);
    setForm({
      invoice_id: String(payment.invoice_id),
      amount_paid: String(payment.amount_paid),
      payment_date: payment.payment_date,
      payment_method: paymentMethodValues.includes(payment.payment_method as PaymentMethod)
        ? (payment.payment_method as PaymentMethod)
        : "",
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    resetFormState();
  }

  function updateForm<K extends keyof PaymentForm>(key: K, value: PaymentForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setFormError("");
    setFormSuccess("");
  }

  function handleInvoiceChange(invoiceId: string) {
    const invoice =
      invoices.find((item) => String(item.invoice_id) === invoiceId) || null;

    setForm((current) => ({
      ...current,
      invoice_id: invoiceId,
      payment_date:
        invoice && current.payment_date < invoice.issue_date
          ? invoice.issue_date
          : current.payment_date || getTodayISO(),
      amount_paid: "",
    }));

    setFormError("");
    setFormSuccess("");
  }

  async function handleSavePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const preparedForm: PaymentForm = {
      invoice_id: form.invoice_id.trim(),
      amount_paid: normalizeMoneyInput(form.amount_paid),
      payment_date: form.payment_date.trim(),
      payment_method: form.payment_method,
    };

    const validationError = validatePaymentForm({
      form: preparedForm,
      selectedInvoice,
      payments,
      mode: modalMode,
      editingPaymentId,
    });

    if (validationError) {
      setForm(preparedForm);
      setFormError(validationError);
      return;
    }

    const isEditing = modalMode === "edit";

    if (isEditing && !editingPaymentId) {
      setFormError("Не вдалося визначити платіж для редагування.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setFormSuccess("");

      const response = await fetch(
        isEditing ? `/api/payments/${editingPaymentId}` : "/api/payments",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            invoice_id: Number(preparedForm.invoice_id),
            amount_paid: parseMoney(preparedForm.amount_paid),
            payment_date: preparedForm.payment_date,
            payment_method: preparedForm.payment_method,
          }),
        }
      );

      const result = await readApiJson<ApiPaymentResponse>(response);

      if (!response.ok || !result.ok || !result.data || !("payment_date" in result.data)) {
        throw new Error(
          result.message ||
            (isEditing
              ? "Не вдалося оновити платіж."
              : "Не вдалося створити платіж.")
        );
      }

      await reloadData();

      setFormSuccess(
        isEditing
          ? "Платіж успішно оновлено. Статус рахунку перераховано."
          : "Платіж успішно додано. Статус рахунку перераховано."
      );

      showPageNotice(
        "success",
        isEditing
          ? "Платіж оновлено, рахунок перераховано."
          : "Платіж додано, рахунок перераховано."
      );

      window.setTimeout(() => {
        resetFormState();
      }, 850);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час збереження платежу."
      );
    } finally {
      setSaving(false);
    }
  }

  function openDeleteModal(payment: Payment) {
    setDeletePayment(payment);
    setDeleteError("");
    setDeleteSuccess("");
  }

  function closeDeleteModal() {
    if (deleting) return;

    setDeletePayment(null);
    setDeleteError("");
    setDeleteSuccess("");
  }

  async function confirmDeletePayment() {
    if (!deletePayment) return;

    try {
      setDeleting(true);
      setDeleteError("");
      setDeleteSuccess("");

      const response = await fetch(`/api/payments/${deletePayment.payment_id}`, {
        method: "DELETE",
      });

      const result = await readApiJson<ApiPaymentResponse>(response);

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Не вдалося видалити платіж.");
      }

      await reloadData();

      setDeleteSuccess("Платіж видалено. Статус рахунку перераховано.");
      showPageNotice("success", "Платіж видалено, рахунок перераховано.");

      window.setTimeout(() => {
        closeDeleteModal();
      }, 850);
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час видалення платежу."
      );
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const rows = [
      [
        "payment_id",
        "invoice_id",
        "client_company",
        "project_name",
        "amount_paid",
        "payment_date",
        "payment_method",
        "invoice_status",
        "paid_total",
        "balance_amount",
      ],
      ...filtered.map((payment) => [
        payment.payment_id,
        payment.invoice_id,
        payment.client_company,
        payment.project_name,
        payment.amount_paid.toFixed(2),
        payment.payment_date,
        payment.payment_method,
        payment.invoice_effective_status || payment.invoice_status,
        payment.paid_total.toFixed(2),
        payment.balance_amount.toFixed(2),
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";")
      )
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `adflow-payments-${getTodayISO()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className={styles.denied}>
        <span className="material-symbols-rounded">lock</span>
        <h2>Немає доступу</h2>
        <p>Розділ «Оплати» доступний лише директору та бухгалтеру.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.empty}>
        <span className="material-symbols-rounded">sync</span>
        <p>Завантажуємо платежі з PostgreSQL...</p>
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
    modalMode === "create" ? "Додати оплату" : "Редагувати оплату";

  const selectedMaxPaymentDate = selectedInvoice
    ? getTodayISO() < selectedInvoice.issue_date
      ? selectedInvoice.issue_date
      : getTodayISO()
    : getTodayISO();

  return (
    <>
      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h1>Оплати</h1>
            <p>
              Облік платежів за рахунками клієнтів. Після кожної оплати статус
              рахунку перераховується автоматично.
            </p>
          </div>

          <div className={styles.headActions}>
            <button
              className={styles.secondaryTopButton}
              type="button"
              onClick={exportCsv}
              disabled={filtered.length === 0}
            >
              <span className="material-symbols-rounded">download</span>
              Експорт CSV
            </button>

            <button className={styles.addButton} type="button" onClick={openCreateModal}>
              <span className="material-symbols-rounded">add</span>
              Додати оплату
            </button>
          </div>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.search}>
            <span className="material-symbols-rounded">search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="text"
              placeholder="Пошук за клієнтом, компанією, проєктом, PAY або INV..."
            />
          </div>

          <div className={styles.filterSelect}>
            <span className="material-symbols-rounded">credit_card</span>
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value as MethodFilter)}
            >
              {paymentMethods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
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
              <span className="material-symbols-rounded">account_balance_wallet</span>
            </span>

            <div>
              <p>Отримано оплат</p>
              <strong>{formatMoney(totals.totalPaid)} ₴</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">credit_card</span>
            </span>

            <div>
              <p>Карткою</p>
              <strong>{formatMoney(totals.card)} ₴</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">payments</span>
            </span>

            <div>
              <p>Готівкою</p>
              <strong>{formatMoney(totals.cash)} ₴</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">account_balance</span>
            </span>

            <div>
              <p>Переказом</p>
              <strong>{formatMoney(totals.bank)} ₴</strong>
            </div>
          </article>
        </section>

        <section className={styles.contentGrid}>
          <article className={styles.progressPanel}>
            <div className={styles.cardHead}>
              <div>
                <h2>Погашення рахунків</h2>
                <p>Сума оплат відносно загальної суми виставленого рахунку</p>
              </div>

              <span className={styles.badge}>{totals.count} платежів</span>
            </div>

            <div className={styles.invoiceList}>
              {invoiceGroups.map((invoice) => (
                <div className={styles.invoiceProgress} key={invoice.invoice_id}>
                  <div className={styles.invoiceTop}>
                    <div>
                      <strong>INV-{String(invoice.invoice_id).padStart(4, "0")}</strong>
                      <span>{invoice.project_name}</span>
                    </div>

                    <span
                      className={cx(
                        styles.badge,
                        invoiceStatusClass(invoice.invoice_status)
                      )}
                    >
                      {invoice.invoice_status}
                    </span>
                  </div>

                  <div className={styles.progressBar}>
                    <span style={{ width: `${invoice.percent}%` }} />
                  </div>

                  <div className={styles.progressMeta}>
                    <span>{invoice.percent}% оплачено</span>
                    <span>Залишок: {formatMoney(invoice.balance)} ₴</span>
                  </div>
                </div>
              ))}

              {invoiceGroups.length === 0 && (
                <div className={styles.emptyCompact}>
                  <span className="material-symbols-rounded">receipt_long</span>
                  <p>Немає рахунків для відображення</p>
                </div>
              )}
            </div>
          </article>

          <article className={styles.methodPanel}>
            <div className={styles.cardHead}>
              <div>
                <h2>Методи оплат</h2>
                <p>Розподіл надходжень за способом оплати</p>
              </div>
            </div>

            <div className={styles.methodList}>
              {paymentMethods
                .filter((item) => item.id !== "all")
                .map((item) => {
                  const value =
                    item.id === "картка"
                      ? totals.card
                      : item.id === "готівка"
                      ? totals.cash
                      : totals.bank;

                  return (
                    <div className={styles.methodRow} key={item.id}>
                      <span className={cx(styles.methodIcon, methodClass(item.id))}>
                        <span className="material-symbols-rounded">
                          {methodIcon(item.id)}
                        </span>
                      </span>

                      <div>
                        <strong>{item.label}</strong>
                        <span>{formatMoney(value)} ₴</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </article>
        </section>

        <section className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Оплата</th>
                <th>Рахунок</th>
                <th>Клієнт</th>
                <th>Проєкт</th>
                <th>Сума</th>
                <th>Дата</th>
                <th>Метод</th>
                <th>Статус рахунку</th>
                <th>Дії</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((payment) => {
                const effectiveStatus =
                  payment.invoice_effective_status || payment.invoice_status;

                return (
                  <tr key={payment.payment_id}>
                    <td>
                      <div className={styles.paymentCell}>
                        <strong>PAY-{String(payment.payment_id).padStart(4, "0")}</strong>
                        <span>payment_id: {payment.payment_id}</span>
                      </div>
                    </td>

                    <td>INV-{String(payment.invoice_id).padStart(4, "0")}</td>

                    <td>
                      <div className={styles.paymentCell}>
                        <strong>{payment.client_company}</strong>
                        <span>{payment.client_name}</span>
                      </div>
                    </td>

                    <td className={styles.muted}>{payment.project_name}</td>
                    <td>{formatMoney(payment.amount_paid)} ₴</td>
                    <td className={styles.muted}>{formatDate(payment.payment_date)}</td>

                    <td>
                      <span
                        className={cx(
                          styles.methodBadge,
                          methodClass(payment.payment_method)
                        )}
                      >
                        <span className="material-symbols-rounded">
                          {methodIcon(payment.payment_method)}
                        </span>
                        {payment.payment_method}
                      </span>
                    </td>

                    <td>
                      <span
                        className={cx(
                          styles.badge,
                          invoiceStatusClass(effectiveStatus)
                        )}
                      >
                        {effectiveStatus}
                      </span>
                    </td>

                    <td>
                      <div className={styles.actionCell}>
                        <button
                          className={styles.iconButton}
                          type="button"
                          title="Деталі"
                          onClick={() => setDetailsPayment(payment)}
                        >
                          <span className="material-symbols-rounded">visibility</span>
                        </button>

                        {payment.can_edit && (
                          <button
                            className={styles.iconButton}
                            type="button"
                            title="Редагувати"
                            onClick={() => openEditModal(payment)}
                          >
                            <span className="material-symbols-rounded">edit</span>
                          </button>
                        )}

                        {payment.can_delete && (
                          <button
                            className={styles.iconButtonDanger}
                            type="button"
                            title="Видалити"
                            onClick={() => openDeleteModal(payment)}
                          >
                            <span className="material-symbols-rounded">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className={styles.empty}>
              <span className="material-symbols-rounded">payments</span>
              <p>Оплати за вибраними умовами не знайдено.</p>
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
            aria-labelledby="payment-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>
                  {modalMode === "create"
                    ? "Новий платіж PostgreSQL"
                    : "Оновлення платежу PostgreSQL"}
                </span>

                <h2 id="payment-modal-title">{modalTitle}</h2>

                <p>
                  Платіж привʼязується до рахунку. Після збереження backend
                  автоматично перерахує статус рахунку.
                </p>
              </div>

              <button className={styles.modalClose} type="button" onClick={closeModal}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSavePayment} noValidate>
              {availableInvoices.length === 0 && modalMode === "create" && (
                <div className={styles.formInfo}>
                  <span className="material-symbols-rounded">info</span>
                  Немає рахунків, які можна оплатити. Оплачений або скасований
                  рахунок не приймає нові платежі.
                </div>
              )}

              {selectedInvoice && invoiceBalanceInfo && (
                <div
                  className={cx(
                    styles.budgetInfo,
                    invoiceBalanceInfo.isOverLimit && styles.budgetInfoDanger
                  )}
                >
                  <span className="material-symbols-rounded">
                    {invoiceBalanceInfo.isOverLimit
                      ? "warning"
                      : "account_balance_wallet"}
                  </span>

                  <div>
                    <strong>
                      Рахунок INV-{String(selectedInvoice.invoice_id).padStart(4, "0")} ·{" "}
                      {formatMoney(invoiceBalanceInfo.invoiceTotal)} грн
                    </strong>

                    <p>
                      Оплачено без цього запису:{" "}
                      {formatMoney(invoiceBalanceInfo.paidWithoutCurrent)} грн ·
                      Після збереження:{" "}
                      {formatMoney(invoiceBalanceInfo.totalAfterCurrent)} грн ·
                      Залишок:{" "}
                      {formatMoney(invoiceBalanceInfo.balanceAfterCurrent)} грн
                    </p>

                    <div className={styles.budgetBar}>
                      <span style={{ width: `${invoiceBalanceInfo.percent}%` }} />
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.formGrid}>
                <label className={cx(styles.field, styles.fieldWide)}>
                  <span>Рахунок</span>
                  <select
                    value={form.invoice_id}
                    onChange={(event) => handleInvoiceChange(event.target.value)}
                    disabled={modalMode === "edit"}
                  >
                    <option value="">Оберіть рахунок</option>

                    {modalMode === "create" &&
                      availableInvoices.map((invoice) => {
                        const balance = getInvoiceBalance({ invoice, payments });

                        return (
                          <option value={invoice.invoice_id} key={invoice.invoice_id}>
                            INV-{String(invoice.invoice_id).padStart(4, "0")} ·{" "}
                            {invoice.client_company} · {invoice.project_name} ·
                            залишок {formatMoney(balance)} грн
                          </option>
                        );
                      })}

                    {modalMode === "edit" && editingPayment && (
                      <option value={editingPayment.invoice_id}>
                        INV-{String(editingPayment.invoice_id).padStart(4, "0")} ·{" "}
                        {editingPayment.client_company} · {editingPayment.project_name}
                      </option>
                    )}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Сума платежу, грн</span>
                  <input
                    value={form.amount_paid}
                    onChange={(event) =>
                      updateForm("amount_paid", normalizeMoneyInput(event.target.value))
                    }
                    inputMode="decimal"
                    placeholder="5000"
                  />
                </label>

                <label className={styles.field}>
                  <span>Дата платежу</span>
                  <input
                    value={form.payment_date}
                    onChange={(event) => updateForm("payment_date", event.target.value)}
                    type="date"
                    min={selectedInvoice?.issue_date || undefined}
                    max={selectedMaxPaymentDate}
                  />
                </label>

                <label className={styles.field}>
                  <span>Метод оплати</span>
                  <select
                    value={form.payment_method}
                    onChange={(event) =>
                      updateForm("payment_method", event.target.value as PaymentMethod)
                    }
                  >
                    <option value="">Оберіть метод</option>
                    <option value="картка">Картка</option>
                    <option value="готівка">Готівка</option>
                    <option value="банківський переказ">Банківський переказ</option>
                  </select>
                </label>
              </div>

              <div className={styles.calculatedBox}>
                <div>
                  <small>Дата рахунку</small>
                  <strong>
                    {selectedInvoice ? formatDate(selectedInvoice.issue_date) : "—"}
                  </strong>
                </div>

                <div>
                  <small>До оплати</small>
                  <strong>
                    {selectedInvoice ? formatDate(selectedInvoice.due_date) : "—"}
                  </strong>
                </div>

                <div>
                  <small>Статус після платежу</small>
                  <strong>
                    {invoiceBalanceInfo
                      ? invoiceBalanceInfo.balanceAfterCurrent <= 0
                        ? "оплачено"
                        : invoiceBalanceInfo.totalAfterCurrent > 0
                        ? "частково оплачено"
                        : selectedInvoice?.effective_status || "—"
                      : "—"}
                  </strong>
                </div>
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
                    Boolean(invoiceBalanceInfo?.isOverLimit) ||
                    (modalMode === "create" && availableInvoices.length === 0)
                  }
                >
                  <span className="material-symbols-rounded">
                    {saving ? "sync" : modalMode === "create" ? "add" : "save"}
                  </span>
                  {saving
                    ? "Збереження..."
                    : modalMode === "create"
                    ? "Додати оплату"
                    : "Зберегти зміни"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailsPayment && (
        <div
          className={styles.modalOverlay}
          onMouseDown={() => setDetailsPayment(null)}
        >
          <section
            className={cx(styles.modal, styles.detailsModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-details-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>Деталі платежу</span>

                <h2 id="payment-details-title">
                  PAY-{String(detailsPayment.payment_id).padStart(4, "0")}
                </h2>

                <p>
                  {detailsPayment.client_company} · INV-
                  {String(detailsPayment.invoice_id).padStart(4, "0")}
                </p>
              </div>

              <button
                className={styles.modalClose}
                type="button"
                onClick={() => setDetailsPayment(null)}
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <div className={styles.detailsBody}>
              <div className={styles.detailsGrid}>
                <div>
                  <small>Сума платежу</small>
                  <strong>{formatMoney(detailsPayment.amount_paid)} грн</strong>
                </div>

                <div>
                  <small>Дата платежу</small>
                  <strong>{formatDate(detailsPayment.payment_date)}</strong>
                </div>

                <div>
                  <small>Метод</small>
                  <strong>{detailsPayment.payment_method}</strong>
                </div>

                <div>
                  <small>Рахунок</small>
                  <strong>
                    INV-{String(detailsPayment.invoice_id).padStart(4, "0")}
                  </strong>
                </div>

                <div>
                  <small>Сума рахунку</small>
                  <strong>{formatMoney(detailsPayment.invoice_total_amount)} грн</strong>
                </div>

                <div>
                  <small>Оплачено всього</small>
                  <strong>{formatMoney(detailsPayment.paid_total)} грн</strong>
                </div>

                <div>
                  <small>Залишок</small>
                  <strong>{formatMoney(detailsPayment.balance_amount)} грн</strong>
                </div>

                <div>
                  <small>Статус рахунку</small>
                  <span
                    className={cx(
                      styles.badge,
                      invoiceStatusClass(
                        detailsPayment.invoice_effective_status ||
                          detailsPayment.invoice_status
                      )
                    )}
                  >
                    {detailsPayment.invoice_effective_status ||
                      detailsPayment.invoice_status}
                  </span>
                </div>

                <div>
                  <small>Проєкт</small>
                  <strong>{detailsPayment.project_name}</strong>
                </div>
              </div>

              <div className={styles.modalActions}>
                {detailsPayment.can_edit && (
                  <button
                    className={styles.primaryButton}
                    type="button"
                    onClick={() => {
                      setDetailsPayment(null);
                      openEditModal(detailsPayment);
                    }}
                  >
                    <span className="material-symbols-rounded">edit</span>
                    Редагувати
                  </button>
                )}

                <button
                  className={styles.secondaryButton}
                  type="button"
                  onClick={() => setDetailsPayment(null)}
                >
                  Закрити
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {deletePayment && (
        <div className={styles.modalOverlay} onMouseDown={closeDeleteModal}>
          <section
            className={cx(styles.modal, styles.confirmModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-payment-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <span className="material-symbols-rounded">
                {deleteSuccess ? "check_circle" : "delete"}
              </span>
            </div>

            <div className={styles.confirmContent}>
              <span className={styles.modalKicker}>Видалення платежу PostgreSQL</span>

              <h2 id="delete-payment-title">Видалити платіж?</h2>

              <p>
                Платіж{" "}
                <strong>
                  PAY-{String(deletePayment.payment_id).padStart(4, "0")}
                </strong>{" "}
                на суму <strong>{formatMoney(deletePayment.amount_paid)} грн</strong>{" "}
                буде видалено. Після цього статус рахунку буде перераховано.
              </p>

              <p className={styles.confirmNote}>
                Якщо це був останній платіж, рахунок повернеться у статус
                «виставлено» або «прострочено» залежно від дати оплати.
              </p>

              {(deleteError || deleteSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    deleteError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {deleteError ? "error" : "check_circle"}
                  </span>
                  {deleteError || deleteSuccess}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={closeDeleteModal}
                disabled={deleting}
              >
                Скасувати
              </button>

              <button
                className={styles.dangerButton}
                type="button"
                onClick={confirmDeletePayment}
                disabled={deleting || Boolean(deleteSuccess)}
              >
                <span className="material-symbols-rounded">
                  {deleting ? "sync" : "delete"}
                </span>
                {deleting ? "Видалення..." : "Так, видалити"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}