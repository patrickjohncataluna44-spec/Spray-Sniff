/**
 * Validation utilities for customer personal information:
 * - Email / Gmail
 * - Phone / Contact Number
 * - Full Name
 * - Birthdate & Age
 * - Address
 */

export interface CustomerPersonalInfo {
  firstName: string
  lastName: string
  email: string
  phone: string
  birthdate: string // YYYY-MM-DD
  age?: number
  address: string
  city: string
  postalCode: string
}

export interface ValidationResult {
  isValid: boolean
  errors: Record<string, string>
}

/**
 * Calculates accurate age from a YYYY-MM-DD birthdate string.
 */
export function calculateAge(birthdateStr: string): number | null {
  if (!birthdateStr) return null
  const birthDate = new Date(birthdateStr)
  if (isNaN(birthDate.getTime())) return null

  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const monthDiff = today.getMonth() - birthDate.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--
  }

  return age >= 0 ? age : null
}

/**
 * Validates Philippine or standard international phone numbers.
 * Supports: 09XXXXXXXXX (11 digits), +639XXXXXXXXX (13 chars), or 9XXXXXXXXX (10 digits).
 */
export function validateContactNumber(phone: string): { isValid: boolean; normalized: string; error?: string } {
  const clean = phone.trim().replace(/[\s\-()]/g, '')
  if (!clean) {
    return { isValid: false, normalized: '', error: 'Contact number is required.' }
  }

  // PH mobile regex: 09XXXXXXXXX or +639XXXXXXXXX
  const phPattern = /^(09\d{9}|\+639\d{9})$/
  // General standard mobile regex (10-15 digits with optional leading +)
  const generalPattern = /^\+?[0-9]{10,15}$/

  if (phPattern.test(clean)) {
    return { isValid: true, normalized: clean }
  }

  if (generalPattern.test(clean)) {
    return { isValid: true, normalized: clean }
  }

  return {
    isValid: false,
    normalized: clean,
    error: 'Enter a valid mobile number (e.g., 0917 123 4567 or +63 917 123 4567).',
  }
}

/**
 * Validates email, optionally checking for valid email format.
 */
export function validateEmailAddress(email: string): { isValid: boolean; error?: string } {
  const clean = email.trim().toLowerCase()
  if (!clean) {
    return { isValid: false, error: 'Email address is required.' }
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(clean)) {
    return { isValid: false, error: 'Please enter a valid email address.' }
  }

  return { isValid: true }
}

/**
 * Validates birthdate and age compliance (minimum 13 years old).
 */
export function validateBirthdate(birthdateStr: string, minAge = 13, maxAge = 120): {
  isValid: boolean
  age: number | null
  error?: string
} {
  if (!birthdateStr) {
    return { isValid: false, age: null, error: 'Birthdate is required.' }
  }

  const date = new Date(birthdateStr)
  if (isNaN(date.getTime())) {
    return { isValid: false, age: null, error: 'Please provide a valid date.' }
  }

  const today = new Date()
  if (date > today) {
    return { isValid: false, age: null, error: 'Birthdate cannot be in the future.' }
  }

  const calculatedAge = calculateAge(birthdateStr)
  if (calculatedAge === null) {
    return { isValid: false, age: null, error: 'Unable to calculate age from birthdate.' }
  }

  if (calculatedAge < minAge) {
    return {
      isValid: false,
      age: calculatedAge,
      error: `You must be at least ${minAge} years old. (Calculated age: ${calculatedAge})`,
    }
  }

  if (calculatedAge > maxAge) {
    return {
      isValid: false,
      age: calculatedAge,
      error: 'Please enter a valid birthdate.',
    }
  }

  return { isValid: true, age: calculatedAge }
}

/**
 * Validates full customer personal details.
 */
export function validateCustomerInformation(data: {
  firstName: string
  lastName: string
  email: string
  phone: string
  birthdate?: string
  address?: string
  city?: string
  postalCode?: string
  requireAddress?: boolean
  requireBirthdate?: boolean
}): ValidationResult {
  const errors: Record<string, string> = {}

  if (!data.firstName || data.firstName.trim().length < 2) {
    errors.firstName = 'First name must be at least 2 characters.'
  }

  if (!data.lastName || data.lastName.trim().length < 2) {
    errors.lastName = 'Last name must be at least 2 characters.'
  }

  const emailVal = validateEmailAddress(data.email)
  if (!emailVal.isValid && emailVal.error) {
    errors.email = emailVal.error
  }

  const phoneVal = validateContactNumber(data.phone)
  if (!phoneVal.isValid && phoneVal.error) {
    errors.phone = phoneVal.error
  }

  if (data.requireBirthdate || data.birthdate) {
    const birthVal = validateBirthdate(data.birthdate ?? '')
    if (!birthVal.isValid && birthVal.error) {
      errors.birthdate = birthVal.error
    }
  }

  if (data.requireAddress) {
    if (!data.address || data.address.trim().length < 5) {
      errors.address = 'Detailed street address is required.'
    }
    if (!data.city || data.city.trim().length < 2) {
      errors.city = 'City or Municipality is required.'
    }
    if (!data.postalCode || data.postalCode.trim().length < 3) {
      errors.postalCode = 'Postal / ZIP code is required.'
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  }
}
