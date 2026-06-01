import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type MaterialUpdateBody = {
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

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  завантажено: ["завантажено", "на перевірці", "відхилено"],
  "на перевірці": [
    "на перевірці",
    "погоджено",
    "на доопрацюванні",
    "відхилено",
  ],
  "на доопрацюванні": [
    "на доопрацюванні",
    "завантажено",
    "на перевірці",
    "відхилено",
  ],
  погоджено: ["погоджено"],
  відхилено: ["відхилено"],
};

async function findMaterialById(materialId: number) {
  return prisma.material.findUnique({
    where: {
      material_id: materialId,
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
}

type MaterialWithRelations = NonNullable<
  Awaited<ReturnType<typeof findMaterialById>>
>;

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

function parseMaterialId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
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

function isAllowedTransition(from: string, to: string) {
  if (from === to) {
    return true;
  }

  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

function validateUploadDates(params: {
  materialDate: string;
  uploadDate: string;
  taskDate: string;
  deadline: string;
}) {
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const materialId = parseMaterialId(id);

    if (!materialId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID матеріалу." },
        { status: 400 }
      );
    }

    const material = await findMaterialById(materialId);

    if (!material) {
      return NextResponse.json(
        { ok: false, message: "Матеріал не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: normalizeMaterial(material),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити дані матеріалу.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const materialId = parseMaterialId(id);

    if (!materialId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID матеріалу." },
        { status: 400 }
      );
    }

    const existingMaterial = await findMaterialById(materialId);

    if (!existingMaterial) {
      return NextResponse.json(
        { ok: false, message: "Матеріал не знайдено." },
        { status: 404 }
      );
    }

    if (isFinalMaterialStatus(existingMaterial.material_status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Фінальний матеріал заблоковано від редагування, щоб не порушити історію CRM.",
        },
        { status: 400 }
      );
    }

    if (isFinalTaskStatus(existingMaterial.task.task_status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна редагувати матеріал, якщо повʼязана задача вже виконана або скасована.",
        },
        { status: 400 }
      );
    }

    if (isFinalProjectStatus(existingMaterial.task.project.status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна редагувати матеріал, якщо повʼязаний проєкт вже у фінальному статусі.",
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as MaterialUpdateBody;

    if (
      body.task_id !== undefined &&
      Number(body.task_id) !== existingMaterial.task_id
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна змінити task_id існуючого матеріалу. Звʼязок task → material має залишатися незмінним.",
        },
        { status: 400 }
      );
    }

    const file_link =
      body.file_link === undefined
        ? existingMaterial.file_link
        : normalizeSpaces(optionalString(body.file_link));

    const bodyFormat =
      body.file_format === undefined
        ? existingMaterial.file_format
        : normalizeSpaces(optionalString(body.file_format)).toLowerCase();

    const file_format = bodyFormat || extractFormatFromLink(file_link);

    const upload_date =
      body.upload_date === undefined
        ? formatDate(existingMaterial.upload_date)
        : normalizeSpaces(optionalString(body.upload_date));

    const material_status =
      body.material_status === undefined
        ? existingMaterial.material_status
        : normalizeSpaces(optionalString(body.material_status));

    const client_comment =
      body.client_comment === undefined
        ? existingMaterial.client_comment ?? ""
        : normalizeSpaces(optionalString(body.client_comment));

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

    if (!isMaterialStatus(material_status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Статус матеріалу може бути тільки: завантажено, на перевірці, погоджено, відхилено або на доопрацюванні.",
        },
        { status: 400 }
      );
    }

    if (!isAllowedTransition(existingMaterial.material_status, material_status)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Некоректний перехід статусу матеріалу: «${existingMaterial.material_status}» → «${material_status}».`,
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

    if (
      ["на доопрацюванні", "відхилено"].includes(material_status) &&
      client_comment.length < 3
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Для статусу «на доопрацюванні» або «відхилено» потрібно вказати коментар мінімум 3 символи.",
        },
        { status: 400 }
      );
    }

    const dateError = validateUploadDates({
      materialDate: formatDate(existingMaterial.date),
      uploadDate: upload_date,
      taskDate: formatDate(existingMaterial.task.date),
      deadline: formatDate(existingMaterial.task.deadline),
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

    const material = await prisma.material.update({
      where: {
        material_id: materialId,
      },
      data: {
        file_link,
        file_format,
        upload_date: toDbDate(upload_date),
        material_status,
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

    return NextResponse.json({
      ok: true,
      message: "Матеріал успішно оновлено.",
      data: normalizeMaterial(material),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Матеріал не знайдено." },
        { status: 404 }
      );
    }

    if (code === "P2003") {
      return NextResponse.json(
        {
          ok: false,
          message: "Неможливо оновити матеріал: повʼязана задача не існує.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час оновлення матеріалу. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const materialId = parseMaterialId(id);

    if (!materialId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID матеріалу." },
        { status: 400 }
      );
    }

    const existingMaterial = await findMaterialById(materialId);

    if (!existingMaterial) {
      return NextResponse.json(
        { ok: false, message: "Матеріал не знайдено." },
        { status: 404 }
      );
    }

    if (existingMaterial.material_status === "відхилено") {
      return NextResponse.json({
        ok: true,
        message: "Матеріал вже має статус «відхилено».",
        data: normalizeMaterial(existingMaterial),
      });
    }

    if (existingMaterial.material_status === "погоджено") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Погоджений матеріал не можна відхилити або видалити заднім числом.",
        },
        { status: 400 }
      );
    }

    if (isFinalTaskStatus(existingMaterial.task.task_status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна змінити матеріал, якщо повʼязана задача вже виконана або скасована.",
        },
        { status: 400 }
      );
    }

    if (isFinalProjectStatus(existingMaterial.task.project.status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна змінити матеріал, якщо повʼязаний проєкт вже у фінальному статусі.",
        },
        { status: 400 }
      );
    }

    const material = await prisma.material.update({
      where: {
        material_id: materialId,
      },
      data: {
        material_status: "відхилено",
        client_comment:
          existingMaterial.client_comment || "Матеріал відхилено адміністратором.",
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

    return NextResponse.json({
      ok: true,
      message:
        "Матеріал не видалено фізично, а переведено у статус «відхилено».",
      data: normalizeMaterial(material),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Матеріал не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час зміни статусу матеріалу.",
      },
      { status: 500 }
    );
  }
}