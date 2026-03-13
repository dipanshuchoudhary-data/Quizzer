import { redirect } from "next/navigation"

export default function PublishedRedirectPage() {
  redirect("/quizzes?filter=published")
}
