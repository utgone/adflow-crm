import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ProjectUpdateBody = {
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

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  новий: ["в роботі", "скасовано"],
  "в роботі": ["матеріали погоджено", "зупинено", "скасовано"],
  "матеріали погоджено": ["в роботі", "завершено", "зупинено", "скасовано"],
  завершено: [],
  зупинено: [],
  скасовано: [],
};

async function findProjectById(projectId: number) {
  return prisma.project.findUnique({
    where: {
      project_id: projectId,
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
}

type ProjectWithBrief = NonNullable<Awaited<ReturnType<typeof findProjectById>>>;

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

function parseProjectId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
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

function isAllowedTransition(from: string, to: string) {
  if (from === to) {
    return true;
  }

  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const projectId = parseProjectId(id);

    if (!projectId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID проєкту." },
        { status: 400 }
      );
    }

    const project = await findProjectById(projectId);

    if (!project) {
      return NextResponse.json(
        { ok: false, message: "Проєкт не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: normalizeProject(project),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити дані проєкту.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const projectId = parseProjectId(id);

    if (!projectId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID проєкту." },
        { status: 400 }
      );
    }

    const existingProject = await findProjectById(projectId);

    if (!existingProject) {
      return NextResponse.json(
        { ok: false, message: "Проєкт не знайдено." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as ProjectUpdateBody;

    if (
      body.brief_id !== undefined &&
      Number(body.brief_id) !== existingProject.brief_id
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна змінити brief_id існуючого проєкту. Звʼязок brief → project має залишатися незмінним.",
        },
        { status: 400 }
      );
    }

    const project_name =
      body.project_name === undefined
        ? existingProject.project_name
        : normalizeSpaces(optionalString(body.project_name));

    const start_date =
      body.start_date === undefined
        ? formatDate(existingProject.start_date)
        : normalizeSpaces(optionalString(body.start_date));

    const end_date =
      body.end_date === undefined
        ? existingProject.end_date
          ? formatDate(existingProject.end_date)
          : null
        : normalizeSpaces(optionalString(body.end_date)) || null;

    const status =
      body.status === undefined
        ? existingProject.status
        : normalizeSpaces(optionalString(body.status));

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

    if (!isProjectStatus(status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Статус проєкту може бути тільки: новий, в роботі, матеріали погоджено, завершено, зупинено або скасовано.",
        },
        { status: 400 }
      );
    }

    if (!isAllowedTransition(existingProject.status, status)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Некоректний перехід статусу: «${existingProject.status}» → «${status}».`,
        },
        { status: 400 }
      );
    }

    const dateError = validateProjectDates({
      start_date,
      end_date,
      status,
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

    const finalProjectLocked =
      isFinalStatus(existingProject.status) &&
      (existingProject.project_name !== project_name ||
        formatDate(existingProject.start_date) !== start_date ||
        (existingProject.end_date ? formatDate(existingProject.end_date) : null) !==
          end_date ||
        existingProject.status !== status);

    if (finalProjectLocked) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Фінальний проєкт заблоковано від редагування, щоб не порушити історію CRM.",
        },
        { status: 400 }
      );
    }

    const project = await prisma.project.update({
      where: {
        project_id: projectId,
      },
      data: {
        project_name,
        start_date: toDbDate(start_date),
        end_date: end_date ? toDbDate(end_date) : null,
        status,
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

    return NextResponse.json({
      ok: true,
      message: "Дані проєкту успішно оновлено.",
      data: normalizeProject(project),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Проєкт не знайдено." },
        { status: 404 }
      );
    }

    if (code === "P2003") {
      return NextResponse.json(
        {
          ok: false,
          message: "Неможливо оновити проєкт: повʼязаний бриф не існує.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час оновлення проєкту. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const projectId = parseProjectId(id);

    if (!projectId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID проєкту." },
        { status: 400 }
      );
    }

    const existingProject = await findProjectById(projectId);

    if (!existingProject) {
      return NextResponse.json(
        { ok: false, message: "Проєкт не знайдено." },
        { status: 404 }
      );
    }

    if (existingProject.status === "скасовано") {
      return NextResponse.json({
        ok: true,
        message: "Проєкт вже має статус «скасовано».",
        data: normalizeProject(existingProject),
      });
    }

    if (existingProject.status === "завершено") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Завершений проєкт не можна скасувати. Він залишається в історії CRM.",
        },
        { status: 400 }
      );
    }

    if (existingProject.status === "зупинено") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Зупинений проєкт вже є фінальним станом. Для нього не виконується додаткове скасування.",
        },
        { status: 400 }
      );
    }

    const startISO = formatDate(existingProject.start_date);
    const todayISO = getTodayISO();
    const cancelDate = todayISO < startISO ? startISO : todayISO;

    const project = await prisma.project.update({
      where: {
        project_id: projectId,
      },
      data: {
        status: "скасовано",
        end_date: toDbDate(cancelDate),
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

    return NextResponse.json({
      ok: true,
      message:
        "Проєкт не видалено фізично, а переведено у статус «скасовано». Це зберігає історію задач, рахунків, оплат і кампаній.",
      data: normalizeProject(project),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Проєкт не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час зміни статусу проєкту.",
      },
      { status: 500 }
    );
  }
}