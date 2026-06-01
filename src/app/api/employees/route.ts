import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type EmployeeWithPosition = {
  employee_id: number;
  full_name: string;
  position_id: number;
  login: string;
  password: string;
  contacts: string;
  birth_date: Date;
  status: string;
  position: {
    position_id: number;
    position_name: string;
    description: string | null;
  };
};

type EmployeeCreateBody = {
  full_name?: unknown;
  position_id?: unknown;
  login?: unknown;
  password?: unknown;
  contacts?: unknown;
  birth_date?: unknown;
  status?: unknown;
};

const EMPLOYEE_STATUSES = ["працює", "звільнений"] as const;

function normalizeEmployee(employee: EmployeeWithPosition) {
  return {
    employee_id: employee.employee_id,
    full_name: employee.full_name,
    position_id: employee.position_id,
    position_name: employee.position.position_name,
    login: employee.login,
    contacts: employee.contacts,
    birth_date: employee.birth_date,
    status: employee.status,
  };
}

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
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

function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

function isValidFullName(value: string) {
  const name = normalizeSpaces(value);

  if (name.length < 5 || name.length > 100) {
    return false;
  }

  const parts = name.split(" ");

  if (parts.length < 2) {
    return false;
  }

  return /^[A-Za-zА-Яа-яІіЇїЄєҐґ'ʼ`\-. ]+$/.test(name);
}

function isValidLogin(value: string) {
  return /^[a-z0-9._-]{3,50}$/.test(value);
}

function isValidPassword(value: string) {
  if (value.length < 6 || value.length > 100) {
    return false;
  }

  const hasLetter = /[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(value);
  const hasDigit = /\d/.test(value);

  return hasLetter && hasDigit;
}

function isValidPhone(phone: string) {
  return /^\+380\d{9}$/.test(phone);
}

function getBirthDateError(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "Дата народження має бути у форматі РРРР-ММ-ДД.";
  }

  const [year, month, day] = value.split("-").map(Number);
  const birthDate = new Date(Date.UTC(year, month - 1, day));

  const isRealDate =
    birthDate.getUTCFullYear() === year &&
    birthDate.getUTCMonth() === month - 1 &&
    birthDate.getUTCDate() === day;

  if (!isRealDate) {
    return "Вкажіть реальну дату народження.";
  }

  const today = new Date();
  const minAgeDate = new Date(
    Date.UTC(today.getUTCFullYear() - 16, today.getUTCMonth(), today.getUTCDate())
  );

  const maxAgeDate = new Date(
    Date.UTC(today.getUTCFullYear() - 80, today.getUTCMonth(), today.getUTCDate())
  );

  if (birthDate > minAgeDate) {
    return "Співробітнику має бути не менше 16 років.";
  }

  if (birthDate < maxAgeDate) {
    return "Вік співробітника не може перевищувати 80 років.";
  }

  return "";
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
    const employees = await prisma.employee.findMany({
      include: {
        position: true,
      },
      orderBy: {
        employee_id: "asc",
      },
    });

    return NextResponse.json({
      ok: true,
      data: employees.map(normalizeEmployee),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити співробітників з бази даних.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as EmployeeCreateBody;

    const full_name = normalizeSpaces(String(body.full_name ?? ""));
    const position_id = Number(body.position_id);
    const login = normalizeLogin(String(body.login ?? ""));
    const password = String(body.password ?? "").trim();
    const contacts = normalizePhone(String(body.contacts ?? ""));
    const birth_date = String(body.birth_date ?? "").trim();
    const status = String(body.status ?? "працює").trim();

    if (!isValidFullName(full_name)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "ПІБ має складатися мінімум з імені та прізвища, без цифр і службових символів.",
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(position_id) || position_id <= 0) {
      return NextResponse.json(
        { ok: false, message: "Оберіть коректну посаду співробітника." },
        { status: 400 }
      );
    }

    if (!isValidLogin(login)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Логін має містити 3–50 символів: латинські літери, цифри, крапка, дефіс або нижнє підкреслення.",
        },
        { status: 400 }
      );
    }

    if (!isValidPassword(password)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Пароль має містити 6–100 символів, мінімум одну літеру та одну цифру.",
        },
        { status: 400 }
      );
    }

    if (!isValidPhone(contacts)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Телефон має бути українським номером у форматі +380XXXXXXXXX.",
        },
        { status: 400 }
      );
    }

    const birthDateError = getBirthDateError(birth_date);

    if (birthDateError) {
      return NextResponse.json(
        { ok: false, message: birthDateError },
        { status: 400 }
      );
    }

    if (!EMPLOYEE_STATUSES.includes(status as (typeof EMPLOYEE_STATUSES)[number])) {
      return NextResponse.json(
        { ok: false, message: "Статус може бути тільки «працює» або «звільнений»." },
        { status: 400 }
      );
    }

    const position = await prisma.position.findUnique({
      where: {
        position_id,
      },
    });

    if (!position) {
      return NextResponse.json(
        { ok: false, message: "Обрана посада не існує в базі даних." },
        { status: 400 }
      );
    }

    const existingLogin = await prisma.employee.findUnique({
      where: {
        login,
      },
    });

    if (existingLogin) {
      return NextResponse.json(
        { ok: false, message: "Співробітник з таким логіном вже існує." },
        { status: 409 }
      );
    }

    const existingContacts = await prisma.employee.findUnique({
      where: {
        contacts,
      },
    });

    if (existingContacts) {
      return NextResponse.json(
        { ok: false, message: "Співробітник з таким телефоном вже існує." },
        { status: 409 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        full_name,
        position_id,
        login,
        password,
        contacts,
        birth_date: new Date(`${birth_date}T00:00:00.000Z`),
        status,
      },
      include: {
        position: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Співробітника успішно додано.",
        data: normalizeEmployee(employee),
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
          message: "Запис з такими унікальними даними вже існує.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час додавання співробітника. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}