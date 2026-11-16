import { createContext, useContext, type ReactNode } from 'react';
import type { UiSdk } from './types';

/**
 * React access to the SDK. In ilm.red the app mounts `SdkContext.Provider` with real hooks (the import
 * step generates that adapter); in tests use `TestSdkProvider` from `./testing.tsx`.
 */
export const SdkContext = createContext<UiSdk | null>(null);

export function SdkProvider({ value, children }: { value: UiSdk; children: ReactNode }) {
  return <SdkContext.Provider value={value}>{children}</SdkContext.Provider>;
}

export function useSdk(): UiSdk {
  const sdk = useContext(SdkContext);
  if (!sdk) throw new Error('useSdk: no SdkProvider above this component');
  return sdk;
}
