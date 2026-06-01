"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Role, useDashboard } from "../layout";
import styles from "./page.module.css";

type Employee = {
  employee_id: number;
  full_name: string;
  position_id: number;
  position_name: string;
  login: string;
  contacts: string;
  birth_date: string;
  status: string;
};

type Position = {
  position_id: number;
  position_name: string;
  description: string | null;
};

type StatusFilter = "all" | "працює" | "звільнений";
type ModalMode = "create" | "edit";
type NoticeType = "success" | "error";

type EmployeeForm = {
  full_name: string;
  position_id: string;
  login: string;
  password: string;
  contacts: string;
  birth_date: string;
  status: "працює" | "звільнений";
};

type ApiEmployeesResponse = {
  ok: boolean;
  data?: Employee[];
  message?: string;
};

type ApiPositionsResponse = {
  ok: boolean;
  data?: Position[];
  message?: string;
};

type ApiEmployeeResponse = {
  ok: boolean;
  data?: Employee | null;
  message?: string;
};

const allowedRoles: Role[] = ["director"];

const EMPLOYEE_MIN_AGE = 16;
const EMPLOYEE_MAX_AGE = 80;

const statusOptions: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "Всі статуси" },
  { id: "працює", label: "Працюють" },
  { id: "звільнений", label: "Звільнені" },
];

const emptyForm: EmployeeForm = {
  full_name: "",
  position_id: "",
  login: "",
  password: "",
  contacts: "+380",
  birth_date: "",
  status: "працює",
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

function shiftYearISO(yearsAgo: number) {
  const today = new Date();
  const date = new Date(
    today.getFullYear() - yearsAgo,
    today.getMonth(),
    today.getDate()
  );

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function normalizeDate(value: string) {
  return value.includes("T") ? value.split("T")[0] : value;
}

function formatDate(value: string) {
  const iso = normalizeDate(value);
  const [year, month, day] = iso.split("-");

  if (!year || !month || !day) {
    return "—";
  }

  return `${day}.${month}.${year}`;
}

function toUTC(value: string) {
  const iso = normalizeDate(value);
  const [year, month, day] = iso.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

function getAge(birthDate: string) {
  const iso = normalizeDate(birthDate);
  const [birthYear, birthMonth, birthDay] = iso.split("-").map(Number);
  const [todayYear, todayMonth, todayDay] = getTodayISO().split("-").map(Number);

  let age = todayYear - birthYear;

  if (
    todayMonth < birthMonth ||
    (todayMonth === birthMonth && todayDay < birthDay)
  ) {
    age -= 1;
  }

  return age;
}

function getExperienceLabel(positionName: string) {
  const lower = positionName.toLowerCase();

  if (lower.includes("директор")) return "Керує агентством";
  if (lower.includes("акаунт")) return "Веде клієнтів";
  if (lower.includes("контент")) return "Контент і матеріали";
  if (lower.includes("таргет")) return "Реклама і кампанії";
  if (lower.includes("дизайн")) return "Креативи";
  if (lower.includes("seo")) return "SEO";
  if (lower.includes("web")) return "Web";
  if (lower.includes("бухгалтер")) return "Фінанси";

  return "Команда";
}

function statusClass(status: string) {
  if (status === "працює") return styles.toneGreen;
  if (status === "звільнений") return styles.toneNeutral;

  return styles.toneNeutral;
}

function birthdayDistance(birthDate: string) {
  const iso = normalizeDate(birthDate);
  const [, month, day] = iso.split("-").map(Number);
  const [year] = getTodayISO().split("-").map(Number);

  let nextBirthday = `${year}-${String(month).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;

  if (toUTC(nextBirthday) < toUTC(getTodayISO())) {
    nextBirthday = `${year + 1}-${String(month).padStart(2, "0")}-${String(
      day
    ).padStart(2, "0")}`;
  }

  const days = Math.round((toUTC(nextBirthday) - toUTC(getTodayISO())) / 86400000);

  if (days === 0) return "сьогодні";
  if (days === 1) return "завтра";

  return `через ${days} дн.`;
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

function sanitizeLogin(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 50);
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

function getBirthDateBounds() {
  return {
    min: shiftYearISO(EMPLOYEE_MAX_AGE),
    max: shiftYearISO(EMPLOYEE_MIN_AGE),
  };
}

function getBirthDateError(value: string) {
  if (!value) {
    return "Вкажіть дату народження.";
  }

  if (!isRealISODate(value)) {
    return "Вкажіть реальну дату народження.";
  }

  const { min, max } = getBirthDateBounds();

  if (value < min) {
    return `Вік співробітника не може перевищувати ${EMPLOYEE_MAX_AGE} років.`;
  }

  if (value > max) {
    return `Співробітнику має бути не менше ${EMPLOYEE_MIN_AGE} років.`;
  }

  return "";
}

function validateForm(form: EmployeeForm, mode: ModalMode) {
  const fullName = normalizeSpaces(form.full_name);
  const nameParts = fullName.split(" ").filter(Boolean);
  const login = form.login.trim();
  const password = form.password.trim();
  const contacts = form.contacts.trim();

  if (fullName.length < 5) return "Вкажіть повне ПІБ співробітника.";
  if (nameParts.length < 2) return "ПІБ має містити мінімум імʼя та прізвище.";
  if (nameParts.some((part) => part.length < 2)) {
    return "Кожна частина ПІБ має містити мінімум 2 символи.";
  }
  if (!/^[A-Za-zА-Яа-яІіЇїЄєҐґ'ʼ`\-\s]+$/.test(fullName)) {
    return "ПІБ не має містити цифри або службові символи.";
  }
  if (fullName.length > 100) return "ПІБ не може бути довшим за 100 символів.";
  if (!form.position_id) return "Оберіть посаду співробітника.";

  if (!/^[a-z0-9._-]{3,50}$/.test(login)) {
    return "Логін: 3–50 символів, тільки латиниця, цифри, крапка, дефіс або нижнє підкреслення.";
  }
  if (/^[._-]|[._-]$/.test(login)) {
    return "Логін не має починатися або закінчуватися крапкою, дефісом чи підкресленням.";
  }
  if (/[._-]{2,}/.test(login)) {
    return "У логіні не повинно бути двох службових символів підряд.";
  }

  if (mode === "create" || password.length > 0) {
    if (password.length < 6) return "Пароль має містити мінімум 6 символів.";
    if (password.length > 100) return "Пароль не може бути довшим за 100 символів.";
    if (!/[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(password)) {
      return "Пароль має містити мінімум одну літеру.";
    }
    if (!/\d/.test(password)) return "Пароль має містити мінімум одну цифру.";
    if (/\s/.test(password)) return "Пароль не має містити пробіли.";
  }

  if (!/^\+380\d{9}$/.test(contacts)) {
    return "Телефон має бути українським номером у форматі +380XXXXXXXXX.";
  }

  const birthDateError = getBirthDateError(form.birth_date);
  if (birthDateError) return birthDateError;

  return "";
}

export default function EmployeesPage() {
  const { role } = useDashboard();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [position, setPosition] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);

  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const [pageNotice, setPageNotice] = useState<{
    type: NoticeType;
    text: string;
  } | null>(null);

  const [confirmEmployee, setConfirmEmployee] = useState<Employee | null>(null);
  const [confirmError, setConfirmError] = useState("");
  const [confirmSuccess, setConfirmSuccess] = useState("");

  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const birthDateBounds = useMemo(() => getBirthDateBounds(), []);

  async function loadEmployees() {
    const response = await fetch("/api/employees", { cache: "no-store" });
    const result = (await response.json()) as ApiEmployeesResponse;

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити співробітників");
    }

    setEmployees(result.data);
  }

  async function loadPositions() {
    const response = await fetch("/api/positions", { cache: "no-store" });
    const result = (await response.json()) as ApiPositionsResponse;

    if (!response.ok || !result.ok || !Array.isArray(result.data)) {
      throw new Error(result.message || "Не вдалося завантажити посади");
    }

    setPositions(result.data);
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadEmployees(), loadPositions()]);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Сталася помилка під час завантаження"
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

  function upsertEmployee(employee: Employee) {
    setEmployees((current) => {
      const exists = current.some((item) => item.employee_id === employee.employee_id);

      const next = exists
        ? current.map((item) =>
            item.employee_id === employee.employee_id ? employee : item
          )
        : [...current, employee];

      return next.sort((a, b) => a.employee_id - b.employee_id);
    });
  }

  const positionNames = useMemo(() => {
    return Array.from(new Set(employees.map((employee) => employee.position_name)));
  }, [employees]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchStatus = status === "all" || employee.status === status;
      const matchPosition =
        position === "all" || employee.position_name === position;

      const matchQuery =
        !q ||
        employee.full_name.toLowerCase().includes(q) ||
        employee.position_name.toLowerCase().includes(q) ||
        employee.login.toLowerCase().includes(q) ||
        employee.contacts.toLowerCase().includes(q);

      return matchStatus && matchPosition && matchQuery;
    });
  }, [employees, position, query, status]);

  const totals = useMemo(() => {
    const active = filtered.filter((employee) => employee.status === "працює")
      .length;

    const inactive = filtered.filter(
      (employee) => employee.status === "звільнений"
    ).length;

    const uniquePositions = new Set(filtered.map((employee) => employee.position_id))
      .size;

    const averageAge = filtered.length
      ? Math.round(
          filtered.reduce((sum, employee) => sum + getAge(employee.birth_date), 0) /
            filtered.length
        )
      : 0;

    return { active, inactive, uniquePositions, averageAge };
  }, [filtered]);

  function openCreateModal() {
    setModalMode("create");
    setEditingEmployeeId(null);
    setForm(emptyForm);
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function openEditModal(employee: Employee) {
    setModalMode("edit");
    setEditingEmployeeId(employee.employee_id);
    setForm({
      full_name: employee.full_name,
      position_id: String(employee.position_id),
      login: employee.login,
      password: "",
      contacts: employee.contacts || "+380",
      birth_date: normalizeDate(employee.birth_date),
      status: employee.status === "звільнений" ? "звільнений" : "працює",
    });
    setFormError("");
    setFormSuccess("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setModalMode("create");
    setEditingEmployeeId(null);
    setForm(emptyForm);
    setFormError("");
    setFormSuccess("");
  }

  function updateForm<K extends keyof EmployeeForm>(key: K, value: EmployeeForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError("");
    setFormSuccess("");
  }

  async function handleSaveEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const preparedForm: EmployeeForm = {
      ...form,
      full_name: normalizeSpaces(form.full_name),
      login: sanitizeLogin(form.login),
      contacts: formatPhoneInput(form.contacts),
      password: form.password.trim(),
    };

    const validationError = validateForm(preparedForm, modalMode);

    if (validationError) {
      setForm(preparedForm);
      setFormError(validationError);
      return;
    }

    const isEditing = modalMode === "edit";

    if (isEditing && !editingEmployeeId) {
      setFormError("Не вдалося визначити співробітника для редагування.");
      return;
    }

    try {
      setSaving(true);
      setFormError("");
      setFormSuccess("");

      const response = await fetch(
        isEditing ? `/api/employees/${editingEmployeeId}` : "/api/employees",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: preparedForm.full_name,
            position_id: Number(preparedForm.position_id),
            login: preparedForm.login,
            password: preparedForm.password,
            contacts: preparedForm.contacts,
            birth_date: preparedForm.birth_date,
            status: preparedForm.status,
          }),
        }
      );

      const result = (await response.json()) as ApiEmployeeResponse;

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(
          result.message ||
            (isEditing
              ? "Не вдалося оновити співробітника."
              : "Не вдалося додати співробітника.")
        );
      }

      upsertEmployee(result.data);

      if (isEditing) {
        setForm({ ...preparedForm, password: "" });
        setFormSuccess("Дані співробітника успішно оновлено в PostgreSQL.");
        showPageNotice("success", "Дані співробітника оновлено.");
      } else {
        setFormSuccess(
          "Співробітника успішно додано в PostgreSQL. Можете додати ще одного або закрити вікно."
        );
        setForm(emptyForm);
        showPageNotice("success", "Нового співробітника додано в базу.");
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час збереження співробітника."
      );
    } finally {
      setSaving(false);
    }
  }

  function requestDeactivateEmployee(employee: Employee) {
    if (employee.status === "звільнений") {
      showPageNotice("success", "Цей співробітник вже має статус «звільнений».");
      return;
    }

    setConfirmEmployee(employee);
    setConfirmError("");
    setConfirmSuccess("");
  }

  function closeConfirmModal() {
    if (deactivating) return;

    setConfirmEmployee(null);
    setConfirmError("");
    setConfirmSuccess("");
  }

  async function confirmDeactivateEmployee() {
    if (!confirmEmployee) return;

    try {
      setDeactivating(true);
      setConfirmError("");
      setConfirmSuccess("");

      const response = await fetch(`/api/employees/${confirmEmployee.employee_id}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as ApiEmployeeResponse;

      if (!response.ok || !result.ok || !result.data) {
        throw new Error(result.message || "Не вдалося змінити статус співробітника.");
      }

      upsertEmployee(result.data);

      setConfirmSuccess(
        "Статус співробітника оновлено. Запис залишився в базі для збереження історії."
      );

      showPageNotice(
        "success",
        "Співробітника переведено у статус «звільнений». Історію задач і призначень збережено."
      );

      window.setTimeout(() => {
        setConfirmEmployee(null);
        setConfirmSuccess("");
      }, 900);
    } catch (err) {
      setConfirmError(
        err instanceof Error
          ? err.message
          : "Сталася помилка під час зміни статусу співробітника."
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
        <p>Розділ «Співробітники» доступний лише директору агентства.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.empty}>
        <span className="material-symbols-rounded">sync</span>
        <p>Завантажуємо співробітників з бази даних...</p>
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
    modalMode === "create" ? "Додати співробітника" : "Редагувати співробітника";

  const modalDescription =
    modalMode === "create"
      ? "Заповніть дані працівника. Форма одразу перевіряє ПІБ, логін, пароль, український номер телефону та дату народження."
      : "Оновіть дані працівника. Якщо пароль змінювати не потрібно, залиште поле пароля порожнім.";

  return (
    <>
      <div className={styles.page}>
        <header className={styles.head}>
          <div className={styles.headText}>
            <h1>Співробітники</h1>
            <p>Команда рекламної агенції, посади, контакти та статуси працівників</p>
          </div>

          <button className={styles.addButton} type="button" onClick={openCreateModal}>
            <span className="material-symbols-rounded">person_add</span>
            Додати співробітника
          </button>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.search}>
            <span className="material-symbols-rounded">search</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="text"
              placeholder="Пошук за ПІБ, посадою, логіном або телефоном..."
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
              <option value="all">Всі посади</option>
              {positionNames.map((item) => (
                <option key={item} value={item}>
                  {item}
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
              <span className="material-symbols-rounded">groups</span>
            </span>

            <div>
              <p>У команді</p>
              <strong>{filtered.length}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">check_circle</span>
            </span>

            <div>
              <p>Працюють</p>
              <strong>{totals.active}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">work</span>
            </span>

            <div>
              <p>Посади</p>
              <strong>{totals.uniquePositions}</strong>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <span className={styles.summaryIcon}>
              <span className="material-symbols-rounded">cake</span>
            </span>

            <div>
              <p>Середній вік</p>
              <strong>{totals.averageAge}</strong>
            </div>
          </article>
        </section>

        {filtered.length > 0 ? (
          <section className={styles.employeeGrid}>
            {filtered.map((employee) => (
              <article className={styles.card} key={employee.employee_id}>
                <div className={styles.cardTop}>
                  <span className={styles.avatar}>{getInitials(employee.full_name)}</span>

                  <span className={cx(styles.badge, statusClass(employee.status))}>
                    {employee.status}
                  </span>
                </div>

                <div className={styles.employeeMain}>
                  <h2>{employee.full_name}</h2>
                  <p>{employee.position_name}</p>
                </div>

                <div className={styles.employeeMeta}>
                  <div>
                    <span className="material-symbols-rounded">alternate_email</span>

                    <div>
                      <small>Логін</small>
                      <strong>{employee.login}</strong>
                    </div>
                  </div>

                  <div>
                    <span className="material-symbols-rounded">call</span>

                    <div>
                      <small>Контакти</small>
                      <strong>{employee.contacts}</strong>
                    </div>
                  </div>

                  <div>
                    <span className="material-symbols-rounded">cake</span>

                    <div>
                      <small>Дата народження</small>
                      <strong>
                        {formatDate(employee.birth_date)} · {getAge(employee.birth_date)} р.
                      </strong>
                    </div>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <div>
                    <span>{getExperienceLabel(employee.position_name)}</span>
                    <small>День народження {birthdayDistance(employee.birth_date)}</small>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      className={styles.rowAction}
                      type="button"
                      onClick={() => openEditModal(employee)}
                    >
                      <span className="material-symbols-rounded">edit</span>
                      Редагувати
                    </button>

                    <button
                      className={styles.rowAction}
                      type="button"
                      onClick={() => requestDeactivateEmployee(employee)}
                      disabled={saving || deactivating || employee.status === "звільнений"}
                    >
                      <span className="material-symbols-rounded">person_remove</span>
                      Звільнити
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        ) : (
          <div className={styles.empty}>
            <span className="material-symbols-rounded">group_off</span>
            <p>Співробітників за вибраними умовами не знайдено.</p>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} onMouseDown={closeModal}>
          <section
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHead}>
              <div>
                <span className={styles.modalKicker}>
                  {modalMode === "create"
                    ? "Новий запис PostgreSQL"
                    : "Оновлення запису PostgreSQL"}
                </span>
                <h2 id="employee-modal-title">{modalTitle}</h2>
                <p>{modalDescription}</p>
              </div>

              <button className={styles.modalClose} type="button" onClick={closeModal}>
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <form className={styles.form} onSubmit={handleSaveEmployee} noValidate>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>ПІБ співробітника</span>
                  <input
                    value={form.full_name}
                    onChange={(event) =>
                      updateForm("full_name", normalizeNameInput(event.target.value))
                    }
                    onBlur={() =>
                      updateForm("full_name", normalizeSpaces(form.full_name))
                    }
                    type="text"
                    placeholder="Наприклад: Іван Петренко"
                    autoComplete="name"
                    maxLength={100}
                  />
                </label>

                <label className={styles.field}>
                  <span>Посада</span>
                  <select
                    value={form.position_id}
                    onChange={(event) => updateForm("position_id", event.target.value)}
                  >
                    <option value="">Оберіть посаду</option>
                    {positions.map((item) => (
                      <option value={item.position_id} key={item.position_id}>
                        {item.position_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>Логін</span>
                  <input
                    value={form.login}
                    onChange={(event) =>
                      updateForm("login", sanitizeLogin(event.target.value))
                    }
                    type="text"
                    placeholder="ivan.petrenko"
                    autoComplete="username"
                    maxLength={50}
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
                    placeholder={
                      modalMode === "create"
                        ? "Мінімум 6 символів, літера і цифра"
                        : "Залиште порожнім, якщо не змінюєте"
                    }
                    autoComplete="new-password"
                    maxLength={100}
                  />
                </label>

                <label className={styles.field}>
                  <span>Телефон</span>
                  <input
                    value={form.contacts}
                    onFocus={() => {
                      if (!form.contacts.trim()) {
                        updateForm("contacts", "+380");
                      }
                    }}
                    onChange={(event) =>
                      updateForm("contacts", formatPhoneInput(event.target.value))
                    }
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={13}
                    placeholder="+380671234567"
                  />
                </label>

                <label className={styles.field}>
                  <span>Дата народження</span>
                  <input
                    value={form.birth_date}
                    onChange={(event) => updateForm("birth_date", event.target.value)}
                    type="date"
                    min={birthDateBounds.min}
                    max={birthDateBounds.max}
                  />
                </label>

                <label className={styles.field}>
                  <span>Статус</span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm(
                        "status",
                        event.target.value as EmployeeForm["status"]
                      )
                    }
                  >
                    <option value="працює">Працює</option>
                    <option value="звільнений">Звільнений</option>
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

      {confirmEmployee && (
        <div className={styles.modalOverlay} onMouseDown={closeConfirmModal}>
          <section
            className={cx(styles.modal, styles.confirmModal)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="deactivate-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.confirmIcon}>
              <span className="material-symbols-rounded">
                {confirmSuccess ? "check_circle" : "person_remove"}
              </span>
            </div>

            <div className={styles.confirmContent}>
              <span className={styles.modalKicker}>Зміна статусу в PostgreSQL</span>

              <h2 id="deactivate-modal-title">Звільнити співробітника?</h2>

              <p>
                Співробітник <strong>{confirmEmployee.full_name}</strong> буде
                переведений у статус <strong>«звільнений»</strong>.
              </p>

              <p className={styles.confirmNote}>
                Запис не буде видалено фізично з бази. Це потрібно, щоб зберегти
                історію задач, матеріалів і призначень у CRM.
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
                onClick={confirmDeactivateEmployee}
                disabled={deactivating || Boolean(confirmSuccess)}
              >
                <span className="material-symbols-rounded">
                  {deactivating ? "sync" : "person_remove"}
                </span>
                {deactivating ? "Оновлення..." : "Так, звільнити"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}