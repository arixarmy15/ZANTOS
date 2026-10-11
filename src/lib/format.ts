import type { FieldKind } from "@/lib/domain/fields";

/**
 * Locale used for data values (amounts, dates, codes). Arabic uses Latin digits because
 * trade documents print Latin digits and evidence must look like the paper (DESIGN.md §11).
 */
export function dataLocale(locale: string): string {
  return locale === "ar" || locale.startsWith("ar-") ? `${locale}-u-nu-latn` : locale;
}

function fractionDigits(decimal: string): number {
  const dot = decimal.indexOf(".");
  return dot === -1 ? 0 : decimal.length - dot - 1;
}

export function formatDecimal(value: string, locale: string): string {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  const digits = Math.min(fractionDigits(value), 6);
  return new Intl.NumberFormat(dataLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}

export function formatIsoDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(dataLocale(locale), {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function displayName(type: "currency" | "region" | "language", code: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type, fallback: "none" }).of(code) ?? null;
  } catch {
    return null;
  }
}

export function languageName(code: string, locale: string): string {
  return displayName("language", code, locale) ?? code;
}

/** Human-readable form of a normalized value, formatted for the interface language. */
export function formatNormalized(kind: FieldKind, value: string, locale: string): string {
  switch (kind) {
    case "amount":
    case "quantity":
      return formatDecimal(value, locale);
    case "date":
      return formatIsoDate(value, locale);
    case "currency": {
      const name = displayName("currency", value, locale);
      return name && name !== value ? `${value} · ${name}` : value;
    }
    case "country": {
      const name = displayName("region", value, locale);
      return name && name !== value ? `${value} · ${name}` : value;
    }
    default:
      return value;
  }
}

export function formatTimestamp(iso: string, locale: string): string {
  // dateStyle/timeStyle cannot be combined with timeZoneName, so components are explicit.
  return new Intl.DateTimeFormat(dataLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatFileSize(bytes: number, locale: string): string {
  const megabytes = bytes / (1024 * 1024);
  const [value, unit] = megabytes >= 1 ? [megabytes, "megabyte"] : [bytes / 1024, "kilobyte"];
  return new Intl.NumberFormat(dataLocale(locale), {
    style: "unit",
    unit,
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}
