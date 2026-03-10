import { create } from 'zustand'

// ============================================
// APPROACH 2: Zustand Store
// Zero boilerplate, automatic re-render optimization
// Only components that subscribe to specific state update
// ============================================

interface DashboardStore {
  // Navigation state
  activeNav: 'cv' | 'api-keys' | 'preferences' | 'history'
  setActiveNav: (nav: 'cv' | 'api-keys' | 'preferences' | 'history') => void

  // Plan usage
  planUsage: { used: number; total: number }
  updatePlanUsage: (used: number) => void

  // Sync status
  lastSync: Date | null
  updateSyncStatus: () => void
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  // Initial state
  activeNav: 'cv',
  planUsage: { used: 650, total: 1000 },
  lastSync: new Date(),

  // Actions
  setActiveNav: (nav) => set({ activeNav: nav }),

  updatePlanUsage: (used) =>
    set((state) => ({
      planUsage: { ...state.planUsage, used },
    })),

  updateSyncStatus: () =>
    set({ lastSync: new Date() }),
}))

// ============================================
// Usage Example:
//
// // Component ONLY re-renders when activeNav changes
// function Sidebar() {
//   const activeNav = useDashboardStore((state) => state.activeNav)
//   const setActiveNav = useDashboardStore((state) => state.setActiveNav)
//   // ...
// }
//
// // Component ONLY re-renders when planUsage changes
// function PlanUsage() {
//   const planUsage = useDashboardStore((state) => state.planUsage)
//   // Never re-renders when activeNav changes!
// }
// ============================================
