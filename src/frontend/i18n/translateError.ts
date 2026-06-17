/**
 * API és legacy hibaüzenetek fordítása i18n kulcsokra.
 * Külön fájlban, hogy az I18nProvider csak React komponenst exportáljon (fast refresh).
 */

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

/** Ismert API és legacy hibaüzenetek leképezése fordítási kulcsokra. */
export function translateError(message: string, t: TranslateFn): string {
  if (message.startsWith('errors.')) return t(message);

  const lower = message.toLowerCase();
  if (
    lower.includes('lejárt') ||
    lower.includes('munkamenet') ||
    lower.includes('expired') ||
    lower.includes('abgelaufen') ||
    lower.includes('invalid token')
  ) {
    return t('errors.sessionExpired');
  }
  if (
    lower.includes('bejelentkezés szükséges') ||
    lower.includes('unauthorized') ||
    lower.includes('authentication')
  ) {
    return t('errors.unauthorized');
  }
  if (
    lower.includes('jogosultság') ||
    lower.includes('adminisztrátor') ||
    lower.includes('forbidden') ||
    lower.includes('berechtigung') ||
    lower.includes('permission')
  ) {
    return t('errors.forbidden');
  }
  if (
    lower.includes('foglalt') ||
    lower.includes('belegt') ||
    lower.includes('busy') ||
    lower.includes('2-hour') ||
    lower.includes('2 óra') ||
    lower.includes('2-stunden')
  ) {
    return t('errors.roomBusy');
  }
  if (
    lower.includes('csatlakoz') ||
    lower.includes('server') ||
    lower.includes('reach') ||
    lower.includes('verbindung')
  ) {
    return t('errors.serverConnect');
  }
  if (
    lower.includes('email') ||
    lower.includes('jelszó') ||
    lower.includes('password') ||
    lower.includes('hibás') ||
    lower.includes('ungültig') ||
    lower.includes('invalid credentials')
  ) {
    return t('errors.invalidCredentials');
  }
  if (lower.includes('ment') || lower.includes('save') || lower.includes('speicher')) {
    return t('errors.saveError');
  }
  if (lower.includes('törl') || lower.includes('delete') || lower.includes('lösch')) {
    return t('errors.deleteError');
  }
  if (message.startsWith('HTTP ')) {
    const status = message.replace(/\D/g, '');
    return t('errors.http', { status });
  }
  return message;
}
