import { createContext, useContext, useState, useMemo, ReactNode } from 'react'

// ============================================
// APPROACH 1: Split Contexts (Native React)
// Each context only manages its own slice of state
// ============================================

// --- Navigation Context ---
interface NavContextType {
  activeNav: 'cv' | 'api-keys' | 'preferences' | 'history'
  setActiveNav: (nav: 'cv' | 'api-keys' | 'preferences' | 'history') => void
}

const NavContext = createContext<NavContextType | undefined>(undefined)

// --- Plan Usage Context ---
interface PlanContextType {
  planUsage: { used: number; total: number }
  updatePlanUsage: (used: number) => void
}

const PlanContext = createContext<PlanContextType | undefined>(undefined)

// --- Sync Status Context ---
interface SyncContextType {
  lastSync: Date | null
  updateSyncStatus: () => void
}

const SyncContext = createContext<SyncContextType | undefined>(undefined)

// ============================================
// Provider Components
// ============================================

export const DashboardProvider = ({ children }: { children: ReactNode }) => {
  return (
    <NavProvider>
      <PlanProvider>
        <SyncProvider>
          {children}
        </SyncProvider>
      </PlanProvider>
    </NavProvider>
  )
}

// Separate provider for each state slice
const NavProvider = ({ children }: { children: ReactNode }) => {
  const [activeNav, setActiveNav] = useState<'cv' | 'api-keys' | 'preferences' | 'history'>('cv')

  // Use useMemo to prevent unnecessary re-renders while keeping value updated
  const value = useMemo(() => ({
    activeNav,
    setActiveNav,
  }), [activeNav])

  return (
    <NavContext.Provider value={value}>
      {children}
    </NavContext.Provider>
  )
}

const PlanProvider = ({ children }: { children: ReactNode }) => {
  const [planUsage, setPlanUsage] = useState({ used: 650, total: 1000 })

  const updatePlanUsage = (used: number) => {
    setPlanUsage(prev => ({ ...prev, used }))
  }

  const value = useMemo(() => ({
    planUsage,
    updatePlanUsage,
  }), [planUsage])

  return (
    <PlanContext.Provider value={value}>
      {children}
    </PlanContext.Provider>
  )
}

const SyncProvider = ({ children }: { children: ReactNode }) => {
  const [lastSync, setLastSync] = useState<Date | null>(new Date())

  const updateSyncStatus = () => {
    setLastSync(new Date())
  }

  const value = useMemo(() => ({
    lastSync,
    updateSyncStatus,
  }), [lastSync])

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  )
}

// ============================================
// Custom Hooks for Each Context
// ============================================

export const useNav = () => {
  const context = useContext(NavContext)
  if (!context) throw new Error('useNav must be used within NavProvider')
  return context
}

export const usePlan = () => {
  const context = useContext(PlanContext)
  if (!context) throw new Error('usePlan must be used within PlanProvider')
  return context
}

export const useSync = () => {
  const context = useContext(SyncContext)
  if (!context) throw new Error('useSync must be used within SyncProvider')
  return context
}

// ============================================
// Legacy Hook (for backward compatibility)
// ============================================

export const useDashboard = () => {
  const nav = useNav()
  const plan = usePlan()
  const sync = useSync()

  return {
    ...nav,
    ...plan,
    ...sync,
  }
}
