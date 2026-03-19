function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "")
}

function resolveApiUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (configured) return normalizeUrl(configured)

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:8000"
  }

  throw new Error("NEXT_PUBLIC_API_URL is required in production")
}

export const env = {
  apiUrl: resolveApiUrl(),
}
