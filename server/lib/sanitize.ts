export function sanitizeBrandText(raw: string | undefined | null): string {
  if (!raw) return "";
  let value = String(raw);
  value = value.replace(/smm[\s_\-]*bin\.com/gi, "smmup.co.in");
  value = value.replace(/[\u{1D5E6}\u{1D5B2}\u{1D412}s][\u{1D5E0}\u{1D5C6}\u{1D40C}m]{2}\s*[\u{1D5D5}\u{1D5BB}\u{1D401}b][\u{1D5DC}\u{1D5C2}\u{1D408}i][\u{1D5E1}\u{1D5C7}\u{1D40D}n]/giu, "SMM UP");
  value = value.replace(/smm[\s_\-]*bin/gi, "SMM UP");
  const normalized = value.normalize("NFKD");
  if (/smm[\s_\-]*bin/i.test(normalized)) {
    value = normalized
      .replace(/smm[\s_\-]*bin\.com/gi, "smmup.co.in")
      .replace(/smm[\s_\-]*bin/gi, "SMM UP");
  }
  return value;
}
