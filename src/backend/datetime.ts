/** Format MariaDB values using the local date/time, without a UTC conversion. */
export function formatDate(value: unknown): string {
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export function formatTime(value: unknown): string {
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
  const text = String(value);
  return text.match(/(\d{2}:\d{2})/)?.[1] ?? text;
}

export function formatDatetime(value: Date): string {
  return `${formatDate(value)} ${formatTime(value)}:${String(value.getSeconds()).padStart(2, '0')}`;
}
