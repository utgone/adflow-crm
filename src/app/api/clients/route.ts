import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ClientRecord = {
  client_id: number;
  full_name: string;
  company_name: string | null;
  phone: string;
  email: string;
  password: string;
  status: string;
};

type ClientCreateBody = {
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

export async function GET() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: {
        client_id: "asc",
      },
    });

    return NextResponse.json({
      ok: true,
      data: clients.map(normalizeClient),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити клієнтів з бази даних.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ClientCreateBody;

    const full_name = normalizeSpaces(String(body.full_name ?? ""));
    const company_name = normalizeSpaces(String(body.company_name ?? ""));
    const phone = normalizePhone(String(body.phone ?? ""));
    const email = normalizeEmail(String(body.email ?? ""));
    const password = String(body.password ?? "").trim();
    const status = String(body.status ?? "активний").trim();

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

    if (!isValidPassword(password)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Пароль має містити 6–100 символів, мінімум одну літеру та одну цифру, без пробілів.",
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

    const existingEmail = await prisma.client.findFirst({
      where: {
        email,
      },
    });

    if (existingEmail) {
      return NextResponse.json(
        {
          ok: false,
          message: "Клієнт з таким email вже існує.",
        },
        { status: 409 }
      );
    }

    const existingPhone = await prisma.client.findFirst({
      where: {
        phone,
      },
    });

    if (existingPhone) {
      return NextResponse.json(
        {
          ok: false,
          message: "Клієнт з таким номером телефону вже існує.",
        },
        { status: 409 }
      );
    }

    const client = await prisma.client.create({
      data: {
        full_name,
        company_name,
        phone,
        email,
        password,
        status,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Клієнта успішно додано.",
        data: normalizeClient(client),
      },
      { status: 201 }
    );
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

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час додавання клієнта. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}