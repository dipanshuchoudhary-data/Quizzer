function normalizeUrl(value: string) {
  return value.replace(/\/+$/, "")
}

function resolveBackendOrigin() {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim()
  if (configured) return normalizeUrl(configured)

  return "http://localhost:8000"
}

function resolveGoogleAuthUrl(backendOrigin: string) {
  const configured = process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL?.trim()
  if (configured) return configured

  return `${backendOrigin}/login/google`
}

const backendOrigin = resolveBackendOrigin()

export const env = {
  apiUrl: "/backend",
  backendOrigin,
  googleAuthUrl: resolveGoogleAuthUrl(backendOrigin),
}
