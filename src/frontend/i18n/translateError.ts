type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

const ERROR_PATTERNS: [string, string[]][] = [
  ['errors.sessionExpired', ['lejárt', 'munkamenet', 'expired', 'abgelaufen', 'invalid token']],
  ['errors.unauthorized', ['bejelentkezés szükséges', 'unauthorized', 'authentication']],
  ['errors.forbidden', ['jogosultság', 'adminisztrátor', 'forbidden', 'berechtigung', 'permission']],
  ['errors.roomBusy', ['foglalt', 'belegt', 'busy', '2-hour', '2 óra', '2-stunden']],
  ['errors.serverConnect', ['csatlakoz', 'server', 'reach', 'verbindung']],
  ['errors.invalidCredentials', ['email', 'jelszó', 'password', 'hibás', 'ungültig', 'invalid credentials']],
  ['errors.saveError', ['ment', 'save', 'speicher']],
  ['errors.deleteError', ['törl', 'delete', 'lösch']],
];

/** Match legacy messages in priority order; translation keys pass straight through. */
export function translateError(message: string, t: TranslateFn): string {
  if (message.startsWith('errors.')) return t(message);
  const lower = message.toLowerCase();
  const match = ERROR_PATTERNS.find(([, fragments]) => fragments.some((fragment) => lower.includes(fragment)));
  if (match) return t(match[0]);
  if (message.startsWith('HTTP ')) return t('errors.http', { status: message.replace(/\D/g, '') });
  return message;
}
