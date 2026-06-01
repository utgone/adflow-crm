import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type MaterialCreateBody = {
  task_id?: unknown;
  file_link?: unknown;
  file_format?: unknown;
  upload_date?: unknown;
  material_status?: unknown;
  client_comment?: unknown;
};

const MATERIAL_STATUSES = [
  "завантажено",
  "на перевірці",
  "погоджено",
  "відхилено",
  "на доопрацюванні",
] as const;

const FINAL_MATERIAL_STATUSES = ["погоджено", "відхилено"] as const;

const ALLOWED_FILE_FORMATS = [
  "zip",
  "docx",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "txt",
] as const;

const FINAL_TASK_STATUSES = ["виконано", "скасовано"] as const;

const FINAL_PROJECT_STATUSES = ["завершено", "зупинено", "скасовано"] as const;

async function findMaterials() {
  return prisma.material.findMany({
    include: {
      task: {
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
      },
    },
    orderBy: {
      material_id: "asc",
    },
  });
}

type MaterialWithRelations = Awaited<ReturnType<typeof findMaterials>>[number];

function normalizeMaterial(material: MaterialWithRelations) {
  const task = material.task;
  const project = task.project;
  const client = project.brief.client;
  const isFinal = isFinalMaterialStatus(material.material_status);

  return {
    material_id: material.material_id,

    task_id: material.task_id,
    task_description: task.description,
    task_status: task.task_status,

    project_id: project.project_id,
    project_name: project.project_name,
    project_status: project.status,

    client_id: client.client_id,
    client_name: client.full_name,
    client_company: client.company_name ?? "Без компанії",
    client_status: client.status,

    employee_id: task.employee_id,
    employee_name: task.employee.full_name,
    employee_position: task.employee.position.position_name,

    service_id: task.service_id,
    service_name: task.service.service_name,

    date: formatDate(material.date),
    file_link: material.file_link,
    file_name: getFileName(material.file_link),
    file_format: material.file_format.toLowerCase(),
    upload_date: formatDate(material.upload_date),
    material_status: material.material_status,
    client_comment: material.client_comment ?? "",

    is_final: isFinal,
    can_edit:
      !isFinal &&
      !isFinalTaskStatus(task.task_status) &&
      !isFinalProjectStatus(project.status),
    can_review:
      material.material_status === "на перевірці" &&
      !isFinalTaskStatus(task.task_status) &&
      !isFinalProjectStatus(project.status),
    can_send_to_review:
      ["завантажено", "на доопрацюванні"].includes(material.material_status) &&
      !isFinalTaskStatus(task.task_status) &&
      !isFinalProjectStatus(project.status),
    can_rework:
      material.material_status === "на перевірці" &&
      !isFinalTaskStatus(task.task_status) &&
      !isFinalProjectStatus(project.status),
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

function isMaterialStatus(value: string) {
  return MATERIAL_STATUSES.includes(
    value as (typeof MATERIAL_STATUSES)[number]
  );
}

function isFinalMaterialStatus(value: string) {
  return FINAL_MATERIAL_STATUSES.includes(
    value as (typeof FINAL_MATERIAL_STATUSES)[number]
  );
}

function isFileFormat(value: string) {
  return ALLOWED_FILE_FORMATS.includes(
    value.toLowerCase() as (typeof ALLOWED_FILE_FORMATS)[number]
  );
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

function isValidFileLink(value: string) {
  if (value.length < 12 || value.length > 300) {
    return false;
  }

  return /^https?:\/\/\S+$/i.test(value);
}

function getFileName(link: string) {
  try {
    const url = new URL(link);
    const lastPart = url.pathname.split("/").filter(Boolean).pop();

    return lastPart || link;
  } catch {
    return link.split("/").pop() || link;
  }
}

function extractFormatFromLink(link: string) {
  const clean = link.split("?")[0].split("#")[0];
  const part = clean.split(".").pop();

  return part ? part.toLowerCase() : "";
}

function isValidClientComment(value: string) {
  const comment = normalizeSpaces(value);

  return comment.length === 0 || (comment.length >= 3 && comment.length <= 500);
}

function validateUploadDates(params: {
  materialDate: string;
  uploadDate: string;
  taskDate: string;
  deadline: string;
}) {
  if (!isRealISODate(params.materialDate)) {
    return "Вкажіть коректну дату матеріалу.";
  }

  if (!isRealISODate(params.uploadDate)) {
    return "Вкажіть коректну дату завантаження матеріалу.";
  }

  if (params.uploadDate < params.materialDate) {
    return "Дата завантаження матеріалу не може бути раніше дати матеріалу.";
  }

  if (params.materialDate < params.taskDate) {
    return "Дата матеріалу не може бути раніше дати створення задачі.";
  }

  if (params.materialDate > params.deadline) {
    return "Дата матеріалу не може бути пізніше дедлайну задачі.";
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
    const materials = await findMaterials();

    return NextResponse.json({
      ok: true,
      data: materials.map(normalizeMaterial),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити матеріали з бази даних.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MaterialCreateBody;

    const task_id = Number(body.task_id);
    const file_link = normalizeSpaces(optionalString(body.file_link));
    const bodyFormat = normalizeSpaces(optionalString(body.file_format)).toLowerCase();
    const file_format = bodyFormat || extractFormatFromLink(file_link);
    const material_status =
      normalizeSpaces(optionalString(body.material_status)) || "завантажено";
    const client_comment = normalizeSpaces(optionalString(body.client_comment));

    const today = getTodayISO();
    const upload_date = normalizeSpaces(optionalString(body.upload_date)) || today;
    const materialDate = today;

    if (!Number.isInteger(task_id) || task_id <= 0) {
      return NextResponse.json(
        { ok: false, message: "Оберіть коректну задачу для матеріалу." },
        { status: 400 }
      );
    }

    if (!isValidFileLink(file_link)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Посилання на файл має починатися з http:// або https:// і містити не більше 300 символів.",
        },
        { status: 400 }
      );
    }

    if (!isFileFormat(file_format)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Формат файлу може бути тільки: zip, docx, pdf, png, jpg, jpeg або txt.",
        },
        { status: 400 }
      );
    }

    const formatFromLink = extractFormatFromLink(file_link);

    if (formatFromLink && isFileFormat(formatFromLink) && formatFromLink !== file_format) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Формат файлу не збігається з розширенням у посиланні. Виправте file_format або file_link.",
        },
        { status: 400 }
      );
    }

    if (material_status !== "завантажено") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Новий матеріал завжди створюється зі статусом «завантажено». Далі його можна відправити на перевірку.",
        },
        { status: 400 }
      );
    }

    if (!isValidClientComment(client_comment)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Коментар клієнта має бути порожнім або містити від 3 до 500 символів.",
        },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: {
        task_id,
      },
      include: {
        project: true,
      },
    });

    if (!task) {
      return NextResponse.json(
        { ok: false, message: "Задачу не знайдено в базі даних." },
        { status: 404 }
      );
    }

    if (isFinalTaskStatus(task.task_status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна додати матеріал до виконаної або скасованої задачі.",
        },
        { status: 400 }
      );
    }

    if (isFinalProjectStatus(task.project.status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна додати матеріал до задачі з завершеного, зупиненого або скасованого проєкту.",
        },
        { status: 400 }
      );
    }

    const dateError = validateUploadDates({
      materialDate,
      uploadDate: upload_date,
      taskDate: formatDate(task.date),
      deadline: formatDate(task.deadline),
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

    const material = await prisma.material.create({
      data: {
        task_id,
        date: toDbDate(materialDate),
        file_link,
        file_format,
        upload_date: toDbDate(upload_date),
        material_status: "завантажено",
        client_comment: client_comment || null,
      },
      include: {
        task: {
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
        },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        message: "Матеріал успішно завантажено в PostgreSQL.",
        data: normalizeMaterial(material),
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
          message: "Неможливо створити матеріал: повʼязана задача не існує.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час створення матеріалу. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}