import { prisma } from "@/lib/prisma";

type NotificationRecipient = {
  recipientSource: "client" | "employee" | "role";
  recipientId?: number | null;
  recipientRole?: string | null;
};

type CreateNotificationParams = {
  recipient: NotificationRecipient;

  actorSource?: "client" | "employee" | null;
  actorId?: number | null;
  actorName?: string | null;

  type: string;
  title: string;
  message: string;

  entityType?: string | null;
  entityId?: number | null;
  entityUrl?: string | null;
};

export async function createNotification(params: CreateNotificationParams) {
  try {
    await prisma.notification.create({
      data: {
        recipient_source: params.recipient.recipientSource,
        recipient_id: params.recipient.recipientId ?? null,
        recipient_role: params.recipient.recipientRole ?? null,

        actor_source: params.actorSource ?? null,
        actor_id: params.actorId ?? null,
        actor_name: params.actorName ?? null,

        type: params.type,
        title: params.title,
        message: params.message,

        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
        entity_url: params.entityUrl ?? null,
        is_read: false,
      },
    });
  } catch (error) {
    console.error("CREATE_NOTIFICATION_ERROR", error);
  }
}

export async function notifyRole(params: Omit<CreateNotificationParams, "recipient"> & {
  role: string;
}) {
  return createNotification({
    recipient: {
      recipientSource: "role",
      recipientRole: params.role,
    },
    actorSource: params.actorSource,
    actorId: params.actorId,
    actorName: params.actorName,
    type: params.type,
    title: params.title,
    message: params.message,
    entityType: params.entityType,
    entityId: params.entityId,
    entityUrl: params.entityUrl,
  });
}

export async function notifyClient(params: Omit<CreateNotificationParams, "recipient"> & {
  clientId: number;
}) {
  return createNotification({
    recipient: {
      recipientSource: "client",
      recipientId: params.clientId,
    },
    actorSource: params.actorSource,
    actorId: params.actorId,
    actorName: params.actorName,
    type: params.type,
    title: params.title,
    message: params.message,
    entityType: params.entityType,
    entityId: params.entityId,
    entityUrl: params.entityUrl,
  });
}

export async function notifyEmployee(params: Omit<CreateNotificationParams, "recipient"> & {
  employeeId: number;
}) {
  return createNotification({
    recipient: {
      recipientSource: "employee",
      recipientId: params.employeeId,
    },
    actorSource: params.actorSource,
    actorId: params.actorId,
    actorName: params.actorName,
    type: params.type,
    title: params.title,
    message: params.message,
    entityType: params.entityType,
    entityId: params.entityId,
    entityUrl: params.entityUrl,
  });
}