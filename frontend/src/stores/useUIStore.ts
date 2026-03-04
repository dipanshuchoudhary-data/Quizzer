import { create } from "zustand"

interface UIState {
  sidebarCollapsed: boolean
  commandOpen: boolean
  setSidebarCollapsed: (next: boolean) => void
  toggleSidebar: () => void
  setCommandOpen: (next: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  commandOpen: false,
  setSidebarCollapsed: (next) => set({ sidebarCollapsed: next }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setCommandOpen: (next) => set({ commandOpen: next }),
}))

