import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type CampaignUpdateBody = {
  project_id?: unknown;
  channel?: unknown;
  launch_date?: unknown;
  stop_date?: unknown;
  budget?: unknown;
  campaign_status?: unknown;
};

const CAMPAIGN_CHANNELS = [
  "Google",
  "Meta",
  "TikTok",
  "Instagram",
  "Facebook",
] as const;

const CAMPAIGN_STATUSES = [
  "заплановано",
  "запущено",
  "завершено",
  "зупинено",
  "скасовано",
] as const;

const FINAL_CAMPAIGN_STATUSES = ["завершено", "зупинено", "скасовано"] as const;
const FINAL_PROJECT_STATUSES = ["завершено", "зупинено", "скасовано"] as const;

const MAX_CAMPAIGN_DURATION_DAYS = 370;
const MAX_CAMPAIGN_PLANNING_DAYS = 730;
const MAX_CAMPAIGN_BUDGET = 10_000_000;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  заплановано: ["заплановано", "запущено", "скасовано"],
  запущено: ["запущено", "завершено", "зупинено", "скасовано"],
  завершено: ["завершено"],
  зупинено: ["зупинено"],
  скасовано: ["скасовано"],
};

async function findCampaignById(campaignId: number) {
  return prisma.campaign.findUnique({
    where: {
      campaign_id: campaignId,
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
    },
  });
}

type CampaignWithRelations = NonNullable<
  Awaited<ReturnType<typeof findCampaignById>>
>;

function normalizeCampaign(campaign: CampaignWithRelations) {
  const project = campaign.project;
  const brief = project.brief;
  const client = brief.client;

  const launchDate = formatDate(campaign.launch_date);
  const stopDate = campaign.stop_date ? formatDate(campaign.stop_date) : null;
  const budget = Number(campaign.budget);
  const briefBudget = Number(brief.budget);
  const today = getTodayISO();

  const isFinal = isFinalCampaignStatus(campaign.campaign_status);
  const projectFinal = isFinalProjectStatus(project.status);

  return {
    campaign_id: campaign.campaign_id,

    project_id: campaign.project_id,
    project_name: project.project_name,
    project_status: project.status,
    project_start_date: formatDate(project.start_date),
    project_end_date: project.end_date ? formatDate(project.end_date) : null,

    brief_id: brief.brief_id,
    brief_budget: briefBudget,

    client_id: client.client_id,
    client_name: client.full_name,
    client_company: client.company_name ?? "Без компанії",
    client_status: client.status,

    channel: campaign.channel,
    launch_date: launchDate,
    stop_date: stopDate,
    budget,
    campaign_status: campaign.campaign_status,

    is_final: isFinal,
    is_running:
      campaign.campaign_status === "запущено" &&
      launchDate <= today &&
      (!stopDate || stopDate >= today),
    is_planned: campaign.campaign_status === "заплановано",
    is_overdue:
      campaign.campaign_status === "запущено" &&
      Boolean(stopDate) &&
      String(stopDate) < today,

    can_edit: !isFinal && !projectFinal,
    can_start: campaign.campaign_status === "заплановано" && !projectFinal,
    can_finish: campaign.campaign_status === "запущено" && !projectFinal,
    can_stop: campaign.campaign_status === "запущено" && !projectFinal,
    can_cancel:
      ["заплановано", "запущено"].includes(campaign.campaign_status) &&
      !projectFinal,
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

function parseCampaignId(value: string) {
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

function addDaysISO(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().split("T")[0];
}

function maxISODate(...dates: (string | null | undefined)[]) {
  const validDates = dates.filter(Boolean) as string[];

  if (validDates.length === 0) {
    return getTodayISO();
  }

  return validDates.sort()[validDates.length - 1];
}

function minISODate(...dates: (string | null | undefined)[]) {
  const validDates = dates.filter(Boolean) as string[];

  if (validDates.length === 0) {
    return getTodayISO();
  }

  return validDates.sort()[0];
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

function parseMoney(value: unknown) {
  const raw = optionalString(value).replace(",", ".").trim();

  if (!raw) {
    return Number.NaN;
  }

  return Number(raw);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("uk-UA", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

function normalizeChannel(value: string) {
  const raw = normalizeSpaces(value).toLowerCase();

  const aliases: Record<string, (typeof CAMPAIGN_CHANNELS)[number]> = {
    google: "Google",
    "google ads": "Google",
    гугл: "Google",

    meta: "Meta",
    "meta ads": "Meta",

    tiktok: "TikTok",
    "tik tok": "TikTok",
    тікток: "TikTok",

    instagram: "Instagram",
    інстаграм: "Instagram",

    facebook: "Facebook",
    фейсбук: "Facebook",
  };

  return aliases[raw] || "";
}

function isCampaignChannel(value: string) {
  return CAMPAIGN_CHANNELS.includes(
    value as (typeof CAMPAIGN_CHANNELS)[number]
  );
}

function isCampaignStatus(value: string) {
  return CAMPAIGN_STATUSES.includes(
    value as (typeof CAMPAIGN_STATUSES)[number]
  );
}

function isFinalCampaignStatus(value: string) {
  return FINAL_CAMPAIGN_STATUSES.includes(
    value as (typeof FINAL_CAMPAIGN_STATUSES)[number]
  );
}

function isFinalProjectStatus(value: string) {
  return FINAL_PROJECT_STATUSES.includes(
    value as (typeof FINAL_PROJECT_STATUSES)[number]
  );
}

function isAllowedTransition(from: string, to: string) {
  if (from === to) {
    return true;
  }

  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

function normalizeOptionalDate(value: unknown) {
  const text = normalizeSpaces(optionalString(value));

  return text.length > 0 ? text : null;
}

function getLaunchMaxDate(projectStartDate: string, projectEndDate: string | null) {
  const planningBase = maxISODate(getTodayISO(), projectStartDate);
  const planningMax = addDaysISO(planningBase, MAX_CAMPAIGN_PLANNING_DAYS);

  return projectEndDate ? minISODate(projectEndDate, planningMax) : planningMax;
}

function getStopMaxDate(launchDate: string, projectEndDate: string | null) {
  const durationMax = addDaysISO(launchDate, MAX_CAMPAIGN_DURATION_DAYS);

  return projectEndDate ? minISODate(projectEndDate, durationMax) : durationMax;
}

function getAutoStopDate(params: {
  nextStatus: string;
  currentStopDate: string | null;
  launchDate: string;
  projectEndDate: string | null;
}) {
  if (!isFinalCampaignStatus(params.nextStatus)) {
    return params.currentStopDate;
  }

  if (params.currentStopDate) {
    return params.currentStopDate;
  }

  const today = getTodayISO();
  const candidate = today >= params.launchDate ? today : params.launchDate;
  const maxStopDate = getStopMaxDate(params.launchDate, params.projectEndDate);

  return minISODate(candidate, maxStopDate);
}

function validateCampaignDates(params: {
  launchDate: string;
  stopDate: string | null;
  projectStartDate: string;
  projectEndDate: string | null;
  campaignStatus: string;
  mode: "create" | "edit";
}) {
  const today = getTodayISO();

  if (!isRealISODate(params.launchDate)) {
    return "Вкажіть коректну дату запуску кампанії.";
  }

  if (params.launchDate < params.projectStartDate) {
    return "Дата запуску кампанії не може бути раніше дати початку проєкту.";
  }

  if (params.mode === "create" && params.launchDate < today) {
    return "Нову кампанію не можна створити з датою запуску в минулому.";
  }

  if (params.campaignStatus === "заплановано" && params.launchDate < today) {
    return "Запланована кампанія не може мати дату запуску в минулому. Запустіть її або змініть дату.";
  }

  if (params.campaignStatus === "запущено" && params.launchDate > today) {
    return "Запущена кампанія не може мати дату запуску в майбутньому.";
  }

  const launchMaxDate = getLaunchMaxDate(
    params.projectStartDate,
    params.projectEndDate
  );

  if (params.launchDate > launchMaxDate) {
    return `Дата запуску кампанії занадто далека. Максимальна дозволена дата: ${launchMaxDate}.`;
  }

  if (params.stopDate) {
    if (!isRealISODate(params.stopDate)) {
      return "Вкажіть коректну дату зупинки кампанії.";
    }

    if (params.stopDate < params.launchDate) {
      return "Дата зупинки кампанії не може бути раніше дати запуску.";
    }

    const stopMaxDate = getStopMaxDate(params.launchDate, params.projectEndDate);

    if (params.stopDate > stopMaxDate) {
      return `Дата зупинки кампанії занадто далека. Максимальна дозволена дата: ${stopMaxDate}.`;
    }
  }

  if (isFinalCampaignStatus(params.campaignStatus) && !params.stopDate) {
    return "Для завершеної, зупиненої або скасованої кампанії потрібно вказати дату зупинки.";
  }

  return "";
}

async function getCampaignBudgetUsed(projectId: number, excludeCampaignId?: number) {
  const where: {
    project_id: number;
    campaign_status: {
      not: string;
    };
    campaign_id?: {
      not: number;
    };
  } = {
    project_id: projectId,
    campaign_status: {
      not: "скасовано",
    },
  };

  if (excludeCampaignId) {
    where.campaign_id = {
      not: excludeCampaignId,
    };
  }

  const aggregate = await prisma.campaign.aggregate({
    where,
    _sum: {
      budget: true,
    },
  });

  return Number(aggregate._sum.budget ?? 0);
}

async function validateProjectBudget(params: {
  projectId: number;
  campaignBudget: number;
  projectBudget: number;
  excludeCampaignId: number;
}) {
  const used = await getCampaignBudgetUsed(
    params.projectId,
    params.excludeCampaignId
  );

  const total = roundMoney(used + params.campaignBudget);

  if (params.projectBudget > 0 && total > params.projectBudget) {
    return `Сумарний бюджет кампаній за цим проєктом буде ${formatMoney(
      total
    )} грн, але бюджет брифа становить ${formatMoney(
      params.projectBudget
    )} грн. Зменшіть бюджет кампанії.`;
  }

  return "";
}

async function validateActiveChannelDuplicate(params: {
  projectId: number;
  channel: string;
  excludeCampaignId: number;
  nextStatus: string;
}) {
  if (isFinalCampaignStatus(params.nextStatus)) {
    return "";
  }

  const conflict = await prisma.campaign.findFirst({
    where: {
      project_id: params.projectId,
      channel: params.channel,
      campaign_status: {
        notIn: ["завершено", "зупинено", "скасовано"],
      },
      campaign_id: {
        not: params.excludeCampaignId,
      },
    },
    select: {
      campaign_id: true,
      campaign_status: true,
    },
  });

  if (!conflict) {
    return "";
  }

  return `У цьому проєкті вже є активна або запланована кампанія каналу ${params.channel} (#${conflict.campaign_id}). Завершіть, зупиніть або скасуйте її перед створенням нової.`;
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
    const campaignId = parseCampaignId(id);

    if (!campaignId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID кампанії." },
        { status: 400 }
      );
    }

    const campaign = await findCampaignById(campaignId);

    if (!campaign) {
      return NextResponse.json(
        { ok: false, message: "Кампанію не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: normalizeCampaign(campaign),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити дані кампанії.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const campaignId = parseCampaignId(id);

    if (!campaignId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID кампанії." },
        { status: 400 }
      );
    }

    const existingCampaign = await findCampaignById(campaignId);

    if (!existingCampaign) {
      return NextResponse.json(
        { ok: false, message: "Кампанію не знайдено." },
        { status: 404 }
      );
    }

    if (isFinalCampaignStatus(existingCampaign.campaign_status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Фінальна кампанія заблокована від редагування, щоб не порушити історію CRM.",
        },
        { status: 400 }
      );
    }

    if (isFinalProjectStatus(existingCampaign.project.status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна редагувати кампанію, якщо її проєкт завершено, зупинено або скасовано.",
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as CampaignUpdateBody;

    if (
      body.project_id !== undefined &&
      Number(body.project_id) !== existingCampaign.project_id
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна змінити project_id існуючої кампанії. Звʼязок project → campaign має залишатися незмінним.",
        },
        { status: 400 }
      );
    }

    const channel =
      body.channel === undefined
        ? existingCampaign.channel
        : normalizeChannel(optionalString(body.channel));

    const launch_date =
      body.launch_date === undefined
        ? formatDate(existingCampaign.launch_date)
        : normalizeSpaces(optionalString(body.launch_date));

    const rawStopDate =
      body.stop_date === undefined
        ? existingCampaign.stop_date
          ? formatDate(existingCampaign.stop_date)
          : null
        : normalizeOptionalDate(body.stop_date);

    const budget =
      body.budget === undefined
        ? Number(existingCampaign.budget)
        : roundMoney(parseMoney(body.budget));

    const campaign_status =
      body.campaign_status === undefined
        ? existingCampaign.campaign_status
        : normalizeSpaces(optionalString(body.campaign_status));

    if (!channel || !isCampaignChannel(channel)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Канал кампанії може бути тільки: Google, Meta, TikTok, Instagram або Facebook.",
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(budget) || budget <= 0) {
      return NextResponse.json(
        { ok: false, message: "Бюджет кампанії має бути більшим за 0." },
        { status: 400 }
      );
    }

    if (budget > MAX_CAMPAIGN_BUDGET) {
      return NextResponse.json(
        {
          ok: false,
          message: "Бюджет кампанії виглядає нереалістично великим.",
        },
        { status: 400 }
      );
    }

    if (!isCampaignStatus(campaign_status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Статус кампанії може бути тільки: заплановано, запущено, завершено, зупинено або скасовано.",
        },
        { status: 400 }
      );
    }

    if (!isAllowedTransition(existingCampaign.campaign_status, campaign_status)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Некоректний перехід статусу кампанії: «${existingCampaign.campaign_status}» → «${campaign_status}».`,
        },
        { status: 400 }
      );
    }

    const projectStartDate = formatDate(existingCampaign.project.start_date);
    const projectEndDate = existingCampaign.project.end_date
      ? formatDate(existingCampaign.project.end_date)
      : null;

    const stop_date = getAutoStopDate({
      nextStatus: campaign_status,
      currentStopDate: rawStopDate,
      launchDate: launch_date,
      projectEndDate,
    });

    const dateError = validateCampaignDates({
      launchDate: launch_date,
      stopDate: stop_date,
      projectStartDate,
      projectEndDate,
      campaignStatus: campaign_status,
      mode: "edit",
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

    const budgetForLimit = campaign_status === "скасовано" ? 0 : budget;

    const budgetError = await validateProjectBudget({
      projectId: existingCampaign.project_id,
      campaignBudget: budgetForLimit,
      projectBudget: Number(existingCampaign.project.brief.budget),
      excludeCampaignId: campaignId,
    });

    if (budgetError) {
      return NextResponse.json(
        {
          ok: false,
          message: budgetError,
        },
        { status: 400 }
      );
    }

    const duplicateError = await validateActiveChannelDuplicate({
      projectId: existingCampaign.project_id,
      channel,
      excludeCampaignId: campaignId,
      nextStatus: campaign_status,
    });

    if (duplicateError) {
      return NextResponse.json(
        {
          ok: false,
          message: duplicateError,
        },
        { status: 400 }
      );
    }

    const campaign = await prisma.campaign.update({
      where: {
        campaign_id: campaignId,
      },
      data: {
        channel,
        launch_date: toDbDate(launch_date),
        stop_date: stop_date ? toDbDate(stop_date) : null,
        budget,
        campaign_status,
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
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Кампанію успішно оновлено.",
      data: normalizeCampaign(campaign),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Кампанію не знайдено." },
        { status: 404 }
      );
    }

    if (code === "P2003") {
      return NextResponse.json(
        {
          ok: false,
          message: "Неможливо оновити кампанію: повʼязаний проєкт не існує.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час оновлення кампанії. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const campaignId = parseCampaignId(id);

    if (!campaignId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID кампанії." },
        { status: 400 }
      );
    }

    const existingCampaign = await findCampaignById(campaignId);

    if (!existingCampaign) {
      return NextResponse.json(
        { ok: false, message: "Кампанію не знайдено." },
        { status: 404 }
      );
    }

    if (existingCampaign.campaign_status === "скасовано") {
      return NextResponse.json({
        ok: true,
        message: "Кампанія вже має статус «скасовано».",
        data: normalizeCampaign(existingCampaign),
      });
    }

    if (["завершено", "зупинено"].includes(existingCampaign.campaign_status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Завершену або зупинену кампанію не можна скасувати заднім числом.",
        },
        { status: 400 }
      );
    }

    if (isFinalProjectStatus(existingCampaign.project.status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна скасувати кампанію, якщо її проєкт вже у фінальному статусі.",
        },
        { status: 400 }
      );
    }

    const launchDate = formatDate(existingCampaign.launch_date);
    const projectEndDate = existingCampaign.project.end_date
      ? formatDate(existingCampaign.project.end_date)
      : null;

    const stopDate = getAutoStopDate({
      nextStatus: "скасовано",
      currentStopDate: existingCampaign.stop_date
        ? formatDate(existingCampaign.stop_date)
        : null,
      launchDate,
      projectEndDate,
    });

    const campaign = await prisma.campaign.update({
      where: {
        campaign_id: campaignId,
      },
      data: {
        campaign_status: "скасовано",
        stop_date: toDbDate(stopDate || launchDate),
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
      },
    });

    return NextResponse.json({
      ok: true,
      message:
        "Кампанію не видалено фізично, а переведено у статус «скасовано».",
      data: normalizeCampaign(campaign),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Кампанію не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час зміни статусу кампанії.",
      },
      { status: 500 }
    );
  }
}