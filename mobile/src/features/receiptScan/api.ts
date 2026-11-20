import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { ReceiptScanResponse, ScanLanguage } from './types';

/**
 * Base URL of the FastAPI server.
 * 1. EXPO_PUBLIC_API_URL if set (use this for Cuisigo staging/prod).
 * 2. In dev, the machine running `expo start` on port 8000 — works from a real phone on the same Wi-Fi.
 */
export function defaultApiUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host && Platform.OS !== 'web') return `http://${host}:8000`;
  return 'http://localhost:8000';
}

export class ScanError extends Error {}

export interface ScanOptions {
  lang?: ScanLanguage;
  apiUrl?: string;
  /** Extra headers, e.g. Cuisigo's `Authorization: Bearer ...`. */
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function scanReceipt(imageUri: string, opts: ScanOptions = {}): Promise<ReceiptScanResponse> {
  const { lang = 'en', apiUrl = defaultApiUrl(), headers = {}, signal } = opts;

  const form = new FormData();
  if (Platform.OS === 'web') {
    // On web the picker gives a blob:/data: URI; send a real Blob.
    const blob = await (await fetch(imageUri)).blob();
    form.append('image', blob, 'receipt.jpg');
  } else {
    // React Native's FormData accepts this file descriptor shape.
    form.append('image', { uri: imageUri, name: 'receipt.jpg', type: 'image/jpeg' } as unknown as Blob);
  }

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/receipts/scan?lang=${lang}`, { method: 'POST', body: form, headers, signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ScanError(`Can't reach the server at ${apiUrl}. Is the API running?`);
  }

  if (!res.ok) {
    let detail = `Scan failed (${res.status}).`;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') detail = body.detail;
    } catch {
      // non-JSON error body; keep generic message
    }
    throw new ScanError(detail);
  }
  return (await res.json()) as ReceiptScanResponse;
}
