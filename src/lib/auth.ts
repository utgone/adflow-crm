import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export type AuthRole =
  | "director"
  | "manager"
  | "content"
  | "ads"
  | "accountant"
  | "client";

export type AuthSource = "client" | "employee";

export type CurrentUser = {
  id: number;
  source: AuthSource;
  role: AuthRole;
  name: string;
  email: string;
  login: string;
  status: string;
  company_name?: string;
  phone?: string;
  position_id?: number;
  position_name?: string;
};

type SessionPayload = {
  sessionId: string;
  userId: number;
  source: AuthSource;
  role: AuthRole;
  name: string;
  email: string;
  login: string;
  issuedAt: number;
  expiresAt: number;
};

const SESSION_COOKIE_NAME = "adflow_session";

const SESSION_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "adflow-dev-secret-change-before-production";

const validRoles: AuthRole[] = [
  "director",
  "manager",
  "content",
  "ads",
  "accountant",
  "client",
];

const validSources: AuthSource[] = ["client", "employee"];

function sign(value: string) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function safeEqual(leftValue: string, rightValue: string) {
  try {
    const left = Buffer.from(leftValue);
    const right = Buffer.from(rightValue);

    if (left.length !== right.length) {
      return false;
    }

    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function isValidAuthRole(value: unknown): value is AuthRole {
  return typeof value === "string" && validRoles.includes(value as AuthRole);
}

function isValidAuthSource(value: unknown): value is AuthSource {
  return typeof value === "string" && validSources.includes(value as AuthSource);
}

function isValidUserId(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value > 0
  );
}

function parseSessionToken(token: string): SessionPayload | null {
  const [encodedPayload, signature, extraPart] = token.split(".");

  if (!encodedPayload || !signature || extraPart) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const json = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload = JSON.parse(json) as Partial<SessionPayload>;

    if (
      typeof payload.sessionId !== "string" ||
      !isValidUserId(payload.userId) ||
      !isValidAuthSource(payload.source) ||
      !isValidAuthRole(payload.role) ||
      typeof payload.name !== "string" ||
      typeof payload.login !== "string" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }

    if (!Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt)) {
      return null;
    }

    if (payload.expiresAt <= Date.now()) {
      return null;
    }

    return {
      sessionId: payload.sessionId,
      userId: payload.userId,
      source: payload.source,
      role: payload.role,
      name: payload.name,
      email: typeof payload.email === "string" ? payload.email : "",
      login: payload.login,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

function mapEmployeeRole(positionName: string): AuthRole {
  const position = positionName.toLowerCase();

  if (position.includes("директор")) return "director";
  if (position.includes("бухгалтер")) return "accountant";

  if (
    position.includes("контент") ||
    position.includes("копірайтер") ||
    position.includes("дизайн") ||
    position.includes("designer")
  ) {
    return "content";
  }

  if (
    position.includes("реклам") ||
    position.includes("таргет") ||
    position.includes("smm") ||
    position.includes("ads")
  ) {
    return "ads";
  }

  return "manager";
}

async function getSessionFromCookie() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    return parseSessionToken(token);
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSessionFromCookie();

  if (!session) {
    return null;
  }

  if (!isValidUserId(session.userId)) {
    return null;
  }

  try {
    if (session.source === "client") {
      const client = await prisma.client.findUnique({
        where: {
          client_id: session.userId,
        },
        select: {
          client_id: true,
          full_name: true,
          company_name: true,
          email: true,
          phone: true,
          status: true,
        },
      });

      if (!client || client.status !== "активний") {
        return null;
      }

      return {
        id: client.client_id,
        source: "client",
        role: "client",
        name: client.full_name,
        email: client.email,
        login: client.email,
        status: client.status,
        company_name: client.company_name ?? "Без компанії",
        phone: client.phone,
      };
    }

    if (session.source === "employee") {
      const employee = await prisma.employee.findUnique({
        where: {
          employee_id: session.userId,
        },
        include: {
          position: true,
        },
      });

      if (!employee || employee.status !== "працює") {
        return null;
      }

      const positionName = employee.position?.position_name ?? "";

      if (!positionName) {
        return null;
      }

      const role = mapEmployeeRole(positionName);

      return {
        id: employee.employee_id,
        source: "employee",
        role,
        name: employee.full_name,
        email: "",
        login: employee.login,
        status: employee.status,
        phone: employee.contacts,
        position_id: employee.position_id,
        position_name: positionName,
      };
    }

    return null;
  } catch (error) {
    console.error("GET_CURRENT_USER_ERROR", error);
    return null;
  }
}

export function getRoleLabel(role: AuthRole) {
  const labels: Record<AuthRole, string> = {
    director: "Директор",
    manager: "Акаунт-менеджер",
    content: "Спеціаліст з контенту",
    ads: "Фахівець з реклами",
    accountant: "Бухгалтер",
    client: "Клієнт",
  };

  return labels[role];
}

export function getUserInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}