"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      ready?: (callback: () => void) => void;
      render?: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
          theme?: "light" | "dark";
          size?: "normal" | "compact";
        }
      ) => number;
      reset?: (widgetId?: number) => void;
    };
  }
}

type ReCaptchaProps = {
  siteKey: string;
  value: string;
  onChange: (token: string) => void;
  onExpired?: () => void;
  onError?: () => void;
};

export default function ReCaptcha({
  siteKey,
  value,
  onChange,
  onExpired,
  onError,
}: ReCaptchaProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [localError, setLocalError] = useState("");

  const tryRenderCaptcha = useCallback(() => {
    if (!siteKey || !containerRef.current) {
      return false;
    }

    if (widgetIdRef.current !== null) {
      return true;
    }

    const grecaptcha = window.grecaptcha;

    if (!grecaptcha || typeof grecaptcha.render !== "function") {
      return false;
    }

    try {
      widgetIdRef.current = grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
        theme: "light",
        size: "normal",
        callback: (token) => {
          setLocalError("");
          onChange(token);
        },
        "expired-callback": () => {
          onChange("");
          onExpired?.();
        },
        "error-callback": () => {
          onChange("");
          setLocalError("Помилка reCAPTCHA. Оновіть сторінку.");
          onError?.();
        },
      });

      setLocalError("");
      return true;
    } catch {
      setLocalError("Не вдалося відобразити reCAPTCHA. Оновіть сторінку.");
      onChange("");
      onError?.();
      return false;
    }
  }, [siteKey, onChange, onExpired, onError]);

  useEffect(() => {
    if (!scriptReady) return;

    let attempts = 0;

    const intervalId = window.setInterval(() => {
      attempts += 1;

      const grecaptcha = window.grecaptcha;

      if (typeof grecaptcha?.ready === "function") {
        grecaptcha.ready(() => {
          tryRenderCaptcha();
        });
      } else {
        tryRenderCaptcha();
      }

      if (widgetIdRef.current !== null || attempts >= 20) {
        window.clearInterval(intervalId);
      }

      if (attempts >= 20 && widgetIdRef.current === null) {
        setLocalError(
          "reCAPTCHA не завантажилась. Перевірте ключ і домен у Google Console."
        );
        onChange("");
        onError?.();
      }
    }, 250);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [scriptReady, tryRenderCaptcha, onChange, onError]);

  useEffect(() => {
    if (!value && widgetIdRef.current !== null && window.grecaptcha?.reset) {
      try {
        window.grecaptcha.reset(widgetIdRef.current);
      } catch {
        widgetIdRef.current = null;
      }
    }
  }, [value]);

  return (
    <div>
    <Script
  src="https://www.google.com/recaptcha/api.js?render=explicit&hl=uk"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
        onError={() => {
          setLocalError("Не вдалося завантажити скрипт reCAPTCHA.");
          onChange("");
          onError?.();
        }}
      />

      <div ref={containerRef} />

      {localError && (
        <small
          style={{
            display: "block",
            marginTop: "8px",
            color: "#dc2626",
            fontSize: "12px",
            fontWeight: 500,
            lineHeight: 1.35,
          }}
        >
          {localError}
        </small>
      )}
    </div>
  );
}