import { api } from "@/lib/api/client"

export async function buildSection(payload: unknown) {
  const response = await api.post("/quizzes/sections/build", payload)
  return response.data
}
