/** Normalize to E.164-ish (+90...) for Turkey-focused MVP */
export function normalizePhoneE164(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (input.startsWith("+")) {
    return `+${digits}`;
  }
  if (digits.startsWith("90") && digits.length >= 12) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `+9${digits}`;
  }
  if (digits.length === 10) {
    return `+90${digits}`;
  }
  return `+${digits}`;
}
