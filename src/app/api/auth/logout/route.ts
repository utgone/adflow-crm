import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SESSION_COOKIE_NAME = "adflow_session";

function clearSessionResponse() {
  const response = NextResponse.json({
    ok: true,
    message: "Вихід виконано успішно.",
  });

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

export async function POST() {
  return clearSessionResponse();
}

export async function GET() {
  return clearSessionResponse();
}