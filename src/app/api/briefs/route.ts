import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type BriefCreateBody = {
  client_id?: unknown;
  category?: unknown;
  requirement_desc?: unknown;
  budget?: unknown;
  status?: unknown;
};

const BRIEF_STATUSES = ["нове", "у роботі", "оброблено", "відхилено"] as const;

async function findBriefs() {
  return prisma.brief.findMany({
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
    orderBy: {
      brief_id: "asc",
    },
  });
}

type BriefWithClient = Awaited<ReturnType<typeof findBriefs>>[number];

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

export async function GET() {
  try {
    const briefs = await findBriefs();

    return NextResponse.json({
      ok: true,
      data: briefs.map(normalizeBrief),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити брифи з бази даних.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BriefCreateBody;

    const client_id = Number(body.client_id);
    const category = normalizeSpaces(String(body.category ?? ""));
    const requirement_desc = normalizeSpaces(String(body.requirement_desc ?? ""));
    const budget = parseBudget(body.budget);
    const status = String(body.status ?? "нове").trim();

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

    if (status !== "нове") {
      return NextResponse.json(
        {
          ok: false,
          message: "Новий бриф завжди створюється зі статусом «нове». Інші статуси встановлюються під час обробки.",
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
        { ok: false, message: "Обраного клієнта не знайдено в базі даних." },
        { status: 404 }
      );
    }

    if (client.status === "неактивний") {
      return NextResponse.json(
        {
          ok: false,
          message: "Не можна створити новий бриф для неактивного клієнта.",
        },
        { status: 400 }
      );
    }

    const duplicateBrief = await prisma.brief.findFirst({
      where: {
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

    const brief = await prisma.brief.create({
      data: {
        client_id,
        category,
        requirement_desc,
        budget,
        status: "нове",
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

    return NextResponse.json(
      {
        ok: true,
        message: "Бриф успішно створено.",
        data: normalizeBrief(brief),
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
          message: "Неможливо створити бриф: клієнта не існує.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час створення брифу. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}