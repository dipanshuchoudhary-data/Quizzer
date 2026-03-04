import { create } from "zustand"

interface QuizSelectionState {
  selectedQuizIds: string[]
  toggleQuiz: (id: string) => void
  clearQuizSelection: () => void
  setQuizSelection: (ids: string[]) => void
}

export const useQuizSelectionStore = create<QuizSelectionState>((set) => ({
  selectedQuizIds: [],
  toggleQuiz: (id) =>
    set((state) => ({
      selectedQuizIds: state.selectedQuizIds.includes(id)
        ? state.selectedQuizIds.filter((value) => value !== id)
        : [...state.selectedQuizIds, id],
    })),
  clearQuizSelection: () => set({ selectedQuizIds: [] }),
  setQuizSelection: (ids) => set({ selectedQuizIds: ids }),
}))

