import { MESSAGES, type Locale } from './messages';

export class I18n {
  readonly locale: Locale;

  constructor(locale?: Locale) {
    this.locale = locale ?? (navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en');
    document.documentElement.lang = this.locale;
  }

  t(key: string, values: Record<string, string | number> = {}): string {
    const template = MESSAGES[this.locale][key] ?? MESSAGES.en[key] ?? key;
    return Object.entries(values).reduce(
      (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
      template
    );
  }
}

export const i18n = new I18n();
