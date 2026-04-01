/**
 * Generate a short, human-readable user code from a UUID.
 * Format: OS-XXXX (e.g. OS-3B7F)
 * Deterministic — same UUID always produces the same code.
 */
export function generateUserCode(uuid) {
  if (!uuid) return 'OS-0000';
  // Take characters from different positions in the UUID for uniqueness
  const clean = uuid.replace(/-/g, '').toUpperCase();
  const code = clean.charAt(0) + clean.charAt(4) + clean.charAt(8) + clean.charAt(12);
  return `OS-${code}`;
}
