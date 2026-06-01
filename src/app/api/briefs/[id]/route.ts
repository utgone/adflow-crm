import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type BriefUpdateBody = {
  client_id?: unknown;
  category?: unknown;
  requirement_desc?: unknown;
  budget?: unknown;
  status?: unknown;
};

const BRIEF_STATUSES = ["нове", "у роботі", "оброблено", "відхилено"] as const;

async function findBriefById(briefId: number) {
  return prisma.brief.findUnique({
    where: {
      brief_id: briefId,
    },
    include: {
      client: {
        select: {
          client_id: true,
          full_name: true,
          company_name: true,
          status: true,
        },
      },
      _count: {
        select: {
          project: true,
        },
      },
    },
  });
}

type BriefWithClient = NonNullable<Awaited<ReturnType<typeof findBriefById>>>;

function normalizeBrief(brief: BriefWithClient) {
  const projectCount = brief._count.project;

  return {
    brief_id: brief.brief_id,
    client_id: brief.client_id,
    client_name: brief.client.full_name,
    client_company: brief.client.company_name ?? "Без компанії",
    client_status: brief.client.status,
    category: brief.category,
    requirement_desc: brief.requirement_desc,
    budget: Number(brief.budget),
    created_date: brief.created_date.toISOString().split("T")[0],
    status: brief.status,
    project_count: projectCount,
    has_project: projectCount > 0,
    can_create_project: brief.status === "нове" && brief.client.status === "активний" && projectCount === 0,
    can_edit_core: projectCount === 0,
    can_reject: projectCount === 0 && brief.status !== "відхилено",
  };
}

function normalizeSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function parseBriefId(value: string) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function parseBudget(value: unknown) {
  const normalized =
    typeof value === "string"
      ? value.replace(/\s/g, "").replace(",", ".")
      : value;

  const budget = Number(normalized);

  if (!Number.isFinite(budget)) {
    return null;
  }

  const hasMoreThanTwoDecimals =
    typeof normalized === "string" && /^\d+(\.\d{3,})$/.test(normalized);

  if (hasMoreThanTwoDecimals) {
    return null;
  }

  return Math.round(budget * 100) / 100;
}

function isValidCategory(value: string) {
  const category = normalizeSpaces(value);

  if (category.length < 3 || category.length > 100) {
    return false;
  }

  return /^[A-Za-zА-Яа-яІіЇїЄєҐґ0-9'ʼ`\-.,&() /]+$/.test(category);
}

function isValidRequirement(value: string) {
  const requirement = normalizeSpaces(value);

  return requirement.length >= 15 && requirement.length <= 500;
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

function hasCoreChanges(params: {
  existingClientId: number;
  nextClientId: number;
  existingCategory: string;
  nextCategory: string;
  existingRequirement: string;
  nextRequirement: string;
  existingBudget: unknown;
  nextBudget: number;
}) {
  return (
    params.existingClientId !== params.nextClientId ||
    params.existingCategory !== params.nextCategory ||
    params.existingRequirement !== params.nextRequirement ||
    Number(params.existingBudget) !== params.nextBudget
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const briefId = parseBriefId(id);

    if (!briefId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID брифу." },
        { status: 400 }
      );
    }

    const brief = await findBriefById(briefId);

    if (!brief) {
      return NextResponse.json(
        { ok: false, message: "Бриф не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: normalizeBrief(brief),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити дані брифу.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const briefId = parseBriefId(id);

    if (!briefId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID брифу." },
        { status: 400 }
      );
    }

    const existingBrief = await prisma.brief.findUnique({
      where: {
        brief_id: briefId,
      },
      include: {
        _count: {
          select: {
            project: true,
          },
        },
      },
    });

    if (!existingBrief) {
      return NextResponse.json(
        { ok: false, message: "Бриф не знайдено." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as BriefUpdateBody;

    const client_id = Number(body.client_id);
    const category = normalizeSpaces(String(body.category ?? ""));
    const requirement_desc = normalizeSpaces(String(body.requirement_desc ?? ""));
    const budget = parseBudget(body.budget);
    const status = String(body.status ?? "").trim();

    if (!Number.isInteger(client_id) || client_id <= 0) {
      return NextResponse.json(
        { ok: false, message: "Оберіть коректного клієнта для брифу." },
        { status: 400 }
      );
    }

    if (!isValidCategory(category)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Категорія має містити 3–100 символів без службових символів.",
        },
        { status: 400 }
      );
    }

    if (!isValidRequirement(requirement_desc)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Опис вимог має містити від 15 до 500 символів.",
        },
        { status: 400 }
      );
    }

    if (budget === null || budget < 100 || budget > 1000000) {
      return NextResponse.json(
        {
          ok: false,
          message: "Бюджет має бути числом від 100 до 1 000 000 грн, максимум з 2 знаками після коми.",
        },
        { status: 400 }
      );
    }

    if (!BRIEF_STATUSES.includes(status as (typeof BRIEF_STATUSES)[number])) {
      return NextResponse.json(
        {
          ok: false,
          message: "Статус брифу може бути тільки «нове», «у роботі», «оброблено» або «відхилено».",
        },
        { status: 400 }
      );
    }

    const client = await prisma.client.findUnique({
      where: {
        client_id,
      },
    });

    if (!client) {
      return NextResponse.json(
        { ok: false, message: "Обраного клієнта не знайдено." },
        { status: 404 }
      );
    }

    const projectCount = existingBrief._count.project;
    const linkedToProject = projectCount > 0;

    const coreChanged = hasCoreChanges({
      existingClientId: existingBrief.client_id,
      nextClientId: client_id,
      existingCategory: existingBrief.category,
      nextCategory: category,
      existingRequirement: existingBrief.requirement_desc,
      nextRequirement: requirement_desc,
      existingBudget: existingBrief.budget,
      nextBudget: budget,
    });

    if (linkedToProject && coreChanged) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Цей бриф вже має створений проєкт, тому не можна змінювати клієнта, категорію, опис або бюджет. Це захищає історію CRM.",
        },
        { status: 400 }
      );
    }

    if (linkedToProject && status === "відхилено") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Бриф не можна відхилити, тому що за ним вже створено проєкт.",
        },
        { status: 400 }
      );
    }

    if (linkedToProject && status !== "оброблено") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Якщо за брифом вже створено проєкт, статус брифу має бути «оброблено».",
        },
        { status: 400 }
      );
    }

    if (client.status === "неактивний" && existingBrief.client_id !== client_id) {
      return NextResponse.json(
        {
          ok: false,
          message: "Не можна перенести бриф на неактивного клієнта.",
        },
        { status: 400 }
      );
    }

    if (client.status === "неактивний" && status !== "відхилено") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Для неактивного клієнта бриф можна тільки залишити в історії або перевести у статус «відхилено».",
        },
        { status: 400 }
      );
    }

    const duplicateBrief = await prisma.brief.findFirst({
      where: {
        brief_id: {
          not: briefId,
        },
        client_id,
        category,
        requirement_desc,
        status: {
          in: ["нове", "у роботі"],
        },
      },
    });

    if (duplicateBrief) {
      return NextResponse.json(
        {
          ok: false,
          message: "У цього клієнта вже є схожий активний бриф з такою категорією та описом.",
        },
        { status: 409 }
      );
    }

    const brief = await prisma.brief.update({
      where: {
        brief_id: briefId,
      },
      data: {
        client_id,
        category,
        requirement_desc,
        budget,
        status,
      },
      include: {
        client: {
          select: {
            client_id: true,
            full_name: true,
            company_name: true,
            status: true,
          },
        },
        _count: {
          select: {
            project: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Дані брифу успішно оновлено.",
      data: normalizeBrief(brief),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Бриф не знайдено." },
        { status: 404 }
      );
    }

    if (code === "P2003") {
      return NextResponse.json(
        {
          ok: false,
          message: "Неможливо оновити бриф: обраний клієнт не існує.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час оновлення брифу. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const briefId = parseBriefId(id);

    if (!briefId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID брифу." },
        { status: 400 }
      );
    }

    const existingBrief = await prisma.brief.findUnique({
      where: {
        brief_id: briefId,
      },
      include: {
        _count: {
          select: {
            project: true,
          },
        },
      },
    });

    if (!existingBrief) {
      return NextResponse.json(
        { ok: false, message: "Бриф не знайдено." },
        { status: 404 }
      );
    }

    if (existingBrief._count.project > 0) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Бриф не можна відхилити, тому що за ним вже створено проєкт. Історія CRM має залишатися узгодженою.",
        },
        { status: 400 }
      );
    }

    if (existingBrief.status === "відхилено") {
      const brief = await findBriefById(briefId);

      return NextResponse.json({
        ok: true,
        message: "Бриф вже має статус «відхилено».",
        data: brief ? normalizeBrief(brief) : null,
      });
    }

    const brief = await prisma.brief.update({
      where: {
        brief_id: briefId,
      },
      data: {
        status: "відхилено",
      },
      include: {
        client: {
          select: {
            client_id: true,
            full_name: true,
            company_name: true,
            status: true,
          },
        },
        _count: {
          select: {
            project: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        "Бриф не видалено фізично, а переведено у статус «відхилено». Це зберігає історію клієнта.",
      data: normalizeBrief(brief),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Бриф не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час зміни статусу брифу.",
      },
      { status: 500 }
    );
  }
}