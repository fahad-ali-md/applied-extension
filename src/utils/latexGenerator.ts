/**
 * CV Types and Validation Utilities
 *
 * Provides type definitions and validation functions for CV data
 * NOTE: LaTeX generation functions have been removed (not used)
 */

// ============================================
// Types
// ============================================

export interface CVPersonalInfo {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  linkedIn?: string
  github?: string
  portfolio?: string
}

export interface CVExperience {
  company?: string
  role?: string
  startDate?: string
  endDate?: string
  current?: boolean
  highlights?: string[]
}

export interface CVEducation {
  degree?: string
  school?: string
  field?: string
  startDate?: string
  endDate?: string
  graduationYear?: string
}

export interface CVProject {
  name?: string
  description?: string
  technologies?: string[]
  startDate?: string
  endDate?: string
}

export interface CVSkills {
  [category: string]: string[] | undefined
}

export interface CVData {
  personal?: CVPersonalInfo
  professional?: {
    summary?: string
    currentTitle?: string
  }
  experience?: CVExperience[]
  education?: CVEducation[]
  projects?: CVProject[]
  skills?: CVSkills
  rawText?: string
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate CV data structure
 */
export function validateCVData(cvData: any): cvData is CVData {
  return cvData && typeof cvData === 'object'
}

/**
 * Check if CV has minimum required data
 */
export function hasMinimumCVData(cvData: CVData): boolean {
  return !!(
    cvData.personal?.firstName ||
    cvData.personal?.lastName ||
    cvData.personal?.email
  )
}

/**
 * Get CV statistics
 */
export function getCVStats(cvData: CVData): {
  experiences: number
  education: number
  projects: number
  hasSkills: boolean
} {
  return {
    experiences: cvData.experience?.length || 0,
    education: cvData.education?.length || 0,
    projects: cvData.projects?.length || 0,
    hasSkills: !!(
      cvData.skills && Object.keys(cvData.skills).length > 0
    )
  }
}