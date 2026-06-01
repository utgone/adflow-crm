import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type PaymentUpdateBody = {
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

async function findPaymentById(paymentId: number) {
  return prisma.payment.findUnique({
    where: {
      payment_id: paymentId,
    },
    include: paymentInclude,
  });
}

type PaymentWithRelations = NonNullable<Awaited<ReturnType<typeof findPaymentById>>>;

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

function parsePaymentId(value: string) {
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

async function validateInvoicePaymentLimit(params: {
  invoiceId: number;
  invoiceTotal: number;
  amountPaid: number;
  excludePaymentId: number;
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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const paymentId = parsePaymentId(id);

    if (!paymentId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID платежу." },
        { status: 400 }
      );
    }

    const payment = await findPaymentById(paymentId);

    if (!payment) {
      return NextResponse.json(
        { ok: false, message: "Платіж не знайдено." },
        { status: 404 }
      );
    }

    const paidTotal = await getInvoicePaidTotal(payment.invoice_id);

    return NextResponse.json({
      ok: true,
      data: normalizePayment(payment, paidTotal),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити платіж.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const paymentId = parsePaymentId(id);

    if (!paymentId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID платежу." },
        { status: 400 }
      );
    }

    const existingPayment = await findPaymentById(paymentId);

    if (!existingPayment) {
      return NextResponse.json(
        { ok: false, message: "Платіж не знайдено." },
        { status: 404 }
      );
    }

    if (existingPayment.invoice.invoice_status === "скасовано") {
      return NextResponse.json(
        {
          ok: false,
          message: "Не можна редагувати платіж скасованого рахунку.",
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as PaymentUpdateBody;

    if (
      body.invoice_id !== undefined &&
      Number(body.invoice_id) !== existingPayment.invoice_id
    ) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Не можна змінити invoice_id існуючого платежу. Звʼязок invoice → payment має залишатися незмінним.",
        },
        { status: 400 }
      );
    }

    const amount_paid =
      body.amount_paid === undefined
        ? Number(existingPayment.amount_paid)
        : roundMoney(parseMoney(body.amount_paid));

    const payment_date =
      body.payment_date === undefined
        ? formatDate(existingPayment.payment_date)
        : normalizeSpaces(optionalString(body.payment_date));

    const payment_method =
      body.payment_method === undefined
        ? existingPayment.payment_method
        : normalizePaymentMethod(optionalString(body.payment_method));

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

    if (!isInvoiceStatus(existingPayment.invoice.invoice_status)) {
      return NextResponse.json(
        {
          ok: false,
          message: "Рахунок має некоректний статус у базі даних.",
        },
        { status: 400 }
      );
    }

    const dateError = validatePaymentDate({
      paymentDate: payment_date,
      invoiceIssueDate: formatDate(existingPayment.invoice.issue_date),
    });

    if (dateError) {
      return NextResponse.json(
        { ok: false, message: dateError },
        { status: 400 }
      );
    }

    const limitError = await validateInvoicePaymentLimit({
      invoiceId: existingPayment.invoice_id,
      invoiceTotal: Number(existingPayment.invoice.total_amount),
      amountPaid: amount_paid,
      excludePaymentId: paymentId,
    });

    if (limitError) {
      return NextResponse.json(
        { ok: false, message: limitError },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: {
          payment_id: paymentId,
        },
        data: {
          amount_paid,
          payment_date: toDbDate(payment_date),
          payment_method,
        },
      });

      const aggregate = await tx.payment.aggregate({
        where: {
          invoice_id: existingPayment.invoice_id,
        },
        _sum: {
          amount_paid: true,
        },
      });

      const paidTotal = Number(aggregate._sum.amount_paid ?? 0);

      const nextInvoiceStatus = calculateInvoiceStatus({
        invoiceTotal: Number(existingPayment.invoice.total_amount),
        paidTotal,
        dueDate: formatDate(existingPayment.invoice.due_date),
        currentStatus: existingPayment.invoice.invoice_status,
      });

      await tx.invoice.update({
        where: {
          invoice_id: existingPayment.invoice_id,
        },
        data: {
          invoice_status: nextInvoiceStatus,
        },
      });

      const fullPayment = await tx.payment.findUnique({
        where: {
          payment_id: paymentId,
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
        { ok: false, message: "Платіж оновлено, але не вдалося його прочитати." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Платіж успішно оновлено. Статус рахунку перераховано.",
      data: normalizePayment(result.payment, result.paidTotal),
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Платіж не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message:
          "Помилка сервера під час оновлення платежу. Перевірте правильність даних.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const paymentId = parsePaymentId(id);

    if (!paymentId) {
      return NextResponse.json(
        { ok: false, message: "Некоректний ID платежу." },
        { status: 400 }
      );
    }

    const existingPayment = await findPaymentById(paymentId);

    if (!existingPayment) {
      return NextResponse.json(
        { ok: false, message: "Платіж не знайдено." },
        { status: 404 }
      );
    }

    if (existingPayment.invoice.invoice_status === "скасовано") {
      return NextResponse.json(
        {
          ok: false,
          message: "Не можна видаляти платіж скасованого рахунку.",
        },
        { status: 400 }
      );
    }

    const invoiceId = existingPayment.invoice_id;
    const invoiceTotal = Number(existingPayment.invoice.total_amount);
    const invoiceDueDate = formatDate(existingPayment.invoice.due_date);
    const currentInvoiceStatus = existingPayment.invoice.invoice_status;

    const result = await prisma.$transaction(async (tx) => {
      await tx.payment.delete({
        where: {
          payment_id: paymentId,
        },
      });

      const aggregate = await tx.payment.aggregate({
        where: {
          invoice_id: invoiceId,
        },
        _sum: {
          amount_paid: true,
        },
      });

      const paidTotal = Number(aggregate._sum.amount_paid ?? 0);

      const nextInvoiceStatus = calculateInvoiceStatus({
        invoiceTotal,
        paidTotal,
        dueDate: invoiceDueDate,
        currentStatus: currentInvoiceStatus,
      });

      await tx.invoice.update({
        where: {
          invoice_id: invoiceId,
        },
        data: {
          invoice_status: nextInvoiceStatus,
        },
      });

      return {
        paidTotal,
        nextInvoiceStatus,
      };
    });

    return NextResponse.json({
      ok: true,
      message: "Платіж видалено. Статус рахунку перераховано.",
      data: {
        payment_id: paymentId,
        invoice_id: invoiceId,
        paid_total: result.paidTotal,
        invoice_status: result.nextInvoiceStatus,
      },
    });
  } catch (error) {
    console.error(error);

    const code = getErrorCode(error);

    if (code === "P2025") {
      return NextResponse.json(
        { ok: false, message: "Платіж не знайдено." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час видалення платежу.",
      },
      { status: 500 }
    );
  }
}