import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type TaskCreateBody = {
  project_id?: unknown;
  employee_id?: unknown;
  service_id?: unknown;
  description?: unknown;
  deadline?: unknown;
  task_status?: unknown;
  manager_comment?: unknown;
};

const TASK_STATUSES = [
  "нова",
  "в роботі",
  "готово для перевірки",
  "на доопрацюванні",
  "передано клієнту",
  "на паузі",
  "виконано",
  "скасовано",
] as const;

const FINAL_TASK_STATUSES = ["виконано", "скасовано"] as const;

const FINAL_PROJECT_STATUSES = ["завершено", "зупинено", "скасовано"] as const;

async function findTasks() {
  return prisma.task.findMany({
    include: {
      project: {
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
      },
      employee: {
        include: {
          position: true,
        },
      },
      service: true,
    },
    orderBy: {
      task_id: "asc",
    },
  });
}

type TaskWithRelations = Awaited<ReturnType<typeof findTasks>>[number];

function normalizeTask(task: TaskWithRelations) {
  const deadline = formatDate(task.deadline);
  const isFinal = isFinalTaskStatus(task.task_status);

  return {
    task_id: task.task_id,

    project_id: task.project_id,
    project_name: task.project.project_name,
    project_status: task.project.status,

    client_id: task.project.brief.client.client_id,
    client_name: task.project.brief.client.full_name,
    client_company: task.project.brief.client.company_name ?? "Без компанії",

    employee_id: task.employee_id,
    employee_name: task.employee.full_name,
    employee_position: task.employee.position.position_name,
    employee_status: task.employee.status,

    service_id: task.service_id,
    service_name: task.service.service_name,

    description: task.description,
    deadline,
    task_status: task.task_status,
    manager_comment: task.manager_comment ?? "",
    date: formatDate(task.date),

    is_final: isFinal,
    is_overdue: !isFinal && deadline < getTodayISO(),
    can_edit: !isFinal && !isFinalProjectStatus(task.project.status),
    can_cancel: !isFinal && !isFinalProjectStatus(task.project.status),
    can_change_executor: !isFinal && !isFinalProjectStatus(task.project.status),
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

function isTaskStatus(value: string) {
  return TASK_STATUSES.includes(value as (typeof TASK_STATUSES)[number]);
}

function isFinalTaskStatus(value: string) {
  return FINAL_TASK_STATUSES.includes(
    value as (typeof FINAL_TASK_STATUSES)[number]
  );
}

function isFinalProjectStatus(value: string) {
  return FINAL_PROJECT_STATUSES.includes(
    value as (typeof FINAL_PROJECT_STATUSES)[number]
  );
}

function isValidDescription(value: string) {
  const description = normalizeSpaces(value);

  return description.length >= 10 && description.length <= 500;
}

function isValidManagerComment(value: string) {
  const comment = normalizeSpaces(value);

  return comment.length === 0 || (comment.length >= 3 && comment.length <= 500);
}

function textIncludesAny(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();

  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

function getSpecializationError(params: {
  positionName: string;
  serviceName: string;
}) {
  const position = params.positionName.toLowerCase();
  const service = params.serviceName.toLowerCase();

  const rules = [
    {
      serviceKeywords: ["seo", "сео"],
      allowedPositionKeywords: ["seo", "сео"],
      label: "SEO / СЕО-спеціаліст",
    },
    {
      serviceKeywords: ["контент", "копірайт", "текст", "публікац", "пост"],
      allowedPositionKeywords: ["контент", "smm"],
      label: "Контент-менеджер / SMM-спеціаліст",
    },
    {
      serviceKeywords: ["meta ads", "facebook", "instagram", "таргет"],
      allowedPositionKeywords: ["таргет", "ads", "реклам"],
      label: "Таргетолог / Ads-спеціаліст",
    },
    {
      serviceKeywords: ["google ads", "ppc", "контекст"],
      allowedPositionKeywords: ["google", "ppc", "ads", "реклам"],
      label: "PPC / Google Ads-спеціаліст",
    },
    {
      serviceKeywords: ["branding", "бренд", "дизайн", "логотип", "банер"],
      allowedPositionKeywords: ["дизайн", "бренд"],
      label: "Дизайнер / бренд-спеціаліст",
    },
    {
      serviceKeywords: ["smm", "соцмереж"],
      allowedPositionKeywords: ["smm", "контент", "таргет"],
      label: "SMM / Контент / Таргет-спеціаліст",
    },
  ];

  const matchedRule = rules.find((rule) =>
    textIncludesAny(service, rule.serviceKeywords)
  );

  if (!matchedRule) {
    return "";
  }

  const allowed = textIncludesAny(position, matchedRule.allowedPositionKeywords);

  if (allowed) {
    return "";
  }

  return `Послуга «${params.serviceName}» не відповідає посаді «${params.positionName}». Для цієї послуги потрібен: ${matchedRule.label}.`;
}

function validateDeadline(params: {
  deadline: string;
  taskDate: string;
  projectStartDate: string;
  projectEndDate: string | null;
}) {
  if (!isRealISODate(params.deadline)) {
    return "Вкажіть коректний дедлайн задачі.";
  }

  if (params.deadline < params.taskDate) {
    return "Дедлайн задачі не може бути раніше дати створення задачі.";
  }

  if (params.deadline < params.projectStartDate) {
    return "Дедлайн задачі не може бути раніше дати початку проєкту.";
  }

  if (params.projectEndDate && params.deadline > params.projectEndDate) {
    return "Дедлайн задачі не може бути пізніше дати завершення проєкту.";
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
    const tasks = await findTasks();

    return NextResponse.json({
      ok: true,
      data: tasks.map(normalizeTask),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити задачі з бази даних.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as TaskCreateBody;

    const project_id = Number(body.project_id);
    const employee_id = Number(body.employee_id);
    const service_id = Number(body.service_id);
    const description = normalizeSpaces(optionalString(body.description));
    const deadline = normalizeSpaces(optionalString(body.deadline));
    const task_status = normalizeSpaces(optionalString(body.task_status)) || "нова";
    const manager_comment = normalizeSpaces(optionalString(body.manager_comment));

    if (!Number.isInteger(project_id) || project_id <= 0) {
      return NextResponse.json(
        { ok: false, message: "Оберіть коректний проєкт для задачі." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(employee_id) || employee_id <= 0) {
      return NextResponse.json(
        { ok: false, message: "Оберіть коректного виконавця задачі." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(service_id) || service_id <= 0) {
      return NextResponse.json(
        { ok: false, message: "Оберіть коректну послугу для задачі." },
        { status: 400 }
      );
    }

    if (!isValidDescription(description)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Опис задачі має містити від 10 до 500 символів.",
        },
        { status: 400 }
      );
    }

    if (task_status !== "нова") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Нова задача завжди створюється зі статусом «нова». Інші статуси встановлюються під час роботи.",
        },
        { status: 400 }
      );
    }

    if (!isValidManagerComment(manager_comment)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Коментар менеджера має бути порожнім або містити від 3 до 500 символів.",
        },
        { status: 400 }
      );
    }

    const [project, employee, service] = await Promise.all([
      prisma.project.findUnique({
        where: {
          project_id,
        },
      }),
      prisma.employee.findUnique({
        where: {
          employee_id,
        },
        include: {
          position: true,
        },
      }),
      prisma.service.findUnique({
        where: {
          service_id,
        },
      }),
    ]);

    if (!project) {
      return NextResponse.json(
        { ok: false, message: "Проєкт не знайдено в базі даних." },
        { status: 404 }
      );
    }

    if (isFinalProjectStatus(project.status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна створити задачу для завершеного, зупиненого або скасованого проєкту.",
        },
        { status: 400 }
      );
    }

    if (!employee) {
      return NextResponse.json(
        { ok: false, message: "Співробітника не знайдено в базі даних." },
        { status: 404 }
      );
    }

    if (employee.status === "звільнений") {
      return NextResponse.json(
        {
          ok: false,
          message: "Не можна призначити задачу на звільненого співробітника.",
        },
        { status: 400 }
      );
    }

    if (!service) {
      return NextResponse.json(
        { ok: false, message: "Послугу не знайдено в базі даних." },
        { status: 404 }
      );
    }

    const specializationError = getSpecializationError({
      positionName: employee.position.position_name,
      serviceName: service.service_name,
    });

    if (specializationError) {
      return NextResponse.json(
        {
          ok: false,
          message: specializationError,
        },
        { status: 400 }
      );
    }

    const taskDate = getTodayISO();
    const projectStartDate = formatDate(project.start_date);
    const projectEndDate = project.end_date ? formatDate(project.end_date) : null;

    const deadlineError = validateDeadline({
      deadline,
      taskDate,
      projectStartDate,
      projectEndDate,
    });

    if (deadlineError) {
      return NextResponse.json(
        {
          ok: false,
          message: deadlineError,
        },
        { status: 400 }
      );
    }

    const task = await prisma.$transaction(async (tx) => {
      const createdTask = await tx.task.create({
        data: {
          project_id,
          employee_id,
          service_id,
          description,
          deadline: toDbDate(deadline),
          task_status: "нова",
          manager_comment: manager_comment || null,
          date: toDbDate(taskDate),
        },
        include: {
          project: {
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
          },
          employee: {
            include: {
              position: true,
            },
          },
          service: true,
        },
      });

      await tx.task_assignment_log.create({
        data: {
          task_id: createdTask.task_id,
          project_id,
          employee_id,
          service_id,
          assignment_note: `Первинне призначення задачі. Виконавець: ${employee.full_name}. Послуга: ${service.service_name}.`,
        },
      });

      return createdTask;
    });

    return NextResponse.json(
      {
        ok: true,
        message:
          "Задачу успішно створено. Первинне призначення записано в історію.",
        data: normalizeTask(task),
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
          message:
            "Неможливо створити задачу: проєкт, співробітник або послуга не існує.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час створення задачі. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}