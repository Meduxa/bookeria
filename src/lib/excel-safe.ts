// Text that people typed (a client's name on the booking page…) can start with
// "=", "+", "-" or "@"; Excel would then run it as a formula when the owner opens
// an export. A leading apostrophe makes Excel show it as plain text.
export const excelSafe = (s: string) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);
