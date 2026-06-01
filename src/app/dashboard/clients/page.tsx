"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role, useDashboard } from "../layout";
import styles from "./page.module.css";

type Client = {
  client_id: number;
  full_name: string;
  company_name: string;
  phone: string;
  email: string;
  status: string;
};

type ClientForm = {
  full_name: string;
  company_name: string;
  phone: string;
  email: string;
  password: string;
  status: "активний" | "неактивний";
};

type StatusFilter = "all" | "активний" | "неактивний";
type ModalMode = "create" | "edit";
type NoticeType = "success" | "error";

type ApiClientsResponse = {
  ok: boolean;
  data?: Client[];
  message?: string;
};

type ApiClientResponse = {
  ok: boolean;
  data?: Client | null;
  message?: string;
};

const allowedRoles: Role[] = ["director", "manager"];

const filters: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Всі" },
  { id: "активний", label: "Активні" },
  { id: "неактивний", label: "Неактивні" },
];

const emptyForm: ClientForm = {
  full_name: "",
  company_name: "",
  phone: "+380",
  email: "",
  password: "",
  status: "активний",
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

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeNameInput(value: string) {
  return value
    .replace(/[0-9]/g, "")
    .replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ'ʼ`\-\s]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 100);
}

function normalizeCompanyInput(value: string) {
  return value
    .replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ0-9'ʼ`\-.,&()\s]/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 120);
}

function normalizeEmailInput(value: string) {
  return value.toLowerCase().replace(/\s/g, "").slice(0, 120);
}

function formatPhoneInput(value: string) {
  let digits = value.replace(/\D/g, "");

  if (!digits || digits === "3" || digits === "38" || digits === "380") {
    return "+380";
  }

  while (digits.startsWith("380380")) {
    digits = digits.slice(3);
  }

  if (digits.startsWith("380")) {
    return `+380${digits.slice(3, 12)}`;
  }

  if (digits.startsWith("0")) {
    return `+380${digits.slice(1, 10)}`;
  }

  return `+380${digits.slice(0, 9)}`;
}

function isValidEmail(value: string) {
  if (value.length < 6 || value.length > 120) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function validateClientForm(form: ClientForm, mode: ModalMode) {
  const fullName = normalizeSpaces(form.full_name);
  const nameParts = fullName.split(" ").filter(Boolean);
  const companyName = normalizeSpaces(form.company_name);
  const phone = form.phone.trim();
  const email = form.email.trim().toLowerCase();
  const password = form.password.trim();

  if (fullName.length < 5) {
    return "Вкажіть повне ПІБ клієнта.";
  }

  if (nameParts.length < 2) {
    return "ПІБ клієнта має містити мінімум імʼя та прізвище.";
  }

  if (nameParts.some((part) => part.length < 2)) {
    return "Кожна частина ПІБ має містити мінімум 2 символи.";
  }

  if (!/^[A-Za-zА-Яа-яІіЇїЄєҐґ'ʼ`\-\s]+$/.test(fullName)) {
    return "ПІБ клієнта не має містити цифри або службові символи.";
  }

  if (companyName.length < 2) {
    return "Вкажіть назву компанії клієнта.";
  }

  if (companyName.length > 120) {
    return "Назва компанії не може бути довшою за 120 символів.";
  }

  if (!/^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9'ʼ`\-.,&()\s]+$/.test(companyName)) {
    return "Назва компанії містить недопустимі символи.";
  }

  if (!/^\+380\d{9}$/.test(phone)) {
    return "Телефон має бути українським номером у форматі +380XXXXXXXXX.";
  }

  if (!isValidEmail(email)) {
    return "Вкажіть коректний email клієнта.";
  }

  if (mode === "create" || password.length > 0) {
    if (password.length < 6) {
      return "Пароль має містити мінімум 6 символів.";
    }

    if (password.length > 100) {
      return "Пароль не може бути довшим за 100 символів.";
    }

    if (!/[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(password)) {
      return "Пароль має містити мінімум одну літеру.";
    }

    if (!/\d/.test(password)) {
      return "Пароль має містити мінімум одну цифру.";
    }

    if (/\s/.test(password)) {
      return "Пароль не має містити пробіли.";
    }
  }

  return "";
}

async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "API повернув не JSON. Перевірте, чи існує потрібний route.ts і чи запущено npm run dev."
    );
  }

  return (await response.json()) as T;
}

export default function ClientsPage() {
  const { role } = useDashboard();

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingClientId, setEditingClientId] = useState<number | null>(null);

  const [form, setForm] = useState<ClientForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [confirmClient, setConfirmClient] = useState<Client | null>(null);
  const [confirmError, setConfirmError] = useState("");
  const [confirmSuccess, setConfirmSuccess] = useState("");

  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const [pageNotice, setPageNotice] = useState<{
    type: NoticeType;
    text: string;
  } | null>(null);

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
        await loadClients();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Сталася помилка під час завантаження клієнтів."
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
    }, 3600);
  }

  function upsertClient(client: Client) {
    setClients((current) => {
      const exists = current.some((item) => item.client_id === client.client_id);

      const next = exists
        ? current.map((item) => (item.client_id === client.client_id ? client : item))
        : [...current, client];

      return next.sort((a, b) => a.client_id - b.client_id);
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return clients.filter((client) => {
      const matchStatus = status === "all" || client.status === status;

      const matchQuery =
        !q ||
        client.full_name.toLowerCase().includes(q) ||
        client.company_name.toLowerCase().includes(q) ||
        client.email.toLowerCase().includes(q) ||
        client.phone.toLowerCase().includes(q);

      return matchStatus && matchQuery;
    });
  }, [clients, query, status]);

  const totals = useMemo(() => {
    const active = clients.filter((client) => client.status === "активний").length;
    const inactive = clients.filter((client) => client.status === "неактивний")
      .length;
    const companies = new Set(
      clients
        .map((client) => client.company_name.trim().toLowerCase())
        .filter(Boolean)
    ).size;

    return {
      total: clients.length,
      active,
      inactive,
      companies,
    };
  }, [clients]);

  function openCreateModal() {
    setModalMode("create");
    setEditingClientId(null);
    setForm(emptyForm);
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function openEditModal(client: Client) {
    setModalMode("edit");
    setEditingClientId(client.client_id);
    setForm({
      full_name: client.full_name,
      company_name: client.company_name === "Без компанії" ? "" : client.company_name,
      phone: client.phone || "+380",
      email: client.email,
      password: "",
      status: client.status === "неактивний" ? "неактивний" : "активний",
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setModalMode("create");
    setEditingClientId(null);
    setForm(emptyForm);
    setFormError("");
    setFormSuccess("");
  }

  function updateForm<K extends keyof ClientForm>(key: K, value: ClientForm[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));

    setFormError("");
    setFormSuccess("");
  }

  async function handleSaveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const preparedForm: ClientForm = {
      ...form,
      full_name: normalizeSpaces(form.full_name),
      company_name: normalizeSpaces(form.company_name),
      phone: formatPhoneInput(form.phone),
      email: normalizeEmailInput(form.email),
      password: form.password.trim(),
    };

    const validationError = validateClientForm(preparedForm, modalMode);

    if (validationError) {
      setForm(preparedForm);
      setFormError(validationError);
      return;
    }

    const isEditing = modalMode === "edit";

    if (isEditing && !editingClientId) {
      setFormError("Не вдалося визначити клієнта для редагування.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setFormSuccess("");

      const response = await fetch(
        isEditing ? `/api/clients/${editingClientId}` : "/api/clients",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            full_name: preparedForm.full_name,
            company_name: preparedForm.company_name,
            phone: preparedForm.phone,
            email: preparedForm.email,
            password: preparedForm.password,
            status: preparedForm.status,
          }),
        }
      );

      const result = await readApiJson<ApiClientResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(
          result.message ||
            (isEditing ? "Не вдалося оновити клієнта." : "Не вдалося додати клієнта.")
        );
      }

      upsertClient(result.data);

      if (isEditing) {
        setForm({
          ...preparedForm,
          password: "",
        });
        setFormSuccess("Дані клієнта успішно оновлено в PostgreSQL.");
        showPageNotice("success", "Дані клієнта оновлено.");
      } else {
        setForm(emptyForm);
        setFormSuccess(
          "Клієнта успішно додано в PostgreSQL. Можете додати ще одного або закрити вікно."
        );
        showPageNotice("success", "Нового клієнта додано в базу.");
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час збереження клієнта."
      );
    } finally {
      setSaving(false);
    }
  }

  function requestDeactivateClient(client: Client) {
    if (client.status === "неактивний") {
      showPageNotice("success", "Цей клієнт вже має статус «неактивний».");
      return;
    }

    setConfirmClient(client);
    setConfirmError("");
    setConfirmSuccess("");
  }

  function closeConfirmModal() {
    if (deactivating) return;

    setConfirmClient(null);
    setConfirmError("");
    setConfirmSuccess("");
  }

  async function confirmDeactivateClient() {
    if (!confirmClient) return;

    try {
      setDeactivating(true);
      setConfirmError("");
      setConfirmSuccess("");

      const response = await fetch(`/api/clients/${confirmClient.client_id}`, {
        method: "DELETE",
      });

      const result = await readApiJson<ApiClientResponse>(response);

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Не вдалося змінити статус клієнта.");
      }

      upsertClient(result.data);

      setConfirmSuccess(
        "Клієнта переведено у статус «неактивний». Історію брифів, проєктів, рахунків і оплат збережено."
      );

      showPageNotice(
        "success",
        "Клієнта переведено у статус «неактивний». Історію роботи збережено."
      );

      window.setTimeout(() => {
        setConfirmClient(null);
        setConfirmSuccess("");
      }, 900);
    } catch (err) {
      setConfirmError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час зміни статусу клієнта."
      );
    } finally {
      setDeactivating(false);
    }
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div className={styles.denied}>
        <span className="material-symbols-rounded">lock</span>
        <h2>Немає доступу</h2>
        <p>
          Розділ «Клієнти» доступний лише для ролей Директор та
          Акаунт-менеджер.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.empty}>
        <span className="material-symbols-rounded">sync</span>
        <p>Завантажуємо клієнтів з бази даних...</p>
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
    modalMode === "create" ? "Додати клієнта" : "Редагувати клієнта";

  const modalDescription =
    modalMode === "create"
      ? "Заповніть контактні дані клієнта. Після збереження запис зʼявиться в PostgreSQL."
      : "Оновіть дані клієнта. Якщо пароль змінювати не потрібно, залиште поле пароля порожнім.";

  return (
    <>
      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h1>Клієнти</h1>
            <p>
              Усього клієнтів: {totals.total} · Активних: {totals.active} ·
              Компаній: {totals.companies}
            </p>
          </div>

          <button className={styles.addButton} type="button" onClick={openCreateModal}>
            <span className="material-symbols-rounded">add</span>
            Додати клієнта
          </button>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.search}>
            <span className="material-symbols-rounded">search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="text"
              placeholder="Пошук за іменем, компанією, телефоном або email..."
            />
          </div>

          <div className={styles.filters}>
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cx(
                  styles.filterButton,
                  status === item.id && styles.filterActive
                )}
                onClick={() => setStatus(item.id)}
              >
                {item.label}
              </button>
            ))}
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

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Клієнт</th>
                <th>Компанія</th>
                <th>Телефон</th>
                <th>Email</th>
                <th>Статус</th>
                <th className={styles.actionsCol}>Дії</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((client) => (
                <tr key={client.client_id}>
                  <td>
                    <div className={styles.clientCell}>
                      <span className={styles.avatar}>
                        {getInitials(client.full_name)}
                      </span>

                      <span className={styles.clientName}>
                        {client.full_name}
                      </span>
                    </div>
                  </td>

                  <td>{client.company_name || "—"}</td>
                  <td className={styles.muted}>{client.phone}</td>
                  <td className={styles.muted}>{client.email}</td>

                  <td>
                    <span
                      className={cx(
                        styles.badge,
                        client.status === "активний"
                          ? styles.toneGreen
                          : styles.toneNeutral
                      )}
                    >
                      {client.status}
                    </span>
                  </td>

                  <td>
                    <div className={styles.rowActions}>
                      <button
                        className={styles.rowAction}
                        type="button"
                        title="Редагувати"
                        aria-label="Редагувати клієнта"
                        onClick={() => openEditModal(client)}
                      >
                        <span className="material-symbols-rounded">edit</span>
                      </button>

                      <button
                        className={styles.rowAction}
                        type="button"
                        title="Зробити неактивним"
                        aria-label="Зробити клієнта неактивним"
                        onClick={() => requestDeactivateClient(client)}
                        disabled={
                          saving ||
                          deactivating ||
                          client.status === "неактивний"
                        }
                      >
                        <span className="material-symbols-rounded">
                          person_off
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className={styles.empty}>
              <span className="material-symbols-rounded">search_off</span>
              <p>Нічого не знайдено за заданими умовами.</p>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeModal}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="client-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>
                  {modalMode === "create"
                    ? "Новий запис PostgreSQL"
                    : "Оновлення запису PostgreSQL"}
                </span>

                <h2 id="client-modal-title">{modalTitle}</h2>
                <p>{modalDescription}</p>
              </div>

              <button className={styles.modalClose} type="button" onClick={closeModal}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSaveClient} noValidate>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>ПІБ клієнта</span>
                  <input
                    value={form.full_name}
                    onChange={(event) =>
                      updateForm("full_name", normalizeNameInput(event.target.value))
                    }
                    onBlur={() => updateForm("full_name", normalizeSpaces(form.full_name))}
                    type="text"
                    placeholder="Наприклад: Олег Іваненко"
                    autoComplete="name"
                    maxLength={100}
                  />
                </label>

                <label className={styles.field}>
                  <span>Компанія</span>
                  <input
                    value={form.company_name}
                    onChange={(event) =>
                      updateForm(
                        "company_name",
                        normalizeCompanyInput(event.target.value)
                      )
                    }
                    onBlur={() =>
                      updateForm("company_name", normalizeSpaces(form.company_name))
                    }
                    type="text"
                    placeholder="Наприклад: AdFlow Demo"
                    maxLength={120}
                  />
                </label>

                <label className={styles.field}>
                  <span>Телефон</span>
                  <input
                    value={form.phone}
                    onFocus={() => {
                      if (!form.phone.trim()) {
                        updateForm("phone", "+380");
                      }
                    }}
                    onChange={(event) =>
                      updateForm("phone", formatPhoneInput(event.target.value))
                    }
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={13}
                    placeholder="+380671234567"
                  />
                </label>

                <label className={styles.field}>
                  <span>Email</span>
                  <input
                    value={form.email}
                    onChange={(event) =>
                      updateForm("email", normalizeEmailInput(event.target.value))
                    }
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="client@company.ua"
                    maxLength={120}
                  />
                </label>

                <label className={styles.field}>
                  <span>
                    {modalMode === "create"
                      ? "Пароль"
                      : "Новий пароль (необовʼязково)"}
                  </span>
                  <input
                    value={form.password}
                    onChange={(event) =>
                      updateForm("password", event.target.value.slice(0, 100))
                    }
                    type="password"
                    autoComplete="new-password"
                    placeholder={
                      modalMode === "create"
                        ? "Мінімум 6 символів, літера і цифра"
                        : "Залиште порожнім, якщо не змінюєте"
                    }
                    maxLength={100}
                  />
                </label>

                <label className={styles.field}>
                  <span>Статус</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm("status", event.target.value as ClientForm["status"])
                    }
                  >
                    <option value="активний">Активний</option>
                    <option value="неактивний">Неактивний</option>
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
                    {saving ? "sync" : modalMode === "create" ? "person_add" : "save"}
                  </span>

                  {saving
                    ? "Збереження..."
                    : modalMode === "create"
                    ? "Додати в базу"
                    : "Зберегти зміни"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {confirmClient && (
        <div className={styles.modalOverlay} onMouseDown={closeConfirmModal}>
          <section
            className={cx(styles.modal, styles.confirmModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-client-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <span className="material-symbols-rounded">
                {confirmSuccess ? "check_circle" : "person_off"}
              </span>
            </div>

            <div className={styles.confirmContent}>
              <span className={styles.modalKicker}>Зміна статусу в PostgreSQL</span>

              <h2 id="deactivate-client-modal-title">Деактивувати клієнта?</h2>

              <p>
                Клієнт <strong>{confirmClient.full_name}</strong> буде
                переведений у статус <strong>«неактивний»</strong>.
              </p>

              <p className={styles.confirmNote}>
                Запис не буде видалено фізично з бази. Це потрібно, щоб зберегти
                історію брифів, проєктів, рахунків і оплат.
              </p>

              {(confirmError || confirmSuccess) && (
                <div
                  className={cx(
                    styles.formMessage,
                    confirmError ? styles.formMessageError : styles.formMessageSuccess
                  )}
                >
                  <span className="material-symbols-rounded">
                    {confirmError ? "error" : "check_circle"}
                  </span>
                  {confirmError || confirmSuccess}
                </div>
              )}
            </div>

            <div className={styles.modalActions}>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={closeConfirmModal}
                disabled={deactivating}
              >
                Скасувати
              </button>

              <button
                className={styles.dangerButton}
                type="button"
                onClick={confirmDeactivateClient}
                disabled={deactivating || Boolean(confirmSuccess)}
              >
                <span className="material-symbols-rounded">
                  {deactivating ? "sync" : "person_off"}
                </span>
                {deactivating ? "Оновлення..." : "Так, деактивувати"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}