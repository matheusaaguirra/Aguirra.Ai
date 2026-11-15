import type http from 'node:http';

export interface DesktopActionResult {
  ok: boolean;
  label?: string;
  target?: string;
  error?: string;
}

export function createDesktopServer(options?: {
  token?: string;
  launcher?: (actionKey: string) => DesktopActionResult;
}): http.Server;
