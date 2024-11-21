import { useCallback } from 'react';
import de from '@/locales/de.json';

type NestedKeyOf<ObjectType extends object> = {
  [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
    ? `${Key}.${NestedKeyOf<ObjectType[Key]>}`
    : `${Key}`
}[keyof ObjectType & (string | number)];

type TranslationParams = Record<string, string | number>;

export const useTranslation = () => {
  const t = useCallback((key: NestedKeyOf<typeof de>, params?: TranslationParams) => {
    const keys = key.split('.');
    let value: any = de;
    
    for (const k of keys) {
      value = value[k];
      if (value === undefined) {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }
    
    if (params) {
      return Object.entries(params).reduce((str, [key, value]) => {
        return str.replace(new RegExp(`{${key}}`, 'g'), String(value));
      }, value);
    }
    
    return value as string;
  }, []);

  return { t };
}; 