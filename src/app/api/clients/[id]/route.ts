import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ClientRecord = {
  client_id: number;
  full_name: string;
  company_name: string | null;
  phone: string;
  email: string;
  password: string;
  status: string;
};

type ClientUpdateBody = {
  full_name?: unknown;
  company_name?: unknown;
  phone?: unknown;
  email?: unknown;
  password?: unknown;
  status?: unknown;
};

const CLIENT_STATUSES = ["активний", "неактивний"] as const;

function normalizeClient(client: ClientRecord) {
  return {
    client_id: client.client_id,
    full_name: client.full_name,
    company_name: client.company_name ?? "Без компанії",
    phone: client.phone,
    email: client.email,
    status: client.status,
  };
}

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+380") && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith("380") && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length === 10) {
    return `+380${digits.slice(1)}`;
  }

  return trimmed;
}

function parseClientId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function isValidFullName(value: string) {
  const fullName = normalizeSpaces(value);
  const parts = fullName.split(" ").filter(Boolean);

  if (fullName.length < 5 || fullName.length > 100) {
    return false;
  }

  if (parts.length < 2) {
    return false;
  }

  if (parts.some((part) => part.length < 2)) {
    return false;
  }

  return /^[A-Za-zА-Яа-яІіЇїЄєҐґ'ʼ`\-. ]+$/.test(fullName);
}

function isValidCompanyName(value: string) {
  const company = normalizeSpaces(value);

  if (company.length < 2 || company.length > 120) {
    return false;
  }

  return /^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9'ʼ`\-.,&() ]+$/.test(company);
}

function isValidEmail(value: string) {
  if (value.length < 6 || value.length > 120) {
    return false;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

function isValidPhone(value: string) {
  return /^\+380\d{9}$/.test(value);
}

function isValidPassword(value: string) {
  if (value.length < 6 || value.length > 100) {
    return false;
  }

  if (/\s/.test(value)) {
    return false;
  }

  const hasLetter = /[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(value);
  const hasDigit = /\d/.test(value);

  return hasLetter && hasDigit;
}

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return "";
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const clientId = parseClientId(id);

    if (!clientId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID клієнта." },
        { status: 400 }
      );
    }

    const client = await prisma.client.findUnique({
      where: {
        client_id: clientId,
      },
    });

    if (!client) {
      return NextResponse.json(
        { ok: false, message: "Клієнта не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: normalizeClient(client),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити дані клієнта.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const clientId = parseClientId(id);

    if (!clientId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID клієнта." },
        { status: 400 }
      );
    }

    const existingClient = await prisma.client.findUnique({
      where: {
        client_id: clientId,
      },
    });

    if (!existingClient) {
      return NextResponse.json(
        { ok: false, message: "Клієнта не знайдено." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as ClientUpdateBody;

    const full_name = normalizeSpaces(String(body.full_name ?? ""));
    const company_name = normalizeSpaces(String(body.company_name ?? ""));
    const phone = normalizePhone(String(body.phone ?? ""));
    const email = normalizeEmail(String(body.email ?? ""));
    const rawPassword = String(body.password ?? "").trim();
    const status = String(body.status ?? "").trim();

    if (!isValidFullName(full_name)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "ПІБ клієнта має складатися мінімум з імені та прізвища, без цифр і службових символів.",
        },
        { status: 400 }
      );
    }

    if (!isValidCompanyName(company_name)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Назва компанії має містити 2–120 символів і не повинна містити службові символи.",
        },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Телефон має бути українським номером у форматі +380XXXXXXXXX.",
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Вкажіть коректний email клієнта.",
        },
        { status: 400 }
      );
    }

    if (rawPassword && !isValidPassword(rawPassword)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Новий пароль має містити 6–100 символів, мінімум одну літеру та одну цифру, без пробілів.",
        },
        { status: 400 }
      );
    }

    if (!CLIENT_STATUSES.includes(status as (typeof CLIENT_STATUSES)[number])) {
      return NextResponse.json(
        {
          ok: false,
          message: "Статус клієнта може бути тільки «активний» або «неактивний».",
        },
        { status: 400 }
      );
    }

    const clientWithSameEmail = await prisma.client.findFirst({
      where: {
        email,
      },
    });

    if (clientWithSameEmail && clientWithSameEmail.client_id !== clientId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Інший клієнт вже використовує цей email.",
        },
        { status: 409 }
      );
    }

    const clientWithSamePhone = await prisma.client.findFirst({
      where: {
        phone,
      },
    });

    if (clientWithSamePhone && clientWithSamePhone.client_id !== clientId) {
      return NextResponse.json(
        {
          ok: false,
          message: "Інший клієнт вже використовує цей номер телефону.",
        },
        { status: 409 }
      );
    }

    const client = await prisma.client.update({
      where: {
        client_id: clientId,
      },
      data: {
        full_name,
        company_name,
        phone,
        email,
        status,
        ...(rawPassword ? { password: rawPassword } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Дані клієнта успішно оновлено.",
      data: normalizeClient(client),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2002") {
      return NextResponse.json(
        {
          ok: false,
          message: "Клієнт з такими унікальними даними вже існує.",
        },
        { status: 409 }
      );
    }

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Клієнта не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час оновлення клієнта. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const clientId = parseClientId(id);

    if (!clientId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID клієнта." },
        { status: 400 }
      );
    }

    const existingClient = await prisma.client.findUnique({
      where: {
        client_id: clientId,
      },
    });

    if (!existingClient) {
      return NextResponse.json(
        { ok: false, message: "Клієнта не знайдено." },
        { status: 404 }
      );
    }

    if (existingClient.status === "неактивний") {
      return NextResponse.json({
        ok: true,
        message: "Клієнт вже має статус «неактивний».",
        data: normalizeClient(existingClient),
      });
    }

    const client = await prisma.client.update({
      where: {
        client_id: clientId,
      },
      data: {
        status: "неактивний",
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        "Клієнта не видалено фізично, а переведено у статус «неактивний». Це зберігає історію брифів, проєктів, рахунків і оплат.",
      data: normalizeClient(client),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Клієнта не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час зміни статусу клієнта.",
      },
      { status: 500 }
    );
  }
}