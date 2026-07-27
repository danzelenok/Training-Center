// US-only phone normalization (this product only serves the American market).

/** Parses free-form input into E.164 (+1XXXXXXXXXX), or null if not a valid 10-digit US number. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let tenDigit: string;
  if (digits.length === 10) {
    tenDigit = digits;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    tenDigit = digits.slice(1);
  } else {
    return null;
  }
  return `+1${tenDigit}`;
}

/** Formats a stored phone value (E.164 or legacy free-form) for display, e.g. "+1 (555) 123-4567". */
export function formatPhoneDisplay(stored: string): string {
  const digits = stored.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  if (digits.length !== 10) return stored;
  return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** Formats digits-as-typed into "(555) 123-4567" for a live input mask, capped at 10 digits. */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length > 6) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length > 3) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  if (digits.length > 0) return `(${digits}`;
  return "";
}
