import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type AuthRole = "director" | "manager" | "content" | "ads" | "accountant" | "client";
type AuthSource = "client" | "employee";

type SessionPayload = {
  sessionId: string;
  userId: number;
  source: AuthSource;
  role: AuthRole;
  name: string;
  email: string;
  login: string;
  issuedAt: number;
  expiresAt: number;
};

const SESSION_COOKIE_NAME = "adflow_session";

const SESSION_SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "adflow-dev-secret-change-before-production";

function sign(value: string) {
  return createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function safeEqual(leftValue: string, rightValue: string) {
  const left = Buffer.from(leftValue);
  const right = Buffer.from(rightValue);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function parseSessionToken(token: string): SessionPayload | null {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);

  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const json = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload = JSON.parse(json) as Partial<SessionPayload>;

    if (
      typeof payload.sessionId !== "string" ||
      typeof payload.userId !== "number" ||
      typeof payload.source !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.name !== "string" ||
      typeof payload.login !== "string" ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.expiresAt !== "number"
    ) {
      return null;
    }

    if (!["client", "employee"].includes(payload.source)) {
      return null;
    }

    if (
      !["director", "manager", "content", "ads", "accountant", "client"].includes(
        payload.role
      )
    ) {
      return null;
    }

    return {
      sessionId: payload.sessionId,
      userId: payload.userId,
      source: payload.source as AuthSource,
      role: payload.role as AuthRole,
      name: payload.name,
      email: typeof payload.email === "string" ? payload.email : "",
      login: payload.login,
      issuedAt: payload.issuedAt,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return null;
  }
}

function mapEmployeeRole(positionName: string): AuthRole {
  const position = positionName.toLowerCase();

  if (position.includes("директор")) {
    return "director";
  }

  if (position.includes("бухгалтер")) {
    return "accountant";
  }

  if (
    position.includes("контент") ||
    position.includes("копірайтер") ||
    position.includes("дизайн") ||
    position.includes("designer")
  ) {
    return "content";
  }

  if (
    position.includes("реклам") ||
    position.includes("таргет") ||
    position.includes("smm") ||
    position.includes("ads")
  ) {
    return "ads";
  }

  return "manager";
}

function unauthorized(message = "Користувач не авторизований.") {
  const response = NextResponse.json(
    {
      ok: false,
      message,
      data: null,
    },
    { status: 401 }
  );

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return unauthorized();
    }

    const session = parseSessionToken(token);

    if (!session) {
      return unauthorized("Сесію пошкоджено або підроблено.");
    }

    if (session.expiresAt < Date.now()) {
      return unauthorized("Термін дії сесії завершився. Увійдіть повторно.");
    }

    if (session.source === "client") {
      const client = await prisma.client.findUnique({
        where: {
          client_id: session.userId,
        },
        select: {
          client_id: true,
          full_name: true,
          company_name: true,
          email: true,
          phone: true,
          status: true,
        },
      });

      if (!client) {
        return unauthorized("Клієнта з цієї сесії більше не існує.");
      }

      if (client.status !== "активний") {
        return unauthorized("Акаунт клієнта неактивний.");
      }

      return NextResponse.json({
        ok: true,
        data: {
          id: client.client_id,
          source: "client",
          role: "client",
          name: client.full_name,
          email: client.email,
          login: client.email,
          phone: client.phone,
          company_name: client.company_name ?? "Без компанії",
          status: client.status,
        },
      });
    }

    const employee = await prisma.employee.findUnique({
      where: {
        employee_id: session.userId,
      },
      include: {
        position: true,
      },
    });

    if (!employee) {
      return unauthorized("Співробітника з цієї сесії більше не існує.");
    }

    if (employee.status !== "працює") {
      return unauthorized("Акаунт співробітника неактивний.");
    }

    const currentRole = mapEmployeeRole(employee.position.position_name);

    return NextResponse.json({
      ok: true,
      data: {
        id: employee.employee_id,
        source: "employee",
        role: currentRole,
        name: employee.full_name,
        email: "",
        login: employee.login,
        phone: employee.contacts,
        position_id: employee.position_id,
        position_name: employee.position.position_name,
        status: employee.status,
      },
    });
  } catch (error) {
    console.error("AUTH_ME_ERROR", error);

    return NextResponse.json(
      {
        ok: false,
        message: "Помилка сервера під час перевірки сесії.",
        data: null,
      },
      { status: 500 }
    );
  }
}