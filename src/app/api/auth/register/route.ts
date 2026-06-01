import { NextResponse } from "next/server";
import { createHmac, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RegisterBody = {
  name?: unknown;
  company?: unknown;
  phone?: unknown;
  email?: unknown;
  password?: unknown;
  remember?: unknown;
};

type SessionPayload = {
  sessionId: string;
  userId: number;
  source: "client";
  role: "client";
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
const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 60;
const MAX_COMPANY_LENGTH = 120;

const nameRegex = /^[A-Za-zА-Яа-яЇїІіЄєҐґ'’\-\s]{2,60}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^\+[0-9]{10,15}$/;

function normalizeString(value: unknown) {
  return String(value ?? "").trim();
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
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
  name: string;
  email: string;
  remember: boolean;
}): SessionPayload {
  const issuedAt = Date.now();
  const maxAge = getCookieMaxAge(params.remember);

  return {
    sessionId: randomUUID(),
    userId: params.userId,
    source: "client",
    role: "client",
    name: params.name,
    email: params.email,
    login: params.email,
    issuedAt,
    expiresAt: issuedAt + maxAge * 1000,
  };
}

function createRegisterResponse(payload: SessionPayload, remember: boolean) {
  const response = NextResponse.json(
    {
      ok: true,
      message: "Акаунт створено успішно.",
      data: {
        id: payload.userId,
        source: payload.source,
        role: payload.role,
        name: payload.name,
        email: payload.email,
        login: payload.login,
      },
    },
    { status: 201 }
  );

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
    return (await request.json()) as RegisterBody;
  } catch {
    return null;
  }
}

function validateRegisterInput(input: {
  name: string;
  company: string;
  phone: string;
  email: string;
  password: string;
}) {
  if (!input.name) {
    return "Введіть повне ім'я.";
  }

  if (
    input.name.length < MIN_NAME_LENGTH ||
    input.name.length > MAX_NAME_LENGTH ||
    !nameRegex.test(input.name)
  ) {
    return "Ім'я має містити лише літери (2–60 символів).";
  }

  if (input.company.length > MAX_COMPANY_LENGTH) {
    return "Назва компанії занадто довга.";
  }

  if (!input.phone) {
    return "Введіть номер телефону.";
  }

  if (!phoneRegex.test(input.phone)) {
    return "Введіть телефон у форматі +380XXXXXXXXX.";
  }

  if (!input.email) {
    return "Введіть email.";
  }

  if (!emailRegex.test(input.email)) {
    return "Введіть коректний email.";
  }

  if (!input.password) {
    return "Введіть пароль.";
  }

  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return `Пароль має містити мінімум ${MIN_PASSWORD_LENGTH} символів.`;
  }

  if (input.password.length > MAX_PASSWORD_LENGTH) {
    return `Пароль занадто довгий. Максимум ${MAX_PASSWORD_LENGTH} символи.`;
  }

  return "";
}

export async function POST(request: Request) {
  const body = await parseRequestBody(request);

  if (!body) {
    return NextResponse.json(
      { ok: false, message: "Некоректний JSON у запиті." },
      { status: 400 }
    );
  }

  const name = normalizeString(body.name);
  const company = normalizeString(body.company);
  const email = normalizeString(body.email).toLowerCase();
  const phone = normalizePhone(normalizeString(body.phone));
  const password = String(body.password ?? "");
  const remember = body.remember === undefined ? true : Boolean(body.remember);

  const validationError = validateRegisterInput({
    name,
    company,
    phone,
    email,
    password,
  });

  if (validationError) {
    return NextResponse.json(
      { ok: false, message: validationError },
      { status: 400 }
    );
  }

  try {
    const existingEmail = await prisma.client.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      select: { client_id: true },
    });

    if (existingEmail) {
      return NextResponse.json(
        { ok: false, message: "Клієнт з таким email вже зареєстрований." },
        { status: 409 }
      );
    }

    const existingPhone = await prisma.client.findFirst({
      where: { phone },
      select: { client_id: true },
    });

    if (existingPhone) {
      return NextResponse.json(
        { ok: false, message: "Клієнт з таким номером телефону вже існує." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const created = await prisma.client.create({
      data: {
        full_name: name,
        company_name: company ? company : null,
        phone,
        email,
        password: passwordHash,
        status: "активний",
      },
    });

    const payload = createSessionPayload({
      userId: created.client_id,
      name: created.full_name,
      email: created.email,
      remember,
    });

    return createRegisterResponse(payload, remember);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { ok: false, message: "Клієнт з таким email або телефоном вже існує." },
        { status: 409 }
      );
    }

    console.error("AUTH_REGISTER_ERROR", error);

    return NextResponse.json(
      { ok: false, message: "Помилка сервера під час реєстрації." },
      { status: 500 }
    );
  }
}