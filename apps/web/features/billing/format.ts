export function formatThbKrwRate(value: number | string | null | undefined, fractionDigits = 2) {
  const numeric = Number(value ?? 0);
  const safeValue = Number.isFinite(numeric) ? numeric : 0;

  return `1 THB = ${safeValue.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })} KRW`;
}
