import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type InvoiceUpdateBody = {
  project_id?: unknown;
  client_id?: unknown;
  total_amount?: unknown;
  issue_date?: unknown;
  due_date?: unknown;
  invoice_status?: unknown;
};

const INVOICE_STATUSES = [
  "виставлено",
  "частково оплачено",
  "оплачено",
  "прострочено",
  "скасовано",
] as const;

const PAYMENT_CONTROLLED_STATUSES = ["частково оплачено", "оплачено"] as const;
const LOCKED_INVOICE_STATUSES = ["оплачено", "скасовано"] as const;

const MAX_INVOICE_AMOUNT = 10_000_000;
const MAX_INVOICE_TERM_DAYS = 365;

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  виставлено: ["виставлено", "прострочено", "скасовано"],
  прострочено: ["прострочено", "виставлено", "скасовано"],
  "частково оплачено": ["частково оплачено"],
  оплачено: ["оплачено"],
  скасовано: ["скасовано"],
};

async function findInvoiceById(invoiceId: number) {
  return prisma.invoice.findUnique({
    where: {
      invoice_id: invoiceId,
    },
    include: {
      client: {
        select: {
          client_id: true,
          full_name: true,
          company_name: true,
          status: true,
          email: true,
          phone: true,
        },
      },
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

type InvoiceWithRelations = NonNullable<Awaited<ReturnType<typeof findInvoiceById>>>;

function normalizeInvoice(invoice: InvoiceWithRelations) {
  const totalAmount = Number(invoice.total_amount);
  const issueDate = formatDate(invoice.issue_date);
  const dueDate = formatDate(invoice.due_date);
  const today = getTodayISO();

  const isOverdue =
    invoice.invoice_status === "виставлено" && dueDate < today;

  const effectiveStatus = isOverdue ? "прострочено" : invoice.invoice_status;

  const project = invoice.project;
  const brief = project.brief;
  const invoiceClient = invoice.client;
  const projectClient = brief.client;

  const isLocked = LOCKED_INVOICE_STATUSES.includes(
    invoice.invoice_status as (typeof LOCKED_INVOICE_STATUSES)[number]
  );

  return {
    invoice_id: invoice.invoice_id,

    client_id: invoice.client_id,
    client_name: invoiceClient.full_name,
    client_company: invoiceClient.company_name ?? "Без компанії",
    client_status: invoiceClient.status,
    client_email: invoiceClient.email,
    client_phone: invoiceClient.phone,

    project_id: invoice.project_id,
    project_name: project.project_name,
    project_status: project.status,
    project_start_date: formatDate(project.start_date),
    project_end_date: project.end_date ? formatDate(project.end_date) : null,

    brief_id: brief.brief_id,
    brief_budget: Number(brief.budget),

    project_client_id: projectClient.client_id,
    project_client_name: projectClient.full_name,
    project_client_company: projectClient.company_name ?? "Без компанії",

    total_amount: totalAmount,
    issue_date: issueDate,
    due_date: dueDate,
    invoice_status: invoice.invoice_status,
    effective_status: effectiveStatus,

    is_overdue: isOverdue,
    days_to_due: getDaysBetween(today, dueDate),
    is_locked: isLocked,

    payment_summary_available: false,
    paid_amount: null,
    balance_amount: null,

    can_edit: !isLocked,
    can_cancel: !["оплачено", "частково оплачено", "скасовано"].includes(
      invoice.invoice_status
    ),
    can_mark_overdue:
      invoice.invoice_status === "виставлено" && dueDate < today,
    can_register_payment:
      !["оплачено", "скасовано"].includes(invoice.invoice_status),
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

function parseInvoiceId(value: string) {
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

function formatDate(value: Date) {
  return value.toISOString().split("T")[0];
}

function toDbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toUTC(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function getDaysBetween(from: string, to: string) {
  const day = 24 * 60 * 60 * 1000;
  return Math.ceil((toUTC(to) - toUTC(from)) / day);
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

function isInvoiceStatus(value: string) {
  return INVOICE_STATUSES.includes(value as (typeof INVOICE_STATUSES)[number]);
}

function isPaymentControlledStatus(value: string) {
  return PAYMENT_CONTROLLED_STATUSES.includes(
    value as (typeof PAYMENT_CONTROLLED_STATUSES)[number]
  );
}

function isLockedInvoiceStatus(value: string) {
  return LOCKED_INVOICE_STATUSES.includes(
    value as (typeof LOCKED_INVOICE_STATUSES)[number]
  );
}

function isAllowedTransition(from: string, to: string) {
  if (from === to) {
    return true;
  }

  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

function validateAmount(totalAmount: number) {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return "Сума рахунку має бути більшою за 0.";
  }

  if (totalAmount > MAX_INVOICE_AMOUNT) {
    return "Сума рахунку виглядає нереалістично великою.";
  }

  return "";
}

function validateInvoiceDates(params: {
  issueDate: string;
  dueDate: string;
  invoiceStatus: string;
}) {
  const today = getTodayISO();

  if (!isRealISODate(params.issueDate)) {
    return "Вкажіть коректну дату виставлення рахунку.";
  }

  if (!isRealISODate(params.dueDate)) {
    return "Вкажіть коректну дату оплати рахунку.";
  }

  if (params.issueDate > today) {
    return "Дата виставлення рахунку не може бути в майбутньому.";
  }

  if (params.dueDate < params.issueDate) {
    return "Дата оплати не може бути раніше дати виставлення рахунку.";
  }

  const maxDueDate = addDaysISO(params.issueDate, MAX_INVOICE_TERM_DAYS);

  if (params.dueDate > maxDueDate) {
    return `Дата оплати занадто далека. Максимальна дозволена дата: ${maxDueDate}.`;
  }

  if (params.invoiceStatus === "виставлено" && params.dueDate < today) {
    return "Рахунок зі статусом «виставлено» не може мати прострочену дату оплати. Змініть статус на «прострочено».";
  }

  if (params.invoiceStatus === "прострочено" && params.dueDate >= today) {
    return "Статус «прострочено» можна встановити тільки якщо дата оплати вже минула.";
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
    const invoiceId = parseInvoiceId(id);

    if (!invoiceId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID рахунку." },
        { status: 400 }
      );
    }

    const invoice = await findInvoiceById(invoiceId);

    if (!invoice) {
      return NextResponse.json(
        { ok: false, message: "Рахунок не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: normalizeInvoice(invoice),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити рахунок.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const invoiceId = parseInvoiceId(id);

    if (!invoiceId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID рахунку." },
        { status: 400 }
      );
    }

    const existingInvoice = await findInvoiceById(invoiceId);

    if (!existingInvoice) {
      return NextResponse.json(
        { ok: false, message: "Рахунок не знайдено." },
        { status: 404 }
      );
    }

    if (isLockedInvoiceStatus(existingInvoice.invoice_status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Оплачений або скасований рахунок заблокований від редагування, щоб не порушити фінансову історію CRM.",
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as InvoiceUpdateBody;

    if (
      body.project_id !== undefined &&
      Number(body.project_id) !== existingInvoice.project_id
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна змінити project_id існуючого рахунку. Звʼязок project → invoice має залишатися незмінним.",
        },
        { status: 400 }
      );
    }

    if (
      body.client_id !== undefined &&
      Number(body.client_id) !== existingInvoice.client_id
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна змінити client_id існуючого рахунку. Клієнт рахунку має залишатися незмінним.",
        },
        { status: 400 }
      );
    }

    const total_amount =
      body.total_amount === undefined
        ? Number(existingInvoice.total_amount)
        : roundMoney(parseMoney(body.total_amount));

    const issue_date =
      body.issue_date === undefined
        ? formatDate(existingInvoice.issue_date)
        : normalizeSpaces(optionalString(body.issue_date));

    const due_date =
      body.due_date === undefined
        ? formatDate(existingInvoice.due_date)
        : normalizeSpaces(optionalString(body.due_date));

    const invoice_status =
      body.invoice_status === undefined
        ? existingInvoice.invoice_status
        : normalizeSpaces(optionalString(body.invoice_status));

    const amountChanged = total_amount !== Number(existingInvoice.total_amount);

    if (
      existingInvoice.invoice_status === "частково оплачено" &&
      amountChanged
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна змінювати суму частково оплаченого рахунку. Спочатку потрібно обробити платежі.",
        },
        { status: 400 }
      );
    }

    const amountError = validateAmount(total_amount);

    if (amountError) {
      return NextResponse.json(
        { ok: false, message: amountError },
        { status: 400 }
      );
    }

    if (!isInvoiceStatus(invoice_status)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Статус рахунку може бути тільки: виставлено, частково оплачено, оплачено, прострочено або скасовано.",
        },
        { status: 400 }
      );
    }

    if (
      isPaymentControlledStatus(invoice_status) &&
      invoice_status !== existingInvoice.invoice_status
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Статуси «частково оплачено» та «оплачено» не можна встановлювати напряму в рахунку. Це має робити модуль платежів.",
        },
        { status: 400 }
      );
    }

    if (!isAllowedTransition(existingInvoice.invoice_status, invoice_status)) {
      return NextResponse.json(
        {
          ok: false,
          message: `Некоректний перехід статусу рахунку: «${existingInvoice.invoice_status}» → «${invoice_status}».`,
        },
        { status: 400 }
      );
    }

    const dateError = validateInvoiceDates({
      issueDate: issue_date,
      dueDate: due_date,
      invoiceStatus: invoice_status,
    });

    if (dateError) {
      return NextResponse.json(
        { ok: false, message: dateError },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.update({
      where: {
        invoice_id: invoiceId,
      },
      data: {
        total_amount,
        issue_date: toDbDate(issue_date),
        due_date: toDbDate(due_date),
        invoice_status,
      },
      include: {
        client: {
          select: {
            client_id: true,
            full_name: true,
            company_name: true,
            status: true,
            email: true,
            phone: true,
          },
        },
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
      message: "Рахунок успішно оновлено.",
      data: normalizeInvoice(invoice),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Рахунок не знайдено." },
        { status: 404 }
      );
    }

    if (code === "P2003") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Неможливо оновити рахунок: повʼязаний клієнт або проєкт не існує.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час оновлення рахунку. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const invoiceId = parseInvoiceId(id);

    if (!invoiceId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID рахунку." },
        { status: 400 }
      );
    }

    const existingInvoice = await findInvoiceById(invoiceId);

    if (!existingInvoice) {
      return NextResponse.json(
        { ok: false, message: "Рахунок не знайдено." },
        { status: 404 }
      );
    }

    if (existingInvoice.invoice_status === "скасовано") {
      return NextResponse.json({
        ok: true,
        message: "Рахунок вже має статус «скасовано».",
        data: normalizeInvoice(existingInvoice),
      });
    }

    if (
      ["частково оплачено", "оплачено"].includes(
        existingInvoice.invoice_status
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна скасувати оплачений або частково оплачений рахунок через invoice API. Спочатку потрібно обробити платежі.",
        },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.update({
      where: {
        invoice_id: invoiceId,
      },
      data: {
        invoice_status: "скасовано",
      },
      include: {
        client: {
          select: {
            client_id: true,
            full_name: true,
            company_name: true,
            status: true,
            email: true,
            phone: true,
          },
        },
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
        "Рахунок не видалено фізично, а переведено у статус «скасовано».",
      data: normalizeInvoice(invoice),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Рахунок не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час зміни статусу рахунку.",
      },
      { status: 500 }
    );
  }
}