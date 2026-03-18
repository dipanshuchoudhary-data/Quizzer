import { create } from "zustand"

interface UIState {
  sidebarCollapsed: boolean
  mobileSidebarOpen: boolean
  commandOpen: boolean
  setSidebarCollapsed: (next: boolean) => void
  toggleSidebar: () => void
  setMobileSidebarOpen: (next: boolean) => void
  toggleMobileSidebar: () => void
  setCommandOpen: (next: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  commandOpen: false,
  setSidebarCollapsed: (next) => set({ sidebarCollapsed: next }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setMobileSidebarOpen: (next) => set({ mobileSidebarOpen: next }),
  toggleMobileSidebar: () => set((state) => ({ mobileSidebarOpen: !state.mobileSidebarOpen })),
  setCommandOpen: (next) => set({ commandOpen: next }),
}))
