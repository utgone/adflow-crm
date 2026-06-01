"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import styles from "./page.module.css";

type RegisterForm = {
  name: string;
  company: string;
  phone: string;
  email: string;
  password: string;
  confirm: string;
  agree: boolean;
};

type RegisterErrors = {
  name?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirm?: string;
  agree?: string;
};

type RegisterResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
};

const MAX_NAME = 60;
const MAX_COMPANY = 120;
const MAX_EMAIL = 254;
const MAX_PASSWORD = 72;

const letterRegex = /[A-Za-zА-Яа-яЇїІіЄєҐґ]/;
const nameRegex = /^[A-Za-zА-Яа-яЇїІіЄєҐґ'’\- ]{2,60}$/;
const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const phoneNormalizedRegex = /^\+[0-9]{10,15}$/;

const highlights = [
  { id: "briefs", icon: "assignment", text: "Заявки та брифи онлайн" },
  { id: "approve", icon: "fact_check", text: "Погодження матеріалів" },
  { id: "invoices", icon: "receipt_long", text: "Рахунки та статуси проєктів" },
];

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function validate(values: RegisterForm): RegisterErrors {
  const errors: RegisterErrors = {};
  const name = values.name.trim();
  const phone = values.phone.trim();
  const email = values.email.trim();

  if (!name) {
    errors.name = "Введіть ім'я";
  } else if (name.length < 2 || name.length > MAX_NAME) {
    errors.name = "Ім'я: від 2 до 60 символів";
  } else if (!letterRegex.test(name) || !nameRegex.test(name)) {
    errors.name = "Лише літери, пробіл, апостроф і дефіс";
  }

  if (!phone) {
    errors.phone = "Введіть номер телефону";
  } else if (!phoneNormalizedRegex.test(normalizePhone(phone))) {
    errors.phone = "Формат: +380XXXXXXXXX";
  }

  if (!email) {
    errors.email = "Введіть email";
  } else if (email.length > MAX_EMAIL) {
    errors.email = "Email занадто довгий";
  } else if (!emailRegex.test(email)) {
    errors.email = "Введіть коректний email";
  }

  if (!values.password) {
    errors.password = "Введіть пароль";
  } else if (/^\s+$/.test(values.password)) {
    errors.password = "Пароль не може складатися лише з пробілів";
  } else if (values.password.length < 8) {
    errors.password = "Мінімум 8 символів";
  } else if (values.password.length > MAX_PASSWORD) {
    errors.password = "Максимум 72 символи";
  }

  if (!values.confirm) {
    errors.confirm = "Повторіть пароль";
  } else if (values.confirm !== values.password) {
    errors.confirm = "Паролі не співпадають";
  }

  if (!values.agree) {
    errors.agree = "Прийміть умови використання";
  }

  return errors;
}

function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "Сервер реєстрації повернув некоректну відповідь. Спробуйте пізніше."
    );
  }

  return (await response.json()) as T;
}

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState<RegisterForm>({
    name: "",
    company: "",
    phone: "",
    email: "",
    password: "",
    confirm: "",
    agree: false,
  });
  const [touched, setTouched] = useState<Record<keyof RegisterForm, boolean>>({
    name: false,
    company: false,
    phone: false,
    email: false,
    password: false,
    confirm: false,
    agree: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [capsField, setCapsField] = useState<"" | "password" | "confirm">("");
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  const score = passwordScore(form.password);
  const strengthLevel = score <= 1 ? "weak" : score <= 3 ? "medium" : "strong";
  const strengthText =
    score <= 1
      ? "Слабкий пароль"
      : score <= 3
      ? "Середній пароль"
      : "Надійний пароль";

  const update = <T extends keyof RegisterForm>(
    field: T,
    value: RegisterForm[T]
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
    setServerError("");
    setSuccess("");
  };

  const touch = (field: keyof RegisterForm) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const showError = (field: keyof RegisterErrors) =>
    Boolean((touched[field] || submitted) && errors[field]);

  const detectCaps =
    (field: "password" | "confirm") =>
    (event: KeyboardEvent<HTMLInputElement>) => {
      setCapsField(event.getModifierState("CapsLock") ? field : "");
    };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitted(true);
    setTouched({
      name: true,
      company: true,
      phone: true,
      email: true,
      password: true,
      confirm: true,
      agree: true,
    });
    setServerError("");
    setSuccess("");

    if (!isValid) {
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          company: form.company.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });

      const result = await readApiJson<RegisterResponse>(response);

      if (!response.ok || result.ok === false) {
        throw new Error(result.message || "Не вдалося створити акаунт.");
      }

      setSuccess("Акаунт створено. Відкриваємо кабінет...");

      window.setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 650);
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "Не вдалося створити акаунт. Спробуйте ще раз."
      );
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.glow} aria-hidden="true" />

      <div className={styles.shell}>
        <aside className={styles.brand}>
          <Link href="/" className={styles.logo}>
            <Image
              src="/brand/logo.svg"
              alt="AdFlow CRM"
              width={40}
              height={40}
              className={styles.logoMark}
              priority
            />
            <span>AdFlow CRM</span>
          </Link>

          <div className={styles.brandBody}>
            <h1 className={styles.brandTitle}>Створіть кабінет клієнта</h1>
            <p className={styles.brandText}>
              Реєстрація для клієнтів агенції: подавайте брифи, погоджуйте
              рекламні матеріали та стежте за рахунками в одному кабінеті.
            </p>

            <ul className={styles.highlights}>
              {highlights.map((item) => (
                <li className={styles.highlight} key={item.id}>
                  <span className={styles.highlightIcon}>
                    <span className="material-symbols-rounded">{item.icon}</span>
                  </span>
                  {item.text}
                </li>
              ))}
            </ul>
          </div>

          <p className={styles.brandFoot}>Курсовий проєкт — AdFlow CRM</p>
        </aside>

        <section className={styles.formPanel}>
          <form
            className={styles.form}
            onSubmit={handleSubmit}
            noValidate
            aria-busy={loading}
          >
            <Link href="/" className={styles.back}>
              <span className="material-symbols-rounded">arrow_back</span>
              На головну
            </Link>

            <div className={styles.formHead}>
              <h2 className={styles.formTitle}>Реєстрація клієнта</h2>
              <p className={styles.formSubtitle}>
                Заповніть дані, щоб подавати заявки
              </p>
            </div>

            <div className={styles.grid}>
              <label className={styles.field}>
              <span className={styles.label}>{"Повне ім'я"}</span>
                <div
                  className={`${styles.inputWrap} ${
                    showError("name") ? styles.inputError : ""
                  }`}
                >
                  <span className="material-symbols-rounded">person</span>
                  <input
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    onBlur={() => touch("name")}
                    type="text"
                    placeholder="Олександр Коваленко"
                    autoComplete="name"
                    autoFocus
                    maxLength={MAX_NAME}
                    disabled={loading}
                  />
                </div>
                {showError("name") && (
                  <small className={styles.errorText}>{errors.name}</small>
                )}
              </label>

              <label className={styles.field}>
               <span className={styles.label}>{"Компанія (необов'язково)"}</span>
                <div className={styles.inputWrap}>
                  <span className="material-symbols-rounded">business</span>
                  <input
                    value={form.company}
                    onChange={(event) => update("company", event.target.value)}
                    onBlur={() => touch("company")}
                    type="text"
                    placeholder="Nova Media"
                    autoComplete="organization"
                    maxLength={MAX_COMPANY}
                    disabled={loading}
                  />
                </div>
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Номер телефону</span>
                <div
                  className={`${styles.inputWrap} ${
                    showError("phone") ? styles.inputError : ""
                  }`}
                >
                  <span className="material-symbols-rounded">call</span>
                  <input
                    value={form.phone}
                    onChange={(event) => update("phone", event.target.value)}
                    onBlur={() => touch("phone")}
                    type="tel"
                    placeholder="+380671234567"
                    autoComplete="tel"
                    maxLength={20}
                    disabled={loading}
                  />
                </div>
                {showError("phone") && (
                  <small className={styles.errorText}>{errors.phone}</small>
                )}
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Email</span>
                <div
                  className={`${styles.inputWrap} ${
                    showError("email") ? styles.inputError : ""
                  }`}
                >
                  <span className="material-symbols-rounded">mail</span>
                  <input
                    value={form.email}
                    onChange={(event) => update("email", event.target.value)}
                    onBlur={() => touch("email")}
                    type="email"
                    placeholder="name@agency.com"
                    autoComplete="email"
                    maxLength={MAX_EMAIL}
                    disabled={loading}
                  />
                </div>
                {showError("email") && (
                  <small className={styles.errorText}>{errors.email}</small>
                )}
              </label>

              <label className={`${styles.field} ${styles.full}`}>
                <span className={styles.label}>Пароль</span>
                <div
                  className={`${styles.inputWrap} ${styles.passwordWrap} ${
                    showError("password") ? styles.inputError : ""
                  }`}
                >
                  <span className="material-symbols-rounded">lock</span>
                  <input
                    value={form.password}
                    onChange={(event) => update("password", event.target.value)}
                    onBlur={() => {
                      touch("password");
                      setCapsField("");
                    }}
                    onKeyUp={detectCaps("password")}
                    onKeyDown={detectCaps("password")}
                    type={showPassword ? "text" : "password"}
                    placeholder="Мінімум 8 символів"
                    autoComplete="new-password"
                    maxLength={MAX_PASSWORD}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className={styles.eye}
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Сховати пароль" : "Показати пароль"}
                    disabled={loading}
                  >
                    <span className="material-symbols-rounded">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>

                {form.password && (
                  <div className={styles.strength} data-level={strengthLevel}>
                    <div className={styles.strengthBars}>
                      {[0, 1, 2, 3].map((index) => (
                        <span
                          key={index}
                          className={index < score ? styles.strengthOn : ""}
                        />
                      ))}
                    </div>
                    <span className={styles.strengthLabel}>{strengthText}</span>
                  </div>
                )}

                {showError("password") && (
                  <small className={styles.errorText}>{errors.password}</small>
                )}

                {capsField === "password" && (
                  <small className={styles.capsHint}>
                    <span className="material-symbols-rounded">
                      keyboard_capslock
                    </span>
                    Увімкнено Caps Lock
                  </small>
                )}
              </label>

              <label className={`${styles.field} ${styles.full}`}>
                <span className={styles.label}>Підтвердити пароль</span>
                <div
                  className={`${styles.inputWrap} ${styles.passwordWrap} ${
                    showError("confirm") ? styles.inputError : ""
                  }`}
                >
                  <span className="material-symbols-rounded">lock</span>
                  <input
                    value={form.confirm}
                    onChange={(event) => update("confirm", event.target.value)}
                    onBlur={() => {
                      touch("confirm");
                      setCapsField("");
                    }}
                    onKeyUp={detectCaps("confirm")}
                    onKeyDown={detectCaps("confirm")}
                    type={showConfirm ? "text" : "password"}
                    placeholder="Повторіть пароль"
                    autoComplete="new-password"
                    maxLength={MAX_PASSWORD}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className={styles.eye}
                    onClick={() => setShowConfirm((current) => !current)}
                    aria-label={showConfirm ? "Сховати пароль" : "Показати пароль"}
                    disabled={loading}
                  >
                    <span className="material-symbols-rounded">
                      {showConfirm ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
                {showError("confirm") && (
                  <small className={styles.errorText}>{errors.confirm}</small>
                )}

                {capsField === "confirm" && (
                  <small className={styles.capsHint}>
                    <span className="material-symbols-rounded">
                      keyboard_capslock
                    </span>
                    Увімкнено Caps Lock
                  </small>
                )}
              </label>
            </div>

            <div className={styles.agree}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={form.agree}
                  onChange={(event) => update("agree", event.target.checked)}
                  disabled={loading}
                />
                <span>Погоджуюсь з умовами та політикою конфіденційності</span>
              </label>
              {showError("agree") && (
                <small className={styles.errorText}>{errors.agree}</small>
              )}
            </div>

            <button
              type="submit"
              className={styles.submit}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? "Створюємо..." : "Створити акаунт"}
              <span
                className={`material-symbols-rounded ${
                  loading ? styles.spinIcon : ""
                }`}
              >
                {loading ? "progress_activity" : "arrow_forward"}
              </span>
            </button>

            {serverError && (
              <div className={styles.error} role="alert">
                <span className="material-symbols-rounded">error</span>
                <p>{serverError}</p>
              </div>
            )}

            {success && (
              <div className={styles.success} role="status">
                <span className="material-symbols-rounded">check_circle</span>
                <p>{success}</p>
              </div>
            )}

            <p className={styles.switch}>
              Вже маєте акаунт? <Link href="/login">Увійти</Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}