import { useSdk } from '../../_sdk/react';
import { STRINGS, type StringKey } from './strings';

/** The add-on's own words for the reader's language (Urdu, else English). */
export function useStrings() {
  const { lang } = useSdk();
  const table = lang === 'ur' ? STRINGS.ur : STRINGS.en;
  return (k: StringKey) => table[k] ?? STRINGS.en[k];
}
