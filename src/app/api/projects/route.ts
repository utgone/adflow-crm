import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ProjectCreateBody = {
  brief_id?: unknown;
  project_name?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  status?: unknown;
};

const PROJECT_STATUSES = [
  "новий",
  "в роботі",
  "матеріали погоджено",
  "завершено",
  "зупинено",
  "скасовано",
] as const;

const FINAL_PROJECT_STATUSES = ["завершено", "зупинено", "скасовано"] as const;

async function findProjects() {
  return prisma.project.findMany({
    include: {
      brief: {
        include: {
          client: {
            select: {
              client_id: true,
              full_name: true,
              company_name: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: {
      project_id: "asc",
    },
  });
}

type ProjectWithBrief = Awaited<ReturnType<typeof findProjects>>[number];

function normalizeProject(project: ProjectWithBrief) {
  return {
    project_id: project.project_id,
    brief_id: project.brief_id,
    project_name: project.project_name,
    start_date: formatDate(project.start_date),
    end_date: project.end_date ? formatDate(project.end_date) : null,
    status: project.status,

    client_id: project.brief.client.client_id,
    client_name: project.brief.client.full_name,
    client_company: project.brief.client.company_name ?? "Без компанії",
    client_status: project.brief.client.status,

    category: project.brief.category,
    brief_status: project.brief.status,
    requirement_desc: project.brief.requirement_desc,
    budget: Number(project.brief.budget),

    is_final: isFinalStatus(project.status),
    can_edit: !isFinalStatus(project.status),
    can_cancel: !isFinalStatus(project.status),
    can_finish: ["в роботі", "матеріали погоджено"].includes(project.status),
  };
}

function optionalString(value: unknown) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getTodayISO() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value: Date) {
  return value.toISOString().split("T")[0];
}

function toDbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function isRealISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidProjectName(value: string) {
  const name = normalizeSpaces(value);

  if (name.length < 3 || name.length > 150) {
    return false;
  }

  return /^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9'ʼ`\-.,&() /№]+$/.test(name);
}

function isFinalStatus(status: string) {
  return FINAL_PROJECT_STATUSES.includes(
    status as (typeof FINAL_PROJECT_STATUSES)[number]
  );
}

function isProjectStatus(status: string) {
  return PROJECT_STATUSES.includes(status as (typeof PROJECT_STATUSES)[number]);
}

function validateProjectDates(params: {
  start_date: string;
  end_date: string | null;
  status: string;
}) {
  if (!isRealISODate(params.start_date)) {
    return "Вкажіть коректну дату початку проєкту.";
  }

  if (params.end_date && !isRealISODate(params.end_date)) {
    return "Вкажіть коректну дату завершення проєкту.";
  }

  if (params.end_date && params.end_date < params.start_date) {
    return "Дата завершення не може бути раніше дати початку.";
  }

  if (isFinalStatus(params.status) && !params.end_date) {
    return "Для статусів «завершено», «зупинено» або «скасовано» потрібно вказати дату завершення.";
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
    const projects = await findProjects();

    return NextResponse.json({
      ok: true,
      data: projects.map(normalizeProject),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити проєкти з бази даних.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProjectCreateBody;

    const brief_id = Number(body.brief_id);
    const project_name = normalizeSpaces(optionalString(body.project_name));
    const start_date = normalizeSpaces(optionalString(body.start_date)) || getTodayISO();
    const endDateInput = normalizeSpaces(optionalString(body.end_date));
    const end_date = endDateInput || null;
    const status = normalizeSpaces(optionalString(body.status)) || "новий";

    if (!Number.isInteger(brief_id) || brief_id <= 0) {
      return NextResponse.json(
        { ok: false, message: "Оберіть коректний бриф для створення проєкту." },
        { status: 400 }
      );
    }

    if (!isValidProjectName(project_name)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Назва проєкту має містити 3–150 символів без службових символів.",
        },
        { status: 400 }
      );
    }

    if (status !== "новий") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Новий проєкт завжди створюється зі статусом «новий». Інші статуси встановлюються під час роботи.",
        },
        { status: 400 }
      );
    }

    const dateError = validateProjectDates({
      start_date,
      end_date,
      status: "новий",
    });

    if (dateError) {
      return NextResponse.json(
        {
          ok: false,
          message: dateError,
        },
        { status: 400 }
      );
    }

    const brief = await prisma.brief.findUnique({
      where: {
        brief_id,
      },
      include: {
        client: true,
      },
    });

    if (!brief) {
      return NextResponse.json(
        { ok: false, message: "Бриф не знайдено в базі даних." },
        { status: 404 }
      );
    }

    if (brief.client.status !== "активний") {
      return NextResponse.json(
        {
          ok: false,
          message: "Не можна створити проєкт для брифу неактивного клієнта.",
        },
        { status: 400 }
      );
    }

    if (brief.status === "відхилено") {
      return NextResponse.json(
        {
          ok: false,
          message: "Не можна створити проєкт на основі відхиленого брифу.",
        },
        { status: 400 }
      );
    }

    const existingProject = await prisma.project.findFirst({
      where: {
        brief_id,
      },
    });

    if (existingProject) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "За цим брифом вже створено проєкт. Один бриф не може породжувати кілька проєктів.",
        },
        { status: 409 }
      );
    }

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          brief_id,
          project_name,
          start_date: toDbDate(start_date),
          end_date: end_date ? toDbDate(end_date) : null,
          status: "новий",
        },
        include: {
          brief: {
            include: {
              client: {
                select: {
                  client_id: true,
                  full_name: true,
                  company_name: true,
                  status: true,
                },
              },
            },
          },
        },
      });

      await tx.brief.update({
        where: {
          brief_id,
        },
        data: {
          status: "прийнято",
        },
      });

      return createdProject;
    });

    return NextResponse.json(
      {
        ok: true,
        message:
          "Проєкт успішно створено. Статус повʼязаного брифу автоматично змінено на «прийнято».",
        data: normalizeProject(project),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2003") {
      return NextResponse.json(
        {
          ok: false,
          message: "Неможливо створити проєкт: повʼязаний бриф не існує.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час створення проєкту. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}