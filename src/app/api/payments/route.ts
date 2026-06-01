import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PaymentCreateBody = {
  invoice_id?: unknown;
  amount_paid?: unknown;
  payment_date?: unknown;
  payment_method?: unknown;
};

const PAYMENT_METHODS = ["готівка", "картка", "банківський переказ"] as const;

const INVOICE_STATUSES = [
  "виставлено",
  "частково оплачено",
  "оплачено",
  "прострочено",
  "скасовано",
] as const;

const MAX_PAYMENT_AMOUNT = 10_000_000;

const paymentInclude = {
  invoice: {
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
  },
} as const;

async function findPayments() {
  return prisma.payment.findMany({
    include: paymentInclude,
    orderBy: [
      {
        payment_date: "desc",
      },
      {
        payment_id: "desc",
      },
    ],
  });
}

type PaymentWithRelations = Awaited<ReturnType<typeof findPayments>>[number];

function normalizePayment(payment: PaymentWithRelations, invoicePaidTotal: number) {
  const invoice = payment.invoice;
  const project = invoice.project;
  const brief = project.brief;
  const client = invoice.client;

  const invoiceTotal = Number(invoice.total_amount);
  const amountPaid = Number(payment.amount_paid);
  const paidTotal = roundMoney(invoicePaidTotal);
  const balance = Math.max(0, roundMoney(invoiceTotal - paidTotal));

  const issueDate = formatDate(invoice.issue_date);
  const dueDate = formatDate(invoice.due_date);
  const paymentDate = formatDate(payment.payment_date);

  const calculatedInvoiceStatus = calculateInvoiceStatus({
    invoiceTotal,
    paidTotal,
    dueDate,
    currentStatus: invoice.invoice_status,
  });

  return {
    payment_id: payment.payment_id,

    invoice_id: payment.invoice_id,
    invoice_status: invoice.invoice_status,
    invoice_effective_status: calculatedInvoiceStatus,
    invoice_total_amount: invoiceTotal,
    invoice_issue_date: issueDate,
    invoice_due_date: dueDate,

    paid_total: paidTotal,
    balance_amount: balance,
    payment_progress_percent:
      invoiceTotal > 0 ? Math.min(100, (paidTotal / invoiceTotal) * 100) : 0,

    amount_paid: amountPaid,
    payment_date: paymentDate,
    payment_method: payment.payment_method,

    client_id: invoice.client_id,
    client_name: client.full_name,
    client_company: client.company_name ?? "Без компанії",
    client_status: client.status,
    client_email: client.email,
    client_phone: client.phone,

    project_id: invoice.project_id,
    project_name: project.project_name,
    project_status: project.status,

    brief_id: brief.brief_id,
    brief_budget: Number(brief.budget),

    can_edit: invoice.invoice_status !== "скасовано",
    can_delete: invoice.invoice_status !== "скасовано",
    can_create_more_payments:
      invoice.invoice_status !== "скасовано" &&
      calculatedInvoiceStatus !== "оплачено" &&
      balance > 0,
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

function normalizePaymentMethod(value: string) {
  const raw = normalizeSpaces(value).toLowerCase();

  const aliases: Record<string, (typeof PAYMENT_METHODS)[number]> = {
    готівка: "готівка",
    готiвка: "готівка",
    наличные: "готівка",
    cash: "готівка",

    картка: "картка",
    карта: "картка",
    card: "картка",
    "банківська картка": "картка",

    "банківський переказ": "банківський переказ",
    "банковский перевод": "банківський переказ",
    переказ: "банківський переказ",
    перевод: "банківський переказ",
    transfer: "банківський переказ",
    bank: "банківський переказ",
  };

  return aliases[raw] || "";
}

function isPaymentMethod(value: string) {
  return PAYMENT_METHODS.includes(value as (typeof PAYMENT_METHODS)[number]);
}

function isInvoiceStatus(value: string) {
  return INVOICE_STATUSES.includes(value as (typeof INVOICE_STATUSES)[number]);
}

function calculateInvoiceStatus(params: {
  invoiceTotal: number;
  paidTotal: number;
  dueDate: string;
  currentStatus: string;
}) {
  if (params.currentStatus === "скасовано") {
    return "скасовано";
  }

  if (params.paidTotal >= params.invoiceTotal - 0.009) {
    return "оплачено";
  }

  if (params.paidTotal > 0) {
    return "частково оплачено";
  }

  if (params.dueDate < getTodayISO()) {
    return "прострочено";
  }

  return "виставлено";
}

function validatePaymentAmount(amountPaid: number) {
  if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
    return "Сума платежу має бути більшою за 0.";
  }

  if (amountPaid > MAX_PAYMENT_AMOUNT) {
    return "Сума платежу виглядає нереалістично великою.";
  }

  return "";
}

function validatePaymentDate(params: {
  paymentDate: string;
  invoiceIssueDate: string;
}) {
  const today = getTodayISO();

  if (!isRealISODate(params.paymentDate)) {
    return "Вкажіть коректну дату платежу.";
  }

  if (params.paymentDate > today) {
    return "Дата платежу не може бути в майбутньому.";
  }

  if (params.paymentDate < params.invoiceIssueDate) {
    return "Дата платежу не може бути раніше дати виставлення рахунку.";
  }

  return "";
}

async function getInvoicePaidTotal(invoiceId: number, excludePaymentId?: number) {
  const aggregate = await prisma.payment.aggregate({
    where: {
      invoice_id: invoiceId,
      ...(excludePaymentId
        ? {
            payment_id: {
              not: excludePaymentId,
            },
          }
        : {}),
    },
    _sum: {
      amount_paid: true,
    },
  });

  return Number(aggregate._sum.amount_paid ?? 0);
}

async function getInvoicePaidMap(invoiceIds: number[]) {
  const uniqueIds = Array.from(new Set(invoiceIds));

  if (uniqueIds.length === 0) {
    return new Map<number, number>();
  }

  const rows = await prisma.payment.groupBy({
    by: ["invoice_id"],
    where: {
      invoice_id: {
        in: uniqueIds,
      },
    },
    _sum: {
      amount_paid: true,
    },
  });

  return new Map(
    rows.map((row) => [row.invoice_id, Number(row._sum.amount_paid ?? 0)])
  );
}

async function validateInvoicePaymentLimit(params: {
  invoiceId: number;
  invoiceTotal: number;
  amountPaid: number;
  excludePaymentId?: number;
}) {
  const alreadyPaid = await getInvoicePaidTotal(
    params.invoiceId,
    params.excludePaymentId
  );

  const totalAfterPayment = roundMoney(alreadyPaid + params.amountPaid);

  if (totalAfterPayment > params.invoiceTotal + 0.009) {
    return `Сума платежів буде ${formatMoney(
      totalAfterPayment
    )} грн, але сума рахунку становить ${formatMoney(
      params.invoiceTotal
    )} грн. Максимально можна внести ${formatMoney(
      Math.max(0, params.invoiceTotal - alreadyPaid)
    )} грн.`;
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
    const payments = await findPayments();
    const paidMap = await getInvoicePaidMap(
      payments.map((payment) => payment.invoice_id)
    );

    return NextResponse.json({
      ok: true,
      data: payments.map((payment) =>
        normalizePayment(payment, paidMap.get(payment.invoice_id) ?? 0)
      ),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити платежі з бази даних.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PaymentCreateBody;

    const invoice_id = Number(body.invoice_id);
    const amount_paid = roundMoney(parseMoney(body.amount_paid));
    const payment_date =
      normalizeSpaces(optionalString(body.payment_date)) || getTodayISO();
    const payment_method = normalizePaymentMethod(optionalString(body.payment_method));

    if (!Number.isInteger(invoice_id) || invoice_id <= 0) {
      return NextResponse.json(
        { ok: false, message: "Оберіть коректний рахунок для платежу." },
        { status: 400 }
      );
    }

    const amountError = validatePaymentAmount(amount_paid);

    if (amountError) {
      return NextResponse.json(
        { ok: false, message: amountError },
        { status: 400 }
      );
    }

    if (!payment_method || !isPaymentMethod(payment_method)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Метод оплати може бути тільки: готівка, картка або банківський переказ.",
        },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: {
        invoice_id,
      },
      include: {
        client: true,
        project: {
          include: {
            brief: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { ok: false, message: "Рахунок не знайдено в базі даних." },
        { status: 404 }
      );
    }

    if (!isInvoiceStatus(invoice.invoice_status)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Рахунок має некоректний статус у базі даних.",
        },
        { status: 400 }
      );
    }

    if (invoice.invoice_status === "скасовано") {
      return NextResponse.json(
        { ok: false, message: "Не можна оплатити скасований рахунок." },
        { status: 400 }
      );
    }

    if (invoice.invoice_status === "оплачено") {
      return NextResponse.json(
        { ok: false, message: "Рахунок вже повністю оплачено." },
        { status: 400 }
      );
    }

    const dateError = validatePaymentDate({
      paymentDate: payment_date,
      invoiceIssueDate: formatDate(invoice.issue_date),
    });

    if (dateError) {
      return NextResponse.json(
        { ok: false, message: dateError },
        { status: 400 }
      );
    }

    const limitError = await validateInvoicePaymentLimit({
      invoiceId: invoice_id,
      invoiceTotal: Number(invoice.total_amount),
      amountPaid: amount_paid,
    });

    if (limitError) {
      return NextResponse.json(
        { ok: false, message: limitError },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
        data: {
          invoice_id,
          amount_paid,
          payment_date: toDbDate(payment_date),
          payment_method,
        },
      });

      const aggregate = await tx.payment.aggregate({
        where: {
          invoice_id,
        },
        _sum: {
          amount_paid: true,
        },
      });

      const paidTotal = Number(aggregate._sum.amount_paid ?? 0);

      const nextInvoiceStatus = calculateInvoiceStatus({
        invoiceTotal: Number(invoice.total_amount),
        paidTotal,
        dueDate: formatDate(invoice.due_date),
        currentStatus: invoice.invoice_status,
      });

      await tx.invoice.update({
        where: {
          invoice_id,
        },
        data: {
          invoice_status: nextInvoiceStatus,
        },
      });

      const fullPayment = await tx.payment.findUnique({
        where: {
          payment_id: createdPayment.payment_id,
        },
        include: paymentInclude,
      });

      return {
        payment: fullPayment,
        paidTotal,
      };
    });

    if (!result.payment) {
      return NextResponse.json(
        { ok: false, message: "Платіж створено, але не вдалося його прочитати." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Платіж успішно додано. Статус рахунку перераховано.",
        data: normalizePayment(result.payment, result.paidTotal),
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
          message: "Неможливо створити платіж: повʼязаний рахунок не існує.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час створення платежу. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}