import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [
    clients,
    employees,
    projects,
    campaigns,
    invoices,
    payments,
    statistics,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.employee.count(),
    prisma.project.count(),
    prisma.campaign.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.statistic.count(),
  ]);

  return NextResponse.json({
    ok: true,
    message: "База даних підключена успішно",
    data: {
      clients,
      employees,
      projects,
      campaigns,
      invoices,
      payments,
      statistics,
    },
  });
}