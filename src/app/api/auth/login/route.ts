import { NextResponse } from "next/server";
import { createHmac, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type LoginBody = {
  identifier?: unknown;
  password?: unknown;
  remember?: unknown;
};

type AuthRole = "director" | "manager" | "content" | "ads" | "accountant" | "client";
type AuthSource = "client" | "employee";

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

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

const MAX_IDENTIFIER_LENGTH = 254;
const MIN_IDENTIFIER_LENGTH = 3;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_BLOCK_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 7;

const FAILED_LOGIN_MESSAGE = "Невірний email/логін або пароль.";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const loginRegex = /^[a-zA-Z0-9._-]{3,50}$/;
const phoneRegex = /^\+[0-9]{10,15}$/;

const attempts = new Map<
  string,
  {
    count: number;
    firstAttemptAt: number;
    blockedUntil: number;
  }
>();

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeIdentifier(value: unknown) {
  return normalizeString(value).toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function isEmail(value: string) {
  return emailRegex.test(value);
}

function isPhone(value: string) {
  return phoneRegex.test(normalizePhone(value));
}

function isLogin(value: string) {
  return loginRegex.test(value);
}

function isBcryptHash(value: string) {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return realIp || "unknown";
}

function getRateLimitKey(request: Request, identifier: string) {
  return `${getClientIp(request)}:${identifier}`;
}

function cleanupAttempts() {
  const now = Date.now();

  for (const [key, value] of attempts.entries()) {
    const windowExpired = now - value.firstAttemptAt > RATE_LIMIT_WINDOW_MS;
    const blockExpired = value.blockedUntil > 0 && now > value.blockedUntil;

    if (windowExpired && blockExpired) {
      attempts.delete(key);
    }
  }
}

function checkRateLimit(key: string) {
  cleanupAttempts();

  const record = attempts.get(key);
  const now = Date.now();

  if (!record) {
    return "";
  }

  if (record.blockedUntil > now) {
    const minutes = Math.ceil((record.blockedUntil - now) / 60_000);

    return `Забагато спроб входу. Спробуйте ще раз приблизно через ${minutes} хв.`;
  }

  return "";
}

function registerFailedAttempt(key: string) {
  const now = Date.now();
  const current = attempts.get(key);

  if (!current || now - current.firstAttemptAt > RATE_LIMIT_WINDOW_MS) {
    attempts.set(key, {
      count: 1,
      firstAttemptAt: now,
      blockedUntil: 0,
    });

    return;
  }

  const nextCount = current.count + 1;

  attempts.set(key, {
    count: nextCount,
    firstAttemptAt: current.firstAttemptAt,
    blockedUntil:
      nextCount >= RATE_LIMIT_MAX_ATTEMPTS ? now + RATE_LIMIT_BLOCK_MS : 0,
  });
}

function clearFailedAttempts(key: string) {
  attempts.delete(key);
}

function validateLoginInput(identifier: string, password: string) {
  if (!identifier) {
    return "Введіть email, логін або телефон.";
  }

  if (
    identifier.length < MIN_IDENTIFIER_LENGTH ||
    identifier.length > MAX_IDENTIFIER_LENGTH
  ) {
    return "Ідентифікатор має некоректну довжину.";
  }

  const identifierLooksValid =
    isEmail(identifier) || isLogin(identifier) || isPhone(identifier);

  if (!identifierLooksValid) {
    return "Введіть коректний email, логін або телефон.";
  }

  if (!password) {
    return "Введіть пароль.";
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль має містити мінімум ${MIN_PASSWORD_LENGTH} символів.`;
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Пароль занадто довгий. Максимум ${MAX_PASSWORD_LENGTH} символи.`;
  }

  return "";
}

async function verifyPassword(inputPassword: string, storedPassword: string) {
  if (!storedPassword) {
    return false;
  }

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(inputPassword, storedPassword);
  }

  return inputPassword === storedPassword;
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

function mapEmployeeRole(positionName: string): AuthRole {
  const position = positionName.toLowerCase();

  if (position.includes("директор")) {
    return "director";
  }

  if (position.includes("бухгалтер")) {
    return "accountant";
  }

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

function getCookieMaxAge(remember: boolean) {
  return remember ? 60 * 60 * 24 * 30 : 60 * 60 * 8;
}

function base64url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createSessionToken(payload: SessionPayload) {
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function createSessionPayload(params: {
  userId: number;
  source: AuthSource;
  role: AuthRole;
  name: string;
  email: string;
  login: string;
  remember: boolean;
}): SessionPayload {
  const issuedAt = Date.now();
  const maxAge = getCookieMaxAge(params.remember);

  return {
    sessionId: randomUUID(),
    userId: params.userId,
    source: params.source,
    role: params.role,
    name: params.name,
    email: params.email,
    login: params.login,
    issuedAt,
    expiresAt: issuedAt + maxAge * 1000,
  };
}

function createLoginResponse(payload: SessionPayload, remember: boolean) {
  const response = NextResponse.json({
    ok: true,
    message: "Вхід виконано успішно.",
    data: {
      id: payload.userId,
      source: payload.source,
      role: payload.role,
      name: payload.name,
      email: payload.email,
      login: payload.login,
    },
  });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: createSessionToken(payload),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: getCookieMaxAge(remember),
  });

  return response;
}

async function parseRequestBody(request: Request) {
  try {
    return (await request.json()) as LoginBody;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await parseRequestBody(request);

  if (!body) {
    return NextResponse.json(
      {
        ok: false,
        message: "Некоректний JSON у запиті.",
      },
      { status: 400 }
    );
  }

  const identifier = normalizeIdentifier(body.identifier);
  const password = String(body.password ?? "");
  const remember = Boolean(body.remember);

  const validationError = validateLoginInput(identifier, password);

  if (validationError) {
    return NextResponse.json(
      {
        ok: false,
        message: validationError,
      },
      { status: 400 }
    );
  }

  const rateLimitKey = getRateLimitKey(request, identifier);
  const rateLimitError = checkRateLimit(rateLimitKey);

  if (rateLimitError) {
    return NextResponse.json(
      {
        ok: false,
        message: rateLimitError,
      },
      { status: 429 }
    );
  }

  try {
    const normalizedPhone = normalizePhone(identifier);

    const client = await prisma.client.findFirst({
      where: {
        OR: [
          {
            email: {
              equals: identifier,
              mode: "insensitive",
            },
          },
          {
            phone: normalizedPhone,
          },
        ],
      },
    });

    if (client) {
      const passwordOk = await verifyPassword(password, client.password);

      if (!passwordOk) {
        registerFailedAttempt(rateLimitKey);

        return NextResponse.json(
          {
            ok: false,
            message: FAILED_LOGIN_MESSAGE,
          },
          { status: 401 }
        );
      }

      if (client.status !== "активний") {
        registerFailedAttempt(rateLimitKey);

        return NextResponse.json(
          {
            ok: false,
            message: "Акаунт клієнта неактивний. Зверніться до менеджера.",
          },
          { status: 403 }
        );
      }

      if (!isBcryptHash(client.password)) {
        await prisma.client.update({
          where: {
            client_id: client.client_id,
          },
          data: {
            password: await hashPassword(password),
          },
        });
      }

      clearFailedAttempts(rateLimitKey);

      const payload = createSessionPayload({
        userId: client.client_id,
        source: "client",
        role: "client",
        name: client.full_name,
        email: client.email,
        login: client.email,
        remember,
      });

      return createLoginResponse(payload, remember);
    }

    const employee = await prisma.employee.findFirst({
      where: {
        OR: [
          {
            login: {
              equals: identifier,
              mode: "insensitive",
            },
          },
          {
            contacts: normalizedPhone,
          },
        ],
      },
      include: {
        position: true,
      },
    });

    if (!employee) {
      registerFailedAttempt(rateLimitKey);

      return NextResponse.json(
        {
          ok: false,
          message: FAILED_LOGIN_MESSAGE,
        },
        { status: 401 }
      );
    }

    const passwordOk = await verifyPassword(password, employee.password);

    if (!passwordOk) {
      registerFailedAttempt(rateLimitKey);

      return NextResponse.json(
        {
          ok: false,
          message: FAILED_LOGIN_MESSAGE,
        },
        { status: 401 }
      );
    }

    if (employee.status !== "працює") {
      registerFailedAttempt(rateLimitKey);

      return NextResponse.json(
        {
          ok: false,
          message: "Акаунт співробітника неактивний.",
        },
        { status: 403 }
      );
    }

    if (!isBcryptHash(employee.password)) {
      await prisma.employee.update({
        where: {
          employee_id: employee.employee_id,
        },
        data: {
          password: await hashPassword(password),
        },
      });
    }

    clearFailedAttempts(rateLimitKey);

    const role = mapEmployeeRole(employee.position.position_name);

    const payload = createSessionPayload({
      userId: employee.employee_id,
      source: "employee",
      role,
      name: employee.full_name,
      email: "",
      login: employee.login,
      remember,
    });

    return createLoginResponse(payload, remember);
  } catch (error) {
    console.error("AUTH_LOGIN_ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час входу.",
      },
      { status: 500 }
    );
  }
}