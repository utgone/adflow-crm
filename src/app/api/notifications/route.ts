import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;

function getLimitFromUrl(request: Request) {
  const url = new URL(request.url);
  const rawLimit = Number(url.searchParams.get("limit"));

  if (!Number.isFinite(rawLimit) || rawLimit <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(rawLimit), MAX_LIMIT);
}

function getNotificationWhere(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) {
    return null;
  }

  if (user.source === "client") {
    return {
      OR: [
        {
          recipient_source: "client",
          recipient_id: user.id,
        },
      ],
    };
  }

  return {
    OR: [
      {
        recipient_source: "employee",
        recipient_id: user.id,
      },
      {
        recipient_source: "role",
        recipient_role: user.role,
      },
    ],
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Не авторизовано." },
      { status: 401 }
    );
  }

  const where = getNotificationWhere(user);

  if (!where) {
    return NextResponse.json(
      { ok: false, message: "Не вдалося визначити користувача." },
      { status: 400 }
    );
  }

  const limit = getLimitFromUrl(request);

  try {
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: {
          created_at: "desc",
        },
        take: limit,
      }),

      prisma.notification.count({
        where: {
          AND: [where, { is_read: false }],
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      data: {
        unreadCount,
        items: items.map((item) => ({
          id: item.notification_id,
          type: item.type,
          title: item.title,
          message: item.message,
          actorName: item.actor_name,
          entityType: item.entity_type,
          entityId: item.entity_id,
          entityUrl: item.entity_url,
          isRead: item.is_read,
          createdAt: item.created_at,
        })),
      },
    });
  } catch (error) {
    console.error("GET_NOTIFICATIONS_ERROR", error);

    return NextResponse.json(
      { ok: false, message: "Не вдалося завантажити повідомлення." },
      { status: 500 }
    );
  }
}

export async function PATCH() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, message: "Не авторизовано." },
      { status: 401 }
    );
  }

  const where = getNotificationWhere(user);

  if (!where) {
    return NextResponse.json(
      { ok: false, message: "Не вдалося визначити користувача." },
      { status: 400 }
    );
  }

  try {
    await prisma.notification.updateMany({
      where: {
        AND: [where, { is_read: false }],
      },
      data: {
        is_read: true,
      },
    });

    return NextResponse.json({
      ok: true,
      message: "Повідомлення позначено як прочитані.",
    });
  } catch (error) {
    console.error("READ_NOTIFICATIONS_ERROR", error);

    return NextResponse.json(
      { ok: false, message: "Не вдалося оновити повідомлення." },
      { status: 500 }
    );
  }
}