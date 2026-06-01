"use client";

import { useSyncExternalStore } from "react";
import styles from "./page.module.css";

const COOKIE_NOTICE_KEY = "adflow_cookie_notice_accepted";
const COOKIE_NOTICE_EVENT = "adflow-cookie-notice-change";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readCookieNoticeSnapshot() {
  try {
    if (!canUseStorage()) {
      return "accepted";
    }

    return window.localStorage.getItem(COOKIE_NOTICE_KEY) === "true"
      ? "accepted"
      : "pending";
  } catch {
    return "accepted";
  }
}

function readServerSnapshot() {
  return "accepted";
}

function subscribeCookieNotice(callback: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === COOKIE_NOTICE_KEY) {
      callback();
    }
  };

  const handleCustomEvent = () => {
    callback();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(COOKIE_NOTICE_EVENT, handleCustomEvent);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(COOKIE_NOTICE_EVENT, handleCustomEvent);
  };
}

function saveCookieNoticeAccepted() {
  try {
    if (!canUseStorage()) {
      return;
    }

    window.localStorage.setItem(COOKIE_NOTICE_KEY, "true");
    window.dispatchEvent(new Event(COOKIE_NOTICE_EVENT));
  } catch {
    // Якщо браузер блокує localStorage — не ламаємо інтерфейс.
  }
}

export default function CookieBanner() {
  const noticeState = useSyncExternalStore(
    subscribeCookieNotice,
    readCookieNoticeSnapshot,
    readServerSnapshot
  );

  const isVisible = noticeState === "pending";

  if (!isVisible) {
    return null;
  }

  return (
    <section className={styles.cookieBanner} aria-label="Повідомлення про cookie">
      <div className={styles.cookieIcon} aria-hidden="true">
        <span className="material-symbols-rounded">cookie</span>
      </div>

      <div className={styles.cookieText}>
        <strong>Технічні cookie</strong>

        <p>
          AdFlow CRM використовує cookie тільки для авторизації та безпечної
          роботи кабінету. Рекламні трекери в цьому проєкті не використовуються.
        </p>
      </div>

      <button
        type="button"
        className={styles.cookieButton}
        onClick={saveCookieNoticeAccepted}
      >
        Зрозуміло
      </button>
    </section>
  );
}