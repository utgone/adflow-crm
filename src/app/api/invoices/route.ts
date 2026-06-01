import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type InvoiceCreateBody = {
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
const FINAL_PROJECT_STATUSES = ["скасовано"] as const;

const MAX_INVOICE_AMOUNT = 10_000_000;
const MAX_INVOICE_TERM_DAYS = 365;

async function findInvoices() {
  return prisma.invoice.findMany({
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
    orderBy: {
      invoice_id: "asc",
    },
  });
}

type InvoiceWithRelations = Awaited<ReturnType<typeof findInvoices>>[number];

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

function isFinalProjectStatus(value: string) {
  return FINAL_PROJECT_STATUSES.includes(
    value as (typeof FINAL_PROJECT_STATUSES)[number]
  );
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
  mode: "create" | "edit";
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

  if (params.mode === "create" && params.dueDate < today) {
    return "Новий рахунок не можна створити вже простроченим. Вкажіть майбутню дату оплати.";
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

export async function GET() {
  try {
    const invoices = await findInvoices();

    return NextResponse.json({
      ok: true,
      data: invoices.map(normalizeInvoice),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити рахунки з бази даних.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as InvoiceCreateBody;

    const project_id = Number(body.project_id);
    const providedClientId =
      body.client_id === undefined || body.client_id === null
        ? null
        : Number(body.client_id);

    const total_amount = roundMoney(parseMoney(body.total_amount));
    const issue_date =
      normalizeSpaces(optionalString(body.issue_date)) || getTodayISO();
    const due_date = normalizeSpaces(optionalString(body.due_date));
    const requestedStatus =
      normalizeSpaces(optionalString(body.invoice_status)) || "виставлено";

    if (!Number.isInteger(project_id) || project_id <= 0) {
      return NextResponse.json(
        { ok: false, message: "Оберіть коректний проєкт для рахунку." },
        { status: 400 }
      );
    }

    if (providedClientId !== null && (!Number.isInteger(providedClientId) || providedClientId <= 0)) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID клієнта." },
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

    if (requestedStatus !== "виставлено") {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Новий рахунок створюється тільки зі статусом «виставлено». Оплата буде фіксуватися окремо через модуль платежів.",
        },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: {
        project_id,
      },
      include: {
        brief: {
          include: {
            client: true,
          },
        },
      },
    });

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
          message: "Не можна створити рахунок для скасованого проєкту.",
        },
        { status: 400 }
      );
    }

    const projectClientId = Number(project.brief.client_id);

    if (providedClientId !== null && providedClientId !== projectClientId) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Клієнт рахунку не збігається з клієнтом проєкту. Рахунок має належати клієнту, який створив бриф проєкту.",
        },
        { status: 400 }
      );
    }

    const dateError = validateInvoiceDates({
      issueDate: issue_date,
      dueDate: due_date,
      invoiceStatus: "виставлено",
      mode: "create",
    });

    if (dateError) {
      return NextResponse.json(
        { ok: false, message: dateError },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.create({
      data: {
        client_id: projectClientId,
        project_id,
        total_amount,
        issue_date: toDbDate(issue_date),
        due_date: toDbDate(due_date),
        invoice_status: "виставлено",
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

    return NextResponse.json(
      {
        ok: true,
        message: "Рахунок успішно створено зі статусом «виставлено».",
        data: normalizeInvoice(invoice),
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
            "Неможливо створити рахунок: повʼязаний клієнт або проєкт не існує.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час створення рахунку. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}