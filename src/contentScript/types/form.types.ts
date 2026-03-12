/**
 * Form Types & Interfaces
 *
 * Reusable type definitions for form filling operations
 */

export interface FormField {
  name: string
  value: string
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file' | 'date'
}

export interface FormFillData {
  personal: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address?: string
    city?: string
    state?: string
    zipCode?: string
    country?: string
  }
  professional: {
    currentTitle?: string
    company?: string
    experience?: string
    skills?: string[]
    summary?: string
  }
  education: {
    degree?: string
    school?: string
    graduationYear?: string
  }
  coverLetter?: string
  resumeFile?: string
  customAnswers?: Record<string, string>
}

/**
 * Progress callback type for real-time updates
 */
export type ProgressCallback = (
  fieldName: string,
  status: 'filled' | 'failed' | 'pending',
  label: string
) => void

/**
 * AI Response wrapper type
 */
export type AIResponseGetter = (prompt: string) => Promise<any>
