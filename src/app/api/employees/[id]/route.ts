import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

type EmployeeUpdateBody = {
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

function normalizeLogin(value: string) {
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

function parseEmployeeId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function isValidFullName(value: string) {
  const name = normalizeSpaces(value);

  if (name.length < 5 || name.length > 100) {
    return false;
  }

  const parts = name.split(" ").filter(Boolean);

  if (parts.length < 2) {
    return false;
  }

  if (parts.some((part) => part.length < 2)) {
    return false;
  }

  return /^[A-Za-zА-Яа-яІіЇїЄєҐґ'ʼ`\-. ]+$/.test(name);
}

function isValidLogin(value: string) {
  if (!/^[a-z0-9._-]{3,50}$/.test(value)) {
    return false;
  }

  if (/^[._-]|[._-]$/.test(value)) {
    return false;
  }

  if (/[._-]{2,}/.test(value)) {
    return false;
  }

  return true;
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const employeeId = parseEmployeeId(id);

    if (!employeeId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID співробітника." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: {
        employee_id: employeeId,
      },
      include: {
        position: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { ok: false, message: "Співробітника не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: normalizeEmployee(employee),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити дані співробітника.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const employeeId = parseEmployeeId(id);

    if (!employeeId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID співробітника." },
        { status: 400 }
      );
    }

    const existingEmployee = await prisma.employee.findUnique({
      where: {
        employee_id: employeeId,
      },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { ok: false, message: "Співробітника не знайдено." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as EmployeeUpdateBody;

    const full_name = normalizeSpaces(String(body.full_name ?? ""));
    const position_id = Number(body.position_id);
    const login = normalizeLogin(String(body.login ?? ""));
    const rawPassword = String(body.password ?? "").trim();
    const contacts = normalizePhone(String(body.contacts ?? ""));
    const birth_date = String(body.birth_date ?? "").trim();
    const status = String(body.status ?? "").trim();

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
            "Логін має містити 3–50 символів: латинські літери, цифри, крапка, дефіс або нижнє підкреслення. Він не може починатися/закінчуватися службовим символом.",
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

    const employeeWithSameLogin = await prisma.employee.findUnique({
      where: {
        login,
      },
    });

    if (
      employeeWithSameLogin &&
      employeeWithSameLogin.employee_id !== employeeId
    ) {
      return NextResponse.json(
        { ok: false, message: "Інший співробітник вже використовує цей логін." },
        { status: 409 }
      );
    }

    const employeeWithSamePhone = await prisma.employee.findUnique({
      where: {
        contacts,
      },
    });

    if (
      employeeWithSamePhone &&
      employeeWithSamePhone.employee_id !== employeeId
    ) {
      return NextResponse.json(
        {
          ok: false,
          message: "Інший співробітник вже використовує цей номер телефону.",
        },
        { status: 409 }
      );
    }

    const employee = await prisma.employee.update({
      where: {
        employee_id: employeeId,
      },
      data: {
        full_name,
        position_id,
        login,
        contacts,
        birth_date: new Date(`${birth_date}T00:00:00.000Z`),
        status,
        ...(rawPassword ? { password: rawPassword } : {}),
      },
      include: {
        position: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Дані співробітника успішно оновлено.",
      data: normalizeEmployee(employee),
    });
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

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Співробітника не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час оновлення співробітника. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const employeeId = parseEmployeeId(id);

    if (!employeeId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID співробітника." },
        { status: 400 }
      );
    }

    const existingEmployee = await prisma.employee.findUnique({
      where: {
        employee_id: employeeId,
      },
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { ok: false, message: "Співробітника не знайдено." },
        { status: 404 }
      );
    }

    if (existingEmployee.status === "звільнений") {
      const employee = await prisma.employee.findUnique({
        where: {
          employee_id: employeeId,
        },
        include: {
          position: true,
        },
      });

      return NextResponse.json({
        ok: true,
        message: "Співробітник вже має статус «звільнений».",
        data: employee ? normalizeEmployee(employee) : null,
      });
    }

    const employee = await prisma.employee.update({
      where: {
        employee_id: employeeId,
      },
      data: {
        status: "звільнений",
      },
      include: {
        position: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        "Співробітника не видалено фізично, а переведено у статус «звільнений». Це зберігає історію задач і призначень.",
      data: normalizeEmployee(employee),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Співробітника не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час зміни статусу співробітника.",
      },
      { status: 500 }
    );
  }
}