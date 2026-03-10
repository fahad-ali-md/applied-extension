/**
 * PDF Text Extraction Utility
 * Extracts text content from PDF files using pdfjs-dist
 */

import * as pdfjsLib from 'pdfjs-dist'

// Set up the worker - must be called after chrome extension APIs are available
// We set it lazily when extractTextFromPDF is called, not at module load time
let workerInitialized = false

function initializeWorker() {
  if (workerInitialized) return

  try {
    // In Chrome extension, use chrome.runtime.getURL for absolute path
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      const workerUrl = chrome.runtime.getURL('pdf.worker.min.mjs')
      console.log('[PDF Extractor] Setting worker URL to:', workerUrl)
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl
      workerInitialized = true
    } else {
      // Development fallback
      console.warn('[PDF Extractor] chrome.runtime not available, using relative path')
      pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs'
      workerInitialized = true
    }
  } catch (error) {
    console.error('[PDF Extractor] Failed to set worker source:', error)
    throw error
  }
}

export interface ExtractResult {
  success: boolean
  text?: string
  error?: string
}

/**
 * Extract text from a PDF file
 * @param file - The PDF file to extract text from
 * @returns Promise with extracted text or error
 */
export async function extractTextFromPDF(file: File): Promise<ExtractResult> {
  try {
    // Initialize worker on first use (when chrome APIs are available)
    initializeWorker()

    console.log('[PDF Extractor] Starting PDF extraction for:', file.name)
    console.log('[PDF Extractor] File size:', file.size, 'bytes')

    // Check if it's actually a PDF
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      return {
        success: false,
        error: 'Not a PDF file'
      }
    }

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    console.log('[PDF Extractor] File read as ArrayBuffer, size:', arrayBuffer.byteLength)

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    })

    const pdf = await loadingTask.promise
    console.log('[PDF Extractor] PDF loaded successfully')
    console.log('[PDF Extractor] Number of pages:', pdf.numPages)

    // Extract text from all pages
    let fullText = ''

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const textContent = await page.getTextContent()

      // Extract text items and join them
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')

      fullText += pageText + '\n\n'
      console.log('[PDF Extractor] Extracted page', pageNum, 'chars:', pageText.length)
    }

    // Clean up the extracted text
    fullText = cleanExtractedText(fullText)

    console.log('[PDF Extractor] Extraction complete. Total text length:', fullText.length)
    console.log('[PDF Extractor] Text preview:', fullText.substring(0, 200))

    return {
      success: true,
      text: fullText
    }
  } catch (error) {
    console.error('[PDF Extractor] Error extracting text from PDF:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Clean up extracted text by removing excessive whitespace
 */
function cleanExtractedText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove multiple newlines
    .replace(/\n{3,}/g, '\n\n')
    // Clean up around bullet points
    .replace(/\s*•\s*/g, ' • ')
    // Trim
    .trim()
}

/**
 * Check if a file is a PDF by name extension
 */
export function isPDFFile(file: File): boolean {
  const fileName = file.name.toLowerCase()
  return fileName.endsWith('.pdf') ||
         file.type === 'application/pdf' ||
         file.type.includes('pdf')
}

/**
 * Check if file content is a PDF (by reading first few bytes)
 */
export async function isPDFContent(file: File): Promise<boolean> {
  try {
    const slice = file.slice(0, 4)
    const arrayBuffer = await slice.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // PDF files start with "%PDF" (0x25 0x50 0x44 0x46)
    return uint8Array[0] === 0x25 &&
           uint8Array[1] === 0x50 &&
           uint8Array[2] === 0x44 &&
           uint8Array[3] === 0x46
  } catch {
    return false
  }
}
