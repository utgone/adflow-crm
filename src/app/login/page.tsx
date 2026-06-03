"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import styles from "./page.module.css";

type LoginForm = {
  identifier: string;
  password: string;
  remember: boolean;
};

type LoginErrors = {
  identifier?: string;
  password?: string;
};

type LoginResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    id: number;
    name: string;
    email: string;
    role: string;
  };
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const loginRegex = /^[a-zA-Z0-9._-]{3,50}$/;

const highlights = [
  { id: "clients", icon: "groups", text: "Клієнти, проєкти та кампанії" },
  { id: "tasks", icon: "task_alt", text: "Задачі та робота команди" },
  { id: "finance", icon: "payments", text: "Рахунки, оплати та статистика" },
];

function validate(values: LoginForm): LoginErrors {
  const errors: LoginErrors = {};
  const identifier = values.identifier.trim();

  if (!identifier) {
    errors.identifier = "Введіть email або логін";
  } else if (identifier.includes("@") && !emailRegex.test(identifier)) {
    errors.identifier = "Введіть коректний email";
  } else if (!identifier.includes("@") && !loginRegex.test(identifier)) {
    errors.identifier = "Логін: 3–50 символів, латиниця, цифри, . - _";
  }

  if (!values.password) {
    errors.password = "Введіть пароль";
  } else if (values.password.length < 8) {
    errors.password = "Мінімум 8 символів";
  }

  return errors;
}

async function readApiJson<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    throw new Error(
      "Сервер авторизації повернув некоректну відповідь. Спробуйте пізніше."
    );
  }

  return (await response.json()) as T;
}

export default function LoginPage() {
  const router = useRouter();

  const [form, setForm] = useState<LoginForm>({
    identifier: "",
    password: "",
    remember: true,
  });

  const [touched, setTouched] = useState({
    identifier: false,
    password: false,
  });

  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  const update = <T extends keyof LoginForm>(field: T, value: LoginForm[T]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setServerError("");
    setSuccess("");
  };

  const showError = (field: keyof LoginErrors) =>
    Boolean((touched[field] || submitted) && errors[field]);

  const detectCaps = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState("CapsLock"));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSubmitted(true);
    setTouched({ identifier: true, password: true });
    setServerError("");
    setSuccess("");

    if (!isValid) {
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: form.identifier.trim(),
          password: form.password,
          remember: form.remember,
        }),
      });

      const result = await readApiJson<LoginResponse>(response);

      if (!response.ok || result.ok === false) {
        throw new Error(result.message || "Невірний email/логін або пароль.");
      }

      setSuccess("Вхід виконано. Відкриваємо кабінет...");

      window.setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 550);
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : "Не вдалося виконати вхід. Спробуйте ще раз."
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
              src="/brand/logo.webp"
              alt="AdFlow CRM"
              width={150}
              height={100}
              className={styles.logoMark}
              priority
            />
            
          </Link>

          <div className={styles.brandBody}>
            <h1 className={styles.brandTitle}>Вхід до вашої CRM</h1>

            <p className={styles.brandText}>
              Єдиний простір для клієнтів, кампаній і фінансів рекламної
              агенції.
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
              <h2 className={styles.formTitle}>Увійти в акаунт</h2>

              <p className={styles.formSubtitle}>
                Введіть email або логін та пароль для доступу до кабінету.
              </p>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>Email або логін</span>

              <div
                className={`${styles.inputWrap} ${
                  showError("identifier") ? styles.inputError : ""
                }`}
              >
                <span className="material-symbols-rounded">person</span>

                <input
                  value={form.identifier}
                  onChange={(event) => update("identifier", event.target.value)}
                  onBlur={() =>
                    setTouched((current) => ({ ...current, identifier: true }))
                  }
                  type="text"
                  placeholder="name@agency.com або manager_01"
                  autoComplete="username"
                  autoFocus
                  disabled={loading}
                />
              </div>

              {showError("identifier") && (
                <small className={styles.errorText}>{errors.identifier}</small>
              )}
            </label>

            <label className={styles.field}>
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
                    setTouched((current) => ({ ...current, password: true }));
                    setCapsLock(false);
                  }}
                  onKeyUp={detectCaps}
                  onKeyDown={detectCaps}
                  type={showPassword ? "text" : "password"}
                  placeholder="Введіть пароль"
                  autoComplete="current-password"
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

              {showError("password") && (
                <small className={styles.errorText}>{errors.password}</small>
              )}

              {capsLock && (
                <small className={styles.capsHint}>
                  <span className="material-symbols-rounded">
                    keyboard_capslock
                  </span>
                  Увімкнено Caps Lock
                </small>
              )}
            </label>

            <div className={styles.options}>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={form.remember}
                  onChange={(event) => update("remember", event.target.checked)}
                  disabled={loading}
                />
                <span>Запам’ятати мене</span>
              </label>

              <Link href="/forgot-password" className={styles.forgot}>
                Забули пароль?
              </Link>
            </div>

            <button
              type="submit"
              className={styles.submit}
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? "Перевіряємо..." : "Увійти"}
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
              Немає акаунта? <Link href="/register">Створити акаунт</Link>
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}