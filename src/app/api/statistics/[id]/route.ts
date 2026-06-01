import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type StatisticUpdateBody = {
  campaign_id?: unknown;
  record_date?: unknown;
  impressions?: unknown;
  clicks?: unknown;
  spent_amount?: unknown;
};

const BLOCKED_CAMPAIGN_STATUSES = ["заплановано", "скасовано"] as const;
const FINAL_CAMPAIGN_STATUSES = ["завершено", "зупинено", "скасовано"] as const;

const MAX_IMPRESSIONS = 1_000_000_000;
const MAX_SPENT_AMOUNT = 10_000_000;
const MAX_CAMPAIGN_DURATION_DAYS = 370;

async function findStatisticById(statisticId: number) {
  return prisma.statistic.findUnique({
    where: {
      statistic_id: statisticId,
    },
    include: {
      campaign: {
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
      },
    },
  });
}

type StatisticWithRelations = NonNullable<
  Awaited<ReturnType<typeof findStatisticById>>
>;

function normalizeStatistic(
  statistic: StatisticWithRelations,
  campaignSpentTotal: number
) {
  const campaign = statistic.campaign;
  const project = campaign.project;
  const brief = project.brief;
  const client = brief.client;

  const impressions = statistic.impressions;
  const clicks = statistic.clicks;
  const spentAmount = Number(statistic.spent_amount);
  const campaignBudget = Number(campaign.budget);

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spentAmount / clicks : 0;
  const cpm = impressions > 0 ? (spentAmount / impressions) * 1000 : 0;

  const campaignStatus = campaign.campaign_status;
  const canEdit = campaignStatus !== "скасовано";
  const canDelete = !FINAL_CAMPAIGN_STATUSES.includes(
    campaignStatus as (typeof FINAL_CAMPAIGN_STATUSES)[number]
  );

  return {
    statistic_id: statistic.statistic_id,

    campaign_id: statistic.campaign_id,
    channel: campaign.channel,
    campaign_status: campaignStatus,
    campaign_budget: campaignBudget,
    campaign_launch_date: formatDate(campaign.launch_date),
    campaign_stop_date: campaign.stop_date ? formatDate(campaign.stop_date) : null,

    project_id: project.project_id,
    project_name: project.project_name,
    project_status: project.status,

    brief_id: brief.brief_id,
    brief_budget: Number(brief.budget),

    client_id: client.client_id,
    client_name: client.full_name,
    client_company: client.company_name ?? "Без компанії",
    client_status: client.status,

    record_date: formatDate(statistic.record_date),
    impressions,
    clicks,
    spent_amount: spentAmount,

    ctr,
    cpc,
    cpm,

    campaign_spent_total: campaignSpentTotal,
    campaign_budget_remaining: Math.max(0, campaignBudget - campaignSpentTotal),
    campaign_budget_used_percent:
      campaignBudget > 0 ? (campaignSpentTotal / campaignBudget) * 100 : 0,

    can_edit: canEdit,
    can_delete: canDelete,
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

function parseStatisticId(value: string) {
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

function parseInteger(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  const raw = optionalString(value).trim();

  if (!/^\d+$/.test(raw)) {
    return Number.NaN;
  }

  return Number(raw);
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

function validateMetricNumbers(params: {
  impressions: number;
  clicks: number;
  spentAmount: number;
}) {
  if (!Number.isInteger(params.impressions) || params.impressions < 0) {
    return "Кількість показів має бути цілим числом від 0.";
  }

  if (params.impressions > MAX_IMPRESSIONS) {
    return "Кількість показів виглядає нереалістично великою.";
  }

  if (!Number.isInteger(params.clicks) || params.clicks < 0) {
    return "Кількість кліків має бути цілим числом від 0.";
  }

  if (params.clicks > params.impressions) {
    return "Кількість кліків не може бути більшою за кількість показів.";
  }

  if (!Number.isFinite(params.spentAmount) || params.spentAmount < 0) {
    return "Сума витрат має бути числом від 0.";
  }

  if (params.spentAmount > MAX_SPENT_AMOUNT) {
    return "Сума витрат виглядає нереалістично великою.";
  }

  if (
    params.impressions === 0 &&
    params.clicks === 0 &&
    params.spentAmount === 0
  ) {
    return "Запис статистики не може бути повністю нульовим.";
  }

  return "";
}

function validateStatisticDate(params: {
  recordDate: string;
  campaignLaunchDate: string;
  campaignStopDate: string | null;
  campaignStatus: string;
}) {
  const today = getTodayISO();

  if (!isRealISODate(params.recordDate)) {
    return "Вкажіть коректну дату статистики.";
  }

  if (BLOCKED_CAMPAIGN_STATUSES.includes(
    params.campaignStatus as (typeof BLOCKED_CAMPAIGN_STATUSES)[number]
  )) {
    return "Не можна змінювати статистику запланованої або скасованої кампанії.";
  }

  if (params.recordDate > today) {
    return "Дата статистики не може бути в майбутньому.";
  }

  if (params.recordDate < params.campaignLaunchDate) {
    return "Дата статистики не може бути раніше дати запуску кампанії.";
  }

  if (
    ["завершено", "зупинено"].includes(params.campaignStatus) &&
    !params.campaignStopDate
  ) {
    return "Фінальна кампанія має некоректні дані: відсутня дата зупинки.";
  }

  const hardMaxDate = params.campaignStopDate
    ? minISODate(
        params.campaignStopDate,
        addDaysISO(params.campaignLaunchDate, MAX_CAMPAIGN_DURATION_DAYS)
      )
    : addDaysISO(params.campaignLaunchDate, MAX_CAMPAIGN_DURATION_DAYS);

  if (params.recordDate > hardMaxDate) {
    return `Дата статистики виходить за дозволений період кампанії. Максимальна дата: ${hardMaxDate}.`;
  }

  return "";
}

async function getStatisticSpentUsed(campaignId: number, excludeStatisticId?: number) {
  const where = excludeStatisticId
    ? {
        campaign_id: campaignId,
        statistic_id: {
          not: excludeStatisticId,
        },
      }
    : {
        campaign_id: campaignId,
      };

  const aggregate = await prisma.statistic.aggregate({
    where,
    _sum: {
      spent_amount: true,
    },
  });

  return Number(aggregate._sum.spent_amount ?? 0);
}

async function validateCampaignBudget(params: {
  campaignId: number;
  campaignBudget: number;
  spentAmount: number;
  excludeStatisticId?: number;
}) {
  const used = await getStatisticSpentUsed(
    params.campaignId,
    params.excludeStatisticId
  );

  const total = roundMoney(used + params.spentAmount);

  if (total > params.campaignBudget) {
    return `Сумарні витрати за кампанією будуть ${formatMoney(
      total
    )} грн, але бюджет кампанії становить ${formatMoney(
      params.campaignBudget
    )} грн.`;
  }

  return "";
}

async function validateUniqueDate(params: {
  campaignId: number;
  recordDate: string;
  excludeStatisticId: number;
}) {
  const duplicate = await prisma.statistic.findFirst({
    where: {
      campaign_id: params.campaignId,
      record_date: toDbDate(params.recordDate),
      statistic_id: {
        not: params.excludeStatisticId,
      },
    },
    select: {
      statistic_id: true,
    },
  });

  if (!duplicate) {
    return "";
  }

  return `Статистика для цієї кампанії за дату ${params.recordDate} вже існує.`;
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
    const statisticId = parseStatisticId(id);

    if (!statisticId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID статистики." },
        { status: 400 }
      );
    }

    const statistic = await findStatisticById(statisticId);

    if (!statistic) {
      return NextResponse.json(
        { ok: false, message: "Статистику не знайдено." },
        { status: 404 }
      );
    }

    const spentTotal = await getStatisticSpentUsed(statistic.campaign_id);

    return NextResponse.json({
      ok: true,
      data: normalizeStatistic(statistic, spentTotal),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити запис статистики.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const statisticId = parseStatisticId(id);

    if (!statisticId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID статистики." },
        { status: 400 }
      );
    }

    const existingStatistic = await findStatisticById(statisticId);

    if (!existingStatistic) {
      return NextResponse.json(
        { ok: false, message: "Статистику не знайдено." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as StatisticUpdateBody;

    if (
      body.campaign_id !== undefined &&
      Number(body.campaign_id) !== existingStatistic.campaign_id
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна змінити campaign_id існуючої статистики. Звʼязок campaign → statistic має залишатися незмінним.",
        },
        { status: 400 }
      );
    }

    const record_date =
      body.record_date === undefined
        ? formatDate(existingStatistic.record_date)
        : normalizeSpaces(optionalString(body.record_date));

    const impressions =
      body.impressions === undefined
        ? existingStatistic.impressions
        : parseInteger(body.impressions);

    const clicks =
      body.clicks === undefined ? existingStatistic.clicks : parseInteger(body.clicks);

    const spent_amount =
      body.spent_amount === undefined
        ? Number(existingStatistic.spent_amount)
        : roundMoney(parseMoney(body.spent_amount));

    const metricError = validateMetricNumbers({
      impressions,
      clicks,
      spentAmount: spent_amount,
    });

    if (metricError) {
      return NextResponse.json(
        {
          ok: false,
          message: metricError,
        },
        { status: 400 }
      );
    }

    const dateError = validateStatisticDate({
      recordDate: record_date,
      campaignLaunchDate: formatDate(existingStatistic.campaign.launch_date),
      campaignStopDate: existingStatistic.campaign.stop_date
        ? formatDate(existingStatistic.campaign.stop_date)
        : null,
      campaignStatus: existingStatistic.campaign.campaign_status,
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

    const uniqueError = await validateUniqueDate({
      campaignId: existingStatistic.campaign_id,
      recordDate: record_date,
      excludeStatisticId: statisticId,
    });

    if (uniqueError) {
      return NextResponse.json(
        {
          ok: false,
          message: uniqueError,
        },
        { status: 409 }
      );
    }

    const budgetError = await validateCampaignBudget({
      campaignId: existingStatistic.campaign_id,
      campaignBudget: Number(existingStatistic.campaign.budget),
      spentAmount: spent_amount,
      excludeStatisticId: statisticId,
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

    const statistic = await prisma.statistic.update({
      where: {
        statistic_id: statisticId,
      },
      data: {
        record_date: toDbDate(record_date),
        impressions,
        clicks,
        spent_amount,
      },
      include: {
        campaign: {
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
        },
      },
    });

    const spentTotal = await getStatisticSpentUsed(statistic.campaign_id);

    return NextResponse.json({
      ok: true,
      message: "Статистику успішно оновлено.",
      data: normalizeStatistic(statistic, spentTotal),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2002") {
      return NextResponse.json(
        {
          ok: false,
          message: "Статистика за цю дату для кампанії вже існує.",
        },
        { status: 409 }
      );
    }

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Статистику не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час оновлення статистики. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const statisticId = parseStatisticId(id);

    if (!statisticId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID статистики." },
        { status: 400 }
      );
    }

    const existingStatistic = await findStatisticById(statisticId);

    if (!existingStatistic) {
      return NextResponse.json(
        { ok: false, message: "Статистику не знайдено." },
        { status: 404 }
      );
    }

    if (FINAL_CAMPAIGN_STATUSES.includes(
      existingStatistic.campaign.campaign_status as (typeof FINAL_CAMPAIGN_STATUSES)[number]
    )) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Статистику фінальної кампанії не можна видалити, щоб не порушити історію аналітики.",
        },
        { status: 400 }
      );
    }

    await prisma.statistic.delete({
      where: {
        statistic_id: statisticId,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Запис статистики видалено з бази даних.",
      data: {
        statistic_id: statisticId,
      },
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Статистику не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час видалення статистики.",
      },
      { status: 500 }
    );
  }
}