/**
 * Share code generation utilities
 * Format: SYNCS-XXXXX (5 alphanumeric chars, excluding confusing ones)
 */

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes I, O, 0, 1
const PREFIX = 'SYNCS-';
const CODE_LENGTH = 5;

/**
 * Generate a random share code
 * @returns {string} e.g., "SYNCS-K7M2P"
 */
export function generateShareCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return PREFIX + code;
}

/**
 * Validate share code format
 * @param {string} code
 * @returns {boolean}
 */
export function validateShareCode(code) {
  if (!code || typeof code !== 'string') return false;
  const normalized = code.toUpperCase().trim();
  const regex = new RegExp(`^${PREFIX}[${CHARS}]{${CODE_LENGTH}}$`);
  return regex.test(normalized);
}

/**
 * Normalize share code (uppercase, trim)
 * @param {string} code
 * @returns {string}
 */
export function normalizeShareCode(code) {
  return code.toUpperCase().trim();
}

/**
 * Extract the suffix part of share code (without SYNCS-)
 * @param {string} code
 * @returns {string}
 */
export function getCodeSuffix(code) {
  const normalized = normalizeShareCode(code);
  return normalized.replace(PREFIX, '');
}

/**
 * Format share code for display with spacing
 * @param {string} code
 * @returns {string} e.g., "SYNCS-K7M2P" -> "SYNCS-K7M2P" (or "SYNCS-K7M-2P" for readability)
 */
export function formatShareCodeForDisplay(code) {
  const normalized = normalizeShareCode(code);
  const suffix = getCodeSuffix(normalized);
  // Add visual grouping: SYNCS-K7M-2P
  if (suffix.length === 5) {
    return `${PREFIX}${suffix.slice(0, 3)}-${suffix.slice(3)}`;
  }
  return normalized;
}