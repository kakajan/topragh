import { en } from './en';
import { fa, type Messages } from './fa';

export type Locale = 'fa' | 'en';

export const locales: Locale[] = ['fa', 'en'];

export const messages: Record<Locale, Messages> = {
  fa,
  en,
};

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}

export function localePath(locale: Locale, path = ''): string {
  const clean = path.replace(/^\/+/, '');
  if (locale === 'fa') {
    return clean ? `/${clean}` : '/';
  }
  return clean ? `/en/${clean}` : '/en/';
}

export function switchLocalePath(current: Locale, path: string): string {
  const target: Locale = current === 'fa' ? 'en' : 'fa';
  const normalized = path
    .replace(/^\/en(?=\/|$)/, '')
    .replace(/^\/+/, '');
  return localePath(target, normalized);
}
