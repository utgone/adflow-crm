"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./page.module.css";

type AuthRole =
  | "director"
  | "manager"
  | "content"
  | "ads"
  | "accountant"
  | "client";

type LandingUserActionsProps = {
  user: {
    name: string;
    role: AuthRole;
  };
};

const roleLabels: Record<AuthRole, string> = {
  director: "Директор",
  manager: "Менеджер",
  content: "Контент",
  ads: "Реклама",
  accountant: "Бухгалтер",
  client: "Клієнт",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getFirstName(name: string) {
  return name.split(" ").filter(Boolean)[0] || "користувач";
}

export default function LandingUserActions({ user }: LandingUserActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    try {
      setLoading(true);

      await fetch("/api/auth/logout", {
        method: "POST",
      });

      router.replace("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.userActions}>
      <div className={styles.userMiniCard}>
        <span className={styles.userAvatar}>{getInitials(user.name)}</span>

        <div className={styles.userText}>
          <strong>Привіт, {getFirstName(user.name)}</strong>
          <span>{roleLabels[user.role]}</span>
        </div>
      </div>

      <Link href="/dashboard" className={styles.cabinetButton} data-magnetic>
        <span>Кабінет</span>
        <span className="material-symbols-rounded">arrow_forward</span>
      </Link>

      <button
        type="button"
        className={styles.logoutButton}
        onClick={handleLogout}
        disabled={loading}
        aria-label="Вийти з акаунта"
      >
        <span className="material-symbols-rounded">
          {loading ? "progress_activity" : "logout"}
        </span>
      </button>
    </div>
  );
}