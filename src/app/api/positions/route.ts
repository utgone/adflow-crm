import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const positions = await prisma.position.findMany({
      orderBy: {
        position_id: "asc",
      },
    });

    return NextResponse.json({
      ok: true,
      data: positions.map((position) => ({
        position_id: position.position_id,
        position_name: position.position_name,
        description: position.description,
      })),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        ok: false,
        message: "Не вдалося завантажити список посад.",
      },
      { status: 500 }
    );
  }
}