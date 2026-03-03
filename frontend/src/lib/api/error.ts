import axios from "axios"

export function getApiErrorMessage(error: unknown, fallback = "Request failed"): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail

    if (typeof detail === "string" && detail.trim().length > 0) {
      return detail
    }

    if (Array.isArray(detail) && detail.length > 0) {
      const firstMessage = detail[0]?.msg
      if (typeof firstMessage === "string" && firstMessage.trim().length > 0) {
        return firstMessage
      }
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallback
}
