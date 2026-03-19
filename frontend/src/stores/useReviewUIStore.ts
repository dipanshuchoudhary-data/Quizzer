import { create } from "zustand"

interface ReviewUIState {
  focusMode: boolean
  activeSection: string | null
  toggleFocus: () => void
  setFocusMode: (value: boolean) => void
  setActiveSection: (sectionId: string | null) => void
}

export const useReviewUIStore = create<ReviewUIState>((set) => ({
  focusMode: false,
  activeSection: null,
  toggleFocus: () => set((state) => ({ focusMode: !state.focusMode })),
  setFocusMode: (value) => set({ focusMode: value }),
  setActiveSection: (sectionId) => set({ activeSection: sectionId }),
}))

