import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const services = await prisma.service.findMany({
      orderBy: {
        service_id: "asc",
      },
    });

    return NextResponse.json({
      ok: true,
      data: services.map((service) => ({
        service_id: service.service_id,
        service_name: service.service_name,
      })),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити послуги з бази даних.",
      },
      { status: 500 }
    );
  }
}