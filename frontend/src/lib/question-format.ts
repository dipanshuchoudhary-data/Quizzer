const LATEX_COMMANDS = [
  "alpha", "beta", "gamma", "delta", "theta", "lambda", "mu", "pi", "sigma", "phi", "omega",
  "sin", "cos", "tan", "cot", "sec", "csc", "log", "ln", "sqrt", "frac",
]

const RAW_MATH_TOKEN_MAP: Record<string, string> = {
  "\u03b8": "\\theta",
  "\u03b1": "\\alpha",
  "\u03b2": "\\beta",
  "\u03b3": "\\gamma",
  "\u0394": "\\Delta",
  "\u03b4": "\\delta",
  "\u03bb": "\\lambda",
  "\u03bc": "\\mu",
  "\u03c0": "\\pi",
  "\u03c3": "\\sigma",
  "\u03c6": "\\phi",
  "\u03c9": "\\omega",
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}

export function normalizeMathText(value: string | null | undefined): string {
  let next = normalizeWhitespace(String(value ?? ""))
  if (!next) return ""

  for (const [raw, latex] of Object.entries(RAW_MATH_TOKEN_MAP)) {
    next = next.split(raw).join(latex)
  }

  next = next.replace(/\\([A-Za-z]+)/g, (_, token: string) => `\\${token.toLowerCase()}`)
  next = next.replace(
    /(?<!\\)\b(?:sin|cos|tan|cot|sec|csc|log|ln|sqrt|frac|theta|alpha|beta|gamma|delta|lambda|mu|pi|sigma|phi|omega)\b/gi,
    (token) => `\\${token.toLowerCase()}`
  )

  for (const token of LATEX_COMMANDS) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    next = next.replace(new RegExp(`${escaped}\\s*\\\\${escaped}\\s*${escaped}`, "gi"), `\\${token}`)
    next = next.replace(new RegExp(`${escaped}\\s*\\\\${escaped}`, "gi"), `\\${token}`)
    next = next.replace(new RegExp(`\\\\${escaped}\\s*${escaped}`, "gi"), `\\${token}`)
  }

  for (const token of ["sin", "cos", "tan", "cot"]) {
    next = next.replace(new RegExp(`\\bu\\s*${token}\\s*\\\\theta\\s*u?\\s*\\\\${token}\\s*\\\\theta\\s*u?\\s*${token}\\s*\\\\theta\\b`, "gi"), `u \\\\${token}\\\\theta`)
    next = next.replace(new RegExp(`\\bu\\s*${token}\\s*\\\\theta\\s*u?\\s*\\\\${token}\\s*\\\\theta\\b`, "gi"), `u \\\\${token}\\\\theta`)
    next = next.replace(new RegExp(`\\bu\\s*\\\\${token}\\s*\\\\theta\\s*u?\\s*${token}\\s*\\\\theta\\b`, "gi"), `u \\\\${token}\\\\theta`)
  }

  const compactCandidate = next.replace(/\s+/g, "")
  if (compactCandidate.length <= 48) {
    for (let size = Math.min(Math.floor(compactCandidate.length / 2), 32); size >= 1; size -= 1) {
      if (compactCandidate.length % size !== 0) continue
      const chunk = compactCandidate.slice(0, size)
      const repeats = compactCandidate.length / size
      if (repeats >= 2 && chunk.repeat(repeats) === compactCandidate) {
        next = chunk
        break
      }
    }
  }

  next = next
    .replace(/(\\[A-Za-z]+)(?:\1)+/g, "$1")
    .replace(/([A-Za-z0-9])\\([A-Za-z]+)/g, "$1 \\\\$2")
    .replace(/(?<!\\)\b([A-Za-z])(?=\\[A-Za-z]+)/g, "$1 ")
    .replace(/\s*([+\-=/,:;()])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .trim()

  return next
}

export function formatQuestionForDisplay(value: string | null | undefined): string {
  const normalized = normalizeMathText(value)
  if (!normalized) return ""
  return normalized.replace(/(\\[A-Za-z]+(?:\{[^{}]*\}|[A-Za-z0-9])*)/g, "$$$1$$")
}
