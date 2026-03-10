# Understanding React Re-render Optimization

## The Problem

When using React Context, **all consumer components re-render** when any value in the context changes - even if they don't use that value!

### Example of the Problem:

```tsx
// ❌ BAD: Single Context causes unnecessary re-renders
const DashboardContext = createContext({
  activeNav: 'cv',
  setActiveNav: () => {},
  planUsage: { used: 650, total: 1000 },
  updatePlanUsage: () => {},
})

function Sidebar() {
  const { activeNav, setActiveNav, planUsage } = useContext(DashboardContext)
  // Re-renders when activeNav OR planUsage changes
}

function Header() {
  const { activeNav } = useContext(DashboardContext)
  // ❌ Also re-renders when planUsage changes (even though it doesn't use it!)
}
```

## Solutions Comparison

### ✅ Approach 1: Split Contexts (Currently Implemented)

**Best for:** Projects that want to stay dependency-free

```tsx
// Create separate contexts for each state slice
const NavContext = createContext(...)
const PlanContext = createContext(...)
const SyncContext = createContext(...)

// Components only re-render when their specific context changes
function Sidebar() {
  const { activeNav } = useNav()      // ✅ Only re-renders on nav change
  const { planUsage } = usePlan()     // ✅ Only re-renders on plan change
}
```

**Pros:**
- ✅ No external dependencies
- ✅ Native React solution
- ✅ Clear separation of concerns

**Cons:**
- ⚠️ More context providers to wrap
- ⚠️ Slightly more boilerplate

---

### ✅ Approach 2: Zustand (Recommended for Larger Apps)

**Best for:** Projects okay with adding a small 1KB dependency

```bash
npm install zustand
```

```tsx
// store/dashboardStore.ts
import { create } from 'zustand'

export const useDashboardStore = create((set) => ({
  activeNav: 'cv',
  planUsage: { used: 650, total: 1000 },
  setActiveNav: (nav) => set({ activeNav: nav }),
  updatePlanUsage: (used) => set((state) => ({
    planUsage: { ...state.planUsage, used }
  })),
}))

// Components subscribe to ONLY what they use
function Header() {
  const activeNav = useDashboardStore((state) => state.activeNav)
  // ✅ Only re-renders when activeNav changes
}

function PlanUsage() {
  const planUsage = useDashboardStore((state) => state.planUsage)
  // ✅ Only re-renders when planUsage changes
  // Never re-renders when activeNav changes!
}
```

**Pros:**
- ✅ Minimal boilerplate
- ✅ Automatic re-render optimization
- ✅ TypeScript support
- ✅ Only 1KB bundle size
- ✅ No providers needed

**Cons:**
- ⚠️ External dependency (though very small)

---

### ✅ Approach 3: React.memo with Component Splitting

**Best for:** Fine-grained control over specific components

```tsx
import { memo, useCallback } from 'react'

// Memoized component only re-renders when props change
const PersonalInfoSection = memo(({ data, onChange }) => {
  return <section>{/* ... */}</section>
})

// Stable callback prevents re-renders
const Parent = () => {
  const handleChange = useCallback((newData) => {
    // ...
  }, [])

  return <PersonalInfoSection data={data} onChange={handleChange} />
}
```

**Pros:**
- ✅ No external dependencies
- ✅ Precise control

**Cons:**
- ⚠️ More boilerplate
- ⚠️ Need to memoize callbacks
- ⚠️ Can over-optimize

---

## Implementation in Your Project

### Current Implementation (Split Contexts)

Your `DashboardContext.tsx` now uses **split contexts**:

```tsx
// Each context manages its own state
export const useNav = () => { /* ... */ }      // Only nav state
export const usePlan = () => { /* ... */ }     // Only plan state
export const useSync = () => { /* ... */ }     // Only sync state
```

### How to Use in Components

```tsx
// ✅ GOOD: Component only re-renders when nav changes
function Sidebar() {
  const { activeNav, setActiveNav } = useNav()
  const { planUsage } = usePlan()
  // ...
}

// ✅ GOOD: Component only re-renders when sync changes
function Header() {
  const { lastSync } = useSync()
  // ...
}
```

---

## How to Verify Re-renders

Add console.log to see when components render:

```tsx
const Sidebar = () => {
  console.log('Sidebar rendered') // Check browser console
  // ...
}
```

**Before optimization:** You'd see all components log on every state change.
**After optimization:** Only affected components log.

---

## Recommendation

For your project:

1. ✅ **Keep the split contexts approach** (currently implemented)
2. ✅ It's dependency-free and works well
3. ⚠️ If the app grows larger, consider migrating to Zustand

### To Migrate to Zustand (Optional):

```bash
npm install zustand
```

Then replace context usages with store:

```tsx
// Before
const { activeNav, setActiveNav } = useNav()

// After (with Zustand)
const activeNav = useDashboardStore((state) => state.activeNav)
const setActiveNav = useDashboardStore((state) => state.setActiveNav)
```

---

## Summary: How Re-renders Are Avoided

| Technique | How It Works |
|-----------|--------------|
| **Split Contexts** | Separate contexts mean components only subscribe to what they use |
| **Zustand** | Selector-based subscriptions automatically prevent unnecessary re-renders |
| **React.memo** | Components skip re-render if props haven't changed |
| **useCallback** | Stable function references prevent child re-renders |

Your current implementation uses **Split Contexts**, which effectively prevents re-renders by ensuring components only receive the state they actually need.
