import { Suspense } from "react"
import { AuthSuccessClient } from "./AuthSuccessClient"

export default function AuthSuccessPage({
  searchParams,
}: {
  searchParams?: { token?: string }
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AuthSuccessClient token={searchParams?.token} />
    </Suspense>
  )
}
