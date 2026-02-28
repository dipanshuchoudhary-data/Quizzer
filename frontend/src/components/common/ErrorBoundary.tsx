"use client"

import React from "react"

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-red-500">
          Something went wrong.
        </div>
      )
    }

    return this.props.children
  }
}