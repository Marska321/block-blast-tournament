/** Canonical storage keeps formatting from bypassing duplicate-contact checks. */
export function normalizeClaimPhone(value: string): string | null {
  const phone = value.trim().replace(/[\s()-]/g, "").replace(/^00/, "+");
  return /^\+[1-9][0-9]{7,14}$/.test(phone) ? phone : null;
}

export async function askClaimPhone(
  question: (prompt: string) => Promise<string>,
  explain: (message: string) => void,
): Promise<string> {
  while (true) {
    const phone = normalizeClaimPhone(
      await question("Sender number in international format (+27…): "),
    );
    if (phone) return phone;
    explain(
      "Include + and the country code. For a South African number, replace the initial 0 with +27. Spaces, hyphens and parentheses are accepted.",
    );
  }
}
