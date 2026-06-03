"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import ReCaptcha from "@/components/ReCaptcha";
import styles from "./page.module.css";

type RegisterForm = {
  name: string;
  company: string;
  phone: string;
  email: string;
  password: string;
  confirm: string;
  agree: boolean;
  captchaToken: string;
};

type RegisterErrors = {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  password?: string;
  confirm?: string;
  agree?: string;
  captchaToken?: string;
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

const UA_PREFIX = "+380";
const UA_LOCAL_DIGITS = 9;

const MAX_NAME = 60;
const MAX_COMPANY = 120;
const MAX_EMAIL = 254;
const MAX_PASSWORD = 72;

const letterRegex = /[A-Za-zА-Яа-яЇїІіЄєҐґ]/;
const nameRegex = /^[A-Za-zА-Яа-яЇїІіЄєҐґ'’\- ]{2,60}$/;
const companyRegex = /^[A-Za-zА-Яа-яЇїІіЄєҐґ0-9'’"№.,&()\- ]{2,120}$/;
const emailRegex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const ukrainianPhoneRegex = /^\+380\d{9}$/;

const highlights = [
  { id: "briefs", icon: "assignment", text: "Заявки та брифи онлайн" },
  { id: "approve", icon: "fact_check", text: "Погодження матеріалів" },
  { id: "invoices", icon: "receipt_long", text: "Рахунки та статуси проєктів" },
];

function compactSpaces(value: string) {
  return value.replace(/\s+/g, " ").trimStart();
}

function formatUkrainePhone(value: string) {
  const digits = value.replace(/\D/g, "");

  let localDigits = "";

  if (digits.startsWith("380")) {
    localDigits = digits.slice(3);
  } else if (digits.startsWith("0")) {
    localDigits = digits.slice(1);
  } else {
    localDigits = digits;
  }

  return `${UA_PREFIX}${localDigits.slice(0, UA_LOCAL_DIGITS)}`;
}

function getLocalPhoneDigits(phone: string) {
  return phone.replace(/\D/g, "").replace(/^380/, "").slice(0, UA_LOCAL_DIGITS);
}

function validate(values: RegisterForm): RegisterErrors {
  const errors: RegisterErrors = {};
  const name = values.name.trim();
  const company = values.company.trim();
  const phone = values.phone.trim();
  const email = values.email.trim().toLowerCase();
  const localPhoneDigits = getLocalPhoneDigits(phone);

  if (!name) {
    errors.name = "Введіть повне ім’я";
  } else if (name.length < 2 || name.length > MAX_NAME) {
    errors.name = "Ім’я: від 2 до 60 символів";
  } else if (!letterRegex.test(name) || !nameRegex.test(name)) {
    errors.name = "Лише літери, пробіл, апостроф і дефіс";
  }

  if (company) {
    if (company.length < 2) {
      errors.company = "Назва компанії занадто коротка";
    } else if (company.length > MAX_COMPANY) {
      errors.company = "Назва компанії занадто довга";
    } else if (!companyRegex.test(company)) {
      errors.company = "Недопустимі символи в назві компанії";
    }
  }

  if (!phone || phone === UA_PREFIX) {
    errors.phone = "Введіть номер телефону";
  } else if (localPhoneDigits.length !== UA_LOCAL_DIGITS) {
    errors.phone = "Після +380 має бути рівно 9 цифр";
  } else if (!ukrainianPhoneRegex.test(phone)) {
    errors.phone = "Формат номера: +380XXXXXXXXX";
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
  } else if (!/[A-Za-zА-Яа-яЇїІіЄєҐґ]/.test(values.password)) {
    errors.password = "Додайте хоча б одну літеру";
  } else if (!/\d/.test(values.password)) {
    errors.password = "Додайте хоча б одну цифру";
  }

  if (!values.confirm) {
    errors.confirm = "Повторіть пароль";
  } else if (values.confirm !== values.password) {
    errors.confirm = "Паролі не співпадають";
  }

  if (!values.agree) {
    errors.agree = "Прийміть умови використання";
  }

  if (!values.captchaToken) {
    errors.captchaToken = "Підтвердіть, що ви не робот";
  }

  return errors;
}

function passwordScore(password: string): number {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[a-zа-яіїєґ]/.test(password) && /[A-ZА-ЯІЇЄҐ]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-zА-Яа-яЇїІіЄєҐґ0-9]/.test(password)) score += 1;

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
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

  const [form, setForm] = useState<RegisterForm>({
    name: "",
    company: "",
    phone: UA_PREFIX,
    email: "",
    password: "",
    confirm: "",
    agree: false,
    captchaToken: "",
  });

  const [touched, setTouched] = useState<Record<keyof RegisterForm, boolean>>({
    name: false,
    company: false,
    phone: false,
    email: false,
    password: false,
    confirm: false,
    agree: false,
    captchaToken: false,
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

  const phoneDigitsCount = getLocalPhoneDigits(form.phone).length;

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

const resetCaptcha = (showCaptchaError = false) => {
  setForm((current) => ({ ...current, captchaToken: "" }));
  setTouched((current) => ({
    ...current,
    captchaToken: showCaptchaError,
  }));
};

const showError = (field: keyof RegisterErrors) => {
  if (field === "captchaToken") {
    return Boolean(touched.captchaToken && errors.captchaToken);
  }

  return Boolean((touched[field] || submitted) && errors[field]);
};

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
      captchaToken: true,
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
          email: form.email.trim().toLowerCase(),
          password: form.password,
          captchaToken: form.captchaToken,
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

 resetCaptcha(false);
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
            <h1 className={styles.brandTitle}>Кабінет клієнта</h1>

            <p className={styles.brandText}>
              Подання брифів, погодження матеріалів, рахунки та статуси проєктів
              в одному захищеному просторі.
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
                Заповніть дані та підтвердьте безпеку форми.
              </p>
            </div>

            <div className={styles.grid}>
              <label className={styles.field}>
                <span className={styles.label}>Повне ім’я</span>

                <div
                  className={`${styles.inputWrap} ${
                    showError("name") ? styles.inputError : ""
                  }`}
                >
                  <span className="material-symbols-rounded">person</span>

                  <input
                    value={form.name}
                    onChange={(event) =>
                      update("name", compactSpaces(event.target.value))
                    }
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
                <span className={styles.label}>Компанія</span>

                <div
                  className={`${styles.inputWrap} ${
                    showError("company") ? styles.inputError : ""
                  }`}
                >
                  <span className="material-symbols-rounded">business</span>

                  <input
                    value={form.company}
                    onChange={(event) =>
                      update("company", compactSpaces(event.target.value))
                    }
                    onBlur={() => touch("company")}
                    type="text"
                    placeholder="Nova Media"
                    autoComplete="organization"
                    maxLength={MAX_COMPANY}
                    disabled={loading}
                  />
                </div>

                {showError("company") && (
                  <small className={styles.errorText}>{errors.company}</small>
                )}
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
                    onChange={(event) =>
                      update("phone", formatUkrainePhone(event.target.value))
                    }
                    onFocus={() => {
                      if (!form.phone) update("phone", UA_PREFIX);
                    }}
                    onBlur={() => touch("phone")}
                    type="tel"
                    inputMode="numeric"
                    placeholder="+380XXXXXXXXX"
                    autoComplete="tel"
                    maxLength={13}
                    disabled={loading}
                  />
                </div>

                <span className={styles.phoneHint}>
                  Україна: +380 і ще {UA_LOCAL_DIGITS} цифр · введено{" "}
                  {phoneDigitsCount}/{UA_LOCAL_DIGITS}
                </span>

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
                    onChange={(event) =>
                      update("email", event.target.value.trim().toLowerCase())
                    }
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
                    placeholder="Мінімум 8 символів, літера і цифра"
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

            <div className={styles.captchaBlock}>
          <div className={styles.captchaHead}>
  <span className={styles.captchaCustomIcon}>
    <Image
      src="/tech/security.svg"
      alt=""
      width={22}
      height={22}
      aria-hidden="true"
    />
  </span>

  <div>
    <strong>Перевірка безпеки</strong>
    <p>Підтвердіть, що форму заповнює реальна людина.</p>
  </div>
</div>

              {recaptchaSiteKey ? (
                <div
                  className={`${styles.captchaWidget} ${
                    showError("captchaToken") ? styles.captchaWidgetError : ""
                  }`}
                >
                  <ReCaptcha
                    siteKey={recaptchaSiteKey}
                    value={form.captchaToken}
                    onChange={(token) => {
                      update("captchaToken", token);
                      setTouched((current) => ({
                        ...current,
                        captchaToken: true,
                      }));
                    }}
                   onExpired={() => resetCaptcha(true)}
onError={() => {
  resetCaptcha(true);
  setServerError("Не вдалося завантажити reCAPTCHA. Оновіть сторінку.");
}}
                  />
                </div>
              ) : (
                <div className={styles.captchaConfigError}>
                  <span className="material-symbols-rounded">warning</span>
                  Не задано NEXT_PUBLIC_RECAPTCHA_SITE_KEY.
                </div>
              )}

              {showError("captchaToken") && (
                <small className={styles.errorText}>{errors.captchaToken}</small>
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