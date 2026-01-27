// backend/src/utils/validation.ts

import { MoneyInt } from './money';

/**
 * Validate MoneyInt (for Mongoose validators)
 */
export function validateMoneyInt(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

/**
 * Validate Thai Tax ID (13 digits)
 */
export function validateThaiTaxId(taxId: string): boolean {
  if (!/^\d{13}$/.test(taxId)) return false;

  // Checksum validation (Thai Tax ID algorithm)
  const digits = taxId.split('').map(Number);
  const sum = digits.slice(0, 12).reduce((acc, digit, i) => {
    return acc + digit * (13 - i);
  }, 0);

  const checksum = (11 - (sum % 11)) % 10;
  return checksum === digits[12];
}

/**
 * Validate CorrelationId (UUID v4 format)
 */
export function validateCorrelationId(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}