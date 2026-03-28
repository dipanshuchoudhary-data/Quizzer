function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "")
}

function resolveBackendOrigin() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (configured) return normalizeUrl(configured)

  return "http://localhost:8000"
}

export const env = {
  apiUrl: "/backend",
  backendOrigin: resolveBackendOrigin(),
}
