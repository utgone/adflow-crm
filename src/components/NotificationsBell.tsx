"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./NotificationsBell.module.css";

type NotificationTone = "orange" | "green" | "blue" | "red" | "violet";

type NotificationItem = {
  id: number;
  type: string;
  title: string;
  message: string;
  actorName?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  entityUrl?: string | null;
  isRead: boolean;
  createdAt: string;
};

type NotificationsResponse = {
  ok: boolean;
  message?: string;
  data?: {
    unreadCount: number;
    items: NotificationItem[];
  };
};

const typeMeta: Record<
  string,
  {
    icon: string;
    tone: NotificationTone;
  }
> = {
  client_registered: {
    icon: "person_add",
    tone: "orange",
  },
  new_client: {
    icon: "person_add",
    tone: "orange",
  },
  brief_created: {
    icon: "description",
    tone: "blue",
  },
  payment_received: {
    icon: "payments",
    tone: "green",
  },
  invoice_created: {
    icon: "receipt_long",
    tone: "violet",
  },
  project_updated: {
    icon: "sync_alt",
    tone: "blue",
  },
  task_assigned: {
    icon: "assignment_ind",
    tone: "orange",
  },
  material_approved: {
    icon: "check_circle",
    tone: "green",
  },
  material_rejected: {
    icon: "cancel",
    tone: "red",
  },
};

function getMeta(type: string) {
  return (
    typeMeta[type] || {
      icon: "notifications",
      tone: "orange" as const,
    }
  );
}

function getToneClass(tone: NotificationTone) {
  const toneClasses: Record<NotificationTone, string> = {
    orange: styles.tone_orange,
    green: styles.tone_green,
    blue: styles.tone_blue,
    red: styles.tone_red,
    violet: styles.tone_violet,
  };

  return toneClasses[tone];
}

function formatTime(value: string) {
  const date = new Date(value);
  const now = new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return "щойно";
  if (diffMinutes < 60) return `${diffMinutes} хв тому`;
  if (diffHours < 24) return `${diffHours} год тому`;
  if (diffDays === 1) return "вчора";
  if (diffDays < 7) return `${diffDays} дн тому`;

  return date.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "short",
  });
}

export default function NotificationsBell() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(() => {
    async function run() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/notifications?limit=12", {
          method: "GET",
          cache: "no-store",
          credentials: "include",
        });

        const result = (await response.json()) as NotificationsResponse;

        if (!response.ok || !result.ok || !result.data) {
          throw new Error(
            result.message || "Не вдалося завантажити повідомлення."
          );
        }

        setItems(result.data.items);
        setUnreadCount(result.data.unreadCount);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Не вдалося завантажити повідомлення."
        );
      } finally {
        setLoading(false);
      }
    }

    run();
  }, []);

  const markAllAsRead = useCallback(() => {
    async function run() {
      try {
        setMarking(true);
        setError("");

        const response = await fetch("/api/notifications", {
          method: "PATCH",
          credentials: "include",
        });

        const result = (await response.json()) as {
          ok?: boolean;
          message?: string;
        };

        if (!response.ok || result.ok === false) {
          throw new Error(result.message || "Не вдалося оновити повідомлення.");
        }

        setItems((current) =>
          current.map((item) => ({
            ...item,
            isRead: true,
          }))
        );

        setUnreadCount(0);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Не вдалося оновити повідомлення."
        );
      } finally {
        setMarking(false);
      }
    }

    run();
  }, []);

  useEffect(() => {
    loadNotifications();

    const intervalId = window.setInterval(() => {
      loadNotifications();
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadNotifications]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!rootRef.current) return;

      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  const handleToggle = () => {
    const nextOpen = !open;

    setOpen(nextOpen);

    if (nextOpen) {
      loadNotifications();
    }
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={`${styles.bellButton} ${open ? styles.bellButtonActive : ""}`}
        onClick={handleToggle}
        aria-label="Відкрити повідомлення"
      >
        <span className="material-symbols-rounded">notifications</span>

        {unreadCount > 0 && (
          <span className={styles.badge}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <div>
              <strong>Повідомлення</strong>
              <span>
                {unreadCount > 0
                  ? `${unreadCount} нових`
                  : "Нових повідомлень немає"}
              </span>
            </div>

            <button
              type="button"
              className={styles.refreshButton}
              onClick={loadNotifications}
              disabled={loading}
              aria-label="Оновити повідомлення"
            >
              <span className="material-symbols-rounded">refresh</span>
            </button>
          </div>

          {error && (
            <div className={styles.errorBox}>
              <span className="material-symbols-rounded">error</span>
              <p>{error}</p>
            </div>
          )}

          <div className={styles.list}>
            {loading && items.length === 0 ? (
              <>
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
                <div className={styles.skeleton} />
              </>
            ) : items.length > 0 ? (
              items.map((item) => {
                const meta = getMeta(item.type);

                const content = (
                  <>
                    <span
                      className={`${styles.itemIcon} ${getToneClass(meta.tone)}`}
                    >
                      <span className="material-symbols-rounded">
                        {meta.icon}
                      </span>
                    </span>

                    <span className={styles.itemBody}>
                      <span className={styles.itemTop}>
                        <strong>{item.title}</strong>
                        <time>{formatTime(item.createdAt)}</time>
                      </span>

                      <span className={styles.itemMessage}>{item.message}</span>
                    </span>

                    {!item.isRead && <span className={styles.unreadDot} />}
                  </>
                );

                if (item.entityUrl) {
                  return (
                    <Link
                      href={item.entityUrl}
                      className={`${styles.item} ${
                        !item.isRead ? styles.itemUnread : ""
                      }`}
                      key={item.id}
                      onClick={() => setOpen(false)}
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    className={`${styles.item} ${
                      !item.isRead ? styles.itemUnread : ""
                    }`}
                    key={item.id}
                  >
                    {content}
                  </div>
                );
              })
            ) : (
              <div className={styles.empty}>
                <span className="material-symbols-rounded">
                  notifications_off
                </span>
                <strong>Поки тихо</strong>
                <p>
                  Тут з’являтимуться важливі події: нові брифи, оплати, рахунки
                  та зміни статусів.
                </p>
              </div>
            )}
          </div>

          <div className={styles.panelFoot}>
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={marking || unreadCount === 0}
            >
              <span className="material-symbols-rounded">done_all</span>
              Позначити прочитаними
            </button>
          </div>
        </div>
      )}
    </div>
  );
}