import { create } from "zustand"

interface ReviewUIState {
  focusMode: boolean
  activeSection: string | null
  toggleFocus: () => void
  setActiveSection: (sectionId: string | null) => void
}

export const useReviewUIStore = create<ReviewUIState>((set) => ({
  focusMode: false,
  activeSection: null,
  toggleFocus: () => set((state) => ({ focusMode: !state.focusMode })),
  setActiveSection: (sectionId) => set({ activeSection: sectionId }),
}))

