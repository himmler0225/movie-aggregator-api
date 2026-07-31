import { Injectable } from '@nestjs/common';
import { I18N_INTERPOLATION_PATTERN } from '../shared/constants';
import { AppConfigService } from '../config';
import en from './locales/en.json';
import vi from './locales/vi.json';

export type SupportedLocale = 'vi' | 'en';

const LOCALES: Record<SupportedLocale, Record<string, unknown>> = { vi, en };

@Injectable()
export class I18nService {
  private readonly defaultLocale: SupportedLocale;
  constructor(appConfig: AppConfigService) {
    this.defaultLocale = appConfig.defaultLocale;
  }
  resolveLocale(acceptLanguage?: string): SupportedLocale {
    if (!acceptLanguage) return this.defaultLocale;
    const primary = acceptLanguage.split(',')[0]?.trim().toLowerCase() ?? '';
    if (primary.startsWith('en')) return 'en';
    if (primary.startsWith('vi')) return 'vi';
    return this.defaultLocale;
  }
  translate(
    key: string,
    options?: {
      locale?: SupportedLocale;
      args?: Record<string, string | number>;
    },
  ): string {
    const locale = options?.locale ?? this.defaultLocale;
    const value =
      this.lookup(LOCALES[locale], key) ?? this.lookup(LOCALES.en, key) ?? key;
    if (typeof value !== 'string') return key;
    return value.replace(I18N_INTERPOLATION_PATTERN, (_, name: string) => {
      const arg = options?.args?.[name];
      return arg === undefined ? `{{${name}}}` : String(arg);
    });
  }
  private lookup(tree: Record<string, unknown>, key: string): unknown {
    return key.split('.').reduce<unknown>((node, part) => {
      if (
        node &&
        typeof node === 'object' &&
        part in (node as Record<string, unknown>)
      ) {
        return (node as Record<string, unknown>)[part];
      }
      return undefined;
    }, tree);
  }
}
