import { NextRequest, NextResponse } from "next/server"

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

function buildApiUrl(id: string) {
  return `${apiBaseUrl.replace(/\/$/, "")}/quizzes/${id}/settings`
}

async function proxySettingsRequest(request: NextRequest, id: string) {
  const targetUrl = buildApiUrl(id)
  const contentType = request.headers.get("content-type")
  const authorization = request.headers.get("authorization")
  const cookie = request.headers.get("cookie")

  const upstream = await fetch(targetUrl, {
    method: request.method,
    headers: {
      ...(contentType ? { "content-type": contentType } : {}),
      ...(authorization ? { authorization } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: request.method === "GET" ? undefined : await request.text(),
    cache: "no-store",
  })

  const bodyText = await upstream.text()
  const response = new NextResponse(bodyText, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  })

  const setCookie = upstream.headers.get("set-cookie")
  if (setCookie) {
    response.headers.set("set-cookie", setCookie)
  }

  return response
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    return await proxySettingsRequest(request, params.id)
  } catch {
    return NextResponse.json({ detail: "Failed to reach backend settings service" }, { status: 502 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    return await proxySettingsRequest(request, params.id)
  } catch {
    return NextResponse.json({ detail: "Failed to reach backend settings service" }, { status: 502 })
  }
}
