export function formatSalaryText(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
}
