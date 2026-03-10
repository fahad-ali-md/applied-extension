/**
 * Smart Form Handler - Main Orchestrator
 * Detects form type and routes to appropriate handler
 * NO HARDCODED RULES - Everything is AI-driven
 */

import { detectFormType, getDetectionSummary, FormTypeDetection } from './formTypeDetector'
import { handleStructuredForm, isStructuredForm } from './structuredFormHandler'
import { handleMultiStepForm, isMultiStepForm, MultiStepOptions } from './multiStepFormHandler'

export interface SmartFormOptions {
  autoSubmit?: boolean
  delayMs?: number
  maxSteps?: number
  onProgress?: (message: string) => void
  onStepProgress?: (step: number, message: string) => void
  onDetectionComplete?: (detection: FormTypeDetection) => void
}

export interface SmartFormResult {
  success: boolean
  formPattern: string
  message: string
  stats: {
    stepsCompleted?: number
    fieldsFilled: number
    fieldsSkipped: number
    fieldsFailed: number
  }
  submitted: boolean
}

/**
 * Main entry point - Auto-fill any form intelligently
 */
export async function smartAutoFill(
  cvData: any,
  getAIResponse: (prompt: string) => Promise<any>,
  options: SmartFormOptions = {}
): Promise<SmartFormResult> {
  const {
    autoSubmit = false,
    delayMs = 100,
    maxSteps = 20,
    onProgress,
    onStepProgress,
    onDetectionComplete
  } = options

  try {
    onProgress?.('🔍 Detecting form type...')

    // Step 1: Detect form type using AI
    const detection = await detectFormType(getAIResponse)

    console.log('[SmartFormHandler] Detection result:', detection)
    onProgress?.(`✨ ${getDetectionSummary(detection)}`)

    // Notify detection complete
    onDetectionComplete?.(detection)

    // Step 2: Route to appropriate handler
    if (isStructuredForm(detection)) {
      onProgress?.('📝 Using Structured Form Handler')
      return await handleStructuredFlow(cvData, getAIResponse, detection, {
        autoSubmit,
        delayMs,
        onProgress
      })
    } else if (isMultiStepForm(detection)) {
      onProgress?.('🔄 Using Multi-Step Form Handler')
      return await handleMultiStepFlow(cvData, getAIResponse, detection, {
        autoSubmit,
        delayMs,
        maxSteps,
        onProgress: onStepProgress || ((step: number, msg: string) => onProgress?.(`Step ${step}: ${msg}`))
      })
    } else {
      // Unknown pattern - try multi-step (safer)
      onProgress?.('❓ Unknown pattern - trying Multi-Step Handler')
      return await handleMultiStepFlow(cvData, getAIResponse, detection, {
        autoSubmit,
        delayMs,
        maxSteps,
        onProgress: onStepProgress || ((step: number, msg: string) => onProgress?.(`Step ${step}: ${msg}`))
      })
    }

  } catch (error) {
    console.error('[SmartFormHandler] Error:', error)
    return {
      success: false,
      formPattern: 'unknown',
      message: `Error: ${String(error)}`,
      stats: {
        fieldsFilled: 0,
        fieldsSkipped: 0,
        fieldsFailed: 0
      },
      submitted: false
    }
  }
}

/**
 * Handle structured form flow
 */
async function handleStructuredFlow(
  cvData: any,
  getAIResponse: (prompt: string) => Promise<any>,
  detection: FormTypeDetection,
  options: {
    autoSubmit?: boolean
    delayMs?: number
    onProgress?: (message: string) => void
  }
): Promise<SmartFormResult> {
  const result = await handleStructuredForm(cvData, getAIResponse, options)

  return {
    success: result.success,
    formPattern: detection.pattern,
    message: result.message,
    stats: {
      fieldsFilled: result.fieldsFilled,
      fieldsSkipped: result.fieldsSkipped,
      fieldsFailed: result.fieldsFailed
    },
    submitted: result.executed || false
  }
}

/**
 * Handle multi-step form flow
 */
async function handleMultiStepFlow(
  cvData: any,
  getAIResponse: (prompt: string) => Promise<any>,
  detection: FormTypeDetection,
  options: MultiStepOptions
): Promise<SmartFormResult> {
  const result = await handleMultiStepForm(cvData, getAIResponse, detection, options)

  return {
    success: result.success,
    formPattern: detection.pattern,
    message: result.message,
    stats: {
      stepsCompleted: result.stepsCompleted,
      fieldsFilled: result.totalFieldsFilled,
      fieldsSkipped: result.totalFieldsSkipped,
      fieldsFailed: result.totalFieldsFailed
    },
    submitted: result.submitted || false
  }
}

/**
 * Quick form analysis (without filling)
 */
export async function analyzeForm(
  getAIResponse: (prompt: string) => Promise<any>
): Promise<{
  pattern: string
  fieldCount: number
  hasNextButton: boolean
  hasSubmitButton: boolean
  confidence: number
  summary: string
}> {
  const detection = await detectFormType(getAIResponse)

  return {
    pattern: detection.pattern,
    fieldCount: detection.fieldCount,
    hasNextButton: detection.hasNextButton,
    hasSubmitButton: detection.hasSubmitButton,
    confidence: detection.confidence,
    summary: getDetectionSummary(detection)
  }
}
