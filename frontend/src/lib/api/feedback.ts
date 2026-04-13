import { api } from "@/lib/api/client"

type SubmitFeedbackPayload = {
  message: string
  subject?: string
  contact_email?: string
}

export const feedbackApi = {
  async submit(payload: SubmitFeedbackPayload): Promise<{ message: string }> {
    const { data } = await api.post<{ message: string }>("/feedback", payload)
    return data
  },
}
