/**
 * PHONE NUMBER PARSER
 *
 * Uses libphonenumber-js to parse phone numbers and extract:
 * - Country code (e.g., +880)
 * - Area code (e.g., 018 for Bangladesh)
 * - Local number
 * - Country info
 */

import { parsePhoneNumber } from 'libphonenumber-js'

export interface ParsedPhoneNumber {
  fullNumber: string           // Original full number
  countryCode: string          // Country code with + (e.g., +880)
  countryCallingCode: string   // Country code without + (e.g., 880)
  country: string              // Country code (e.g., BD, US)
  areaCode: string             // Area/operator code (e.g., 018)
  localNumber: string          // Local number without country/area code
  nationalNumber: string       // Number without country code
  isValid: boolean             // Whether the number is valid
  format: {
    international: string      // +880 18 1234-5678
    national: string           // 01812-345678
    e164: string               // +8801812345678
  }
}

/**
 * Parse phone number using libphonenumber-js
 */
export function parsePhone(phoneNumber: string, defaultCountry = 'BD'): ParsedPhoneNumber {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return getEmptyParsed()
  }

  // Clean the number
  const cleaned = phoneNumber.trim()

  try {
    const parsed = parsePhoneNumber(cleaned, defaultCountry as any)

    if (!parsed) {
      return getEmptyParsed(phoneNumber)
    }

    // Extract country info
    const country = parsed.country || defaultCountry
    const countryCallingCode = parsed.countryCallingCode
    const countryCode = `+${countryCallingCode}`

    // Get national number (without country code)
    const nationalNumber = parsed.nationalNumber?.toString() || ''

    // Extract area code for Bangladesh numbers
    let areaCode = ''
    let localNumber = nationalNumber

    if (country === 'BD') {
      // Bangladesh numbers: 018XXXXXXX or 18XXXXXXX
      // Area code is first 3 digits (operator code)
      if (nationalNumber.startsWith('0') && nationalNumber.length >= 11) {
        areaCode = nationalNumber.substring(0, 3)
        localNumber = nationalNumber.substring(3)
      } else if (!nationalNumber.startsWith('0') && nationalNumber.length === 10) {
        // Number without leading 0, add it for area code
        areaCode = '0' + nationalNumber.substring(0, 2)
        localNumber = nationalNumber.substring(2)
      } else if (nationalNumber.length >= 10) {
        // Fallback: try to extract area code
        areaCode = nationalNumber.substring(0, 3)
        localNumber = nationalNumber.substring(3)
      }
    } else if (country === 'US' || country === 'CA') {
      // US/Canada: (555) 123-4567
      // Area code is first 3 digits
      if (nationalNumber.length === 10) {
        areaCode = nationalNumber.substring(0, 3)
        localNumber = nationalNumber.substring(3)
      }
    } else {
      // For other countries, try to extract area code
      // This varies by country, so we'll use a simple heuristic
      if (nationalNumber.length >= 10) {
        areaCode = nationalNumber.substring(0, 3)
        localNumber = nationalNumber.substring(3)
      }
    }

    return {
      fullNumber: phoneNumber,
      countryCode,
      countryCallingCode,
      country,
      areaCode,
      localNumber,
      nationalNumber,
      isValid: parsed.isValid(),
      format: {
        international: parsed.formatInternational(),
        national: parsed.formatNational(),
        e164: parsed.number
      }
    }
  } catch (error) {
    console.warn('[PhoneParser] Failed to parse phone number:', error)
    return getEmptyParsed(phoneNumber)
  }
}

/**
 * Get country code from phone number
 */
export function getCountryCode(phoneNumber: string, defaultCountry = 'BD'): string {
  return parsePhone(phoneNumber, defaultCountry).countryCode
}

/**
 * Get area code from phone number
 */
export function getAreaCode(phoneNumber: string, defaultCountry = 'BD'): string {
  return parsePhone(phoneNumber, defaultCountry).areaCode
}

/**
 * Get local number without country/area code
 */
export function getLocalNumber(phoneNumber: string, defaultCountry = 'BD'): string {
  return parsePhone(phoneNumber, defaultCountry).localNumber
}

/**
 * Get empty parsed result for invalid numbers
 */
function getEmptyParsed(originalNumber = ''): ParsedPhoneNumber {
  return {
    fullNumber: originalNumber,
    countryCode: '',
    countryCallingCode: '',
    country: '',
    areaCode: '',
    localNumber: '',
    nationalNumber: '',
    isValid: false,
    format: {
      international: originalNumber,
      national: originalNumber,
      e164: originalNumber
    }
  }
}

/**
 * Enhance CV data with parsed phone information
 * This makes it easier for AI to fill forms with separate phone fields
 */
export function enhanceCVDataWithPhoneInfo(cvData: any, defaultCountry = 'BD'): any {
  if (!cvData?.personal?.phone) {
    return cvData
  }

  const parsed = parsePhone(cvData.personal.phone, defaultCountry)

  return {
    ...cvData,
    personal: {
      ...cvData.personal,
      phone: cvData.personal.phone,
      phoneParsed: {
        countryCode: parsed.countryCode,
        countryCallingCode: parsed.countryCallingCode,
        country: parsed.country,
        areaCode: parsed.areaCode,
        localNumber: parsed.localNumber,
        nationalNumber: parsed.nationalNumber,
        formatted: {
          international: parsed.format.international,
          national: parsed.format.national,
          e164: parsed.format.e164
        }
      }
    }
  }
}

/**
 * Example usage:
 *
 * const phone = "+8801712345678"
 * const parsed = parsePhone(phone)
 *
 * console.log(parsed.countryCode)           // "+880"
 * console.log(parsed.countryCallingCode)    // "880"
 * console.log(parsed.country)               // "BD"
 * console.log(parsed.areaCode)              // "017"
 * console.log(parsed.localNumber)           // "12345678"
 * console.log(parsed.format.international)  // "+880 17 1234-5678"
 * console.log(parsed.format.national)       // "01712-345678"
 * console.log(parsed.isValid)               // true
 */
