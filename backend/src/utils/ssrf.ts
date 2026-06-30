import dns from 'dns';
import { promisify } from 'util';
import { parse } from 'url';

const lookupAsync = promisify(dns.lookup);

/**
 * Checks if an IP address is a private, loopback, or local IP (RFC 1918, etc.).
 * Helps prevent SSRF (Server-Side Request Forgery) attacks.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4 Loopback (127.0.0.0/8)
  if (/^127\.\d+\.\d+\.\d+$/.test(ip)) return true;

  // IPv6 Loopback
  if (ip === '::1' || ip === '0:0:0:0:0:0:0:1') return true;

  // IPv4 Private Ranges (RFC 1918)
  // 10.0.0.0 - 10.255.255.255
  // 172.16.0.0 - 172.31.255.255
  // 192.168.0.0 - 192.168.255.255
  if (/^10\.\d+\.\d+\.\d+$/.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(ip)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(ip)) return true;

  // IPv4 Link-Local (169.254.0.0/16)
  if (/^169\.254\.\d+\.\d+$/.test(ip)) return true;

  // IPv4 Shared Address Space (100.64.0.0/10)
  if (/^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.\d+\.\d+$/.test(ip)) return true;

  // IPv6 Unique Local Address (fc00::/7)
  if (/^[fF][cCdD][0-9a-fA-F]{2}:/.test(ip)) return true;

  // IPv6 Link-Local (fe80::/10)
  if (/^[fF][eE][89abAB][0-9a-fA-F]:/.test(ip)) return true;

  return false;
}

/**
 * Validates if a URL is safe to call from the backend.
 * Rules:
 * - Must use HTTPS protocol
 * - Must not be localhost, 127.0.0.1, or any internal/private IP address
 */
export async function validateWebhookUrl(urlStr: string): Promise<{ isValid: boolean; reason?: string }> {
  try {
    const parsedUrl = parse(urlStr);
    
    // Ensure HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return { isValid: false, reason: 'URL must use HTTPS protocol' };
    }

    const hostname = parsedUrl.hostname;
    if (!hostname) {
      return { isValid: false, reason: 'Malformed URL hostname' };
    }

    // Direct loopback hostname checks
    if (hostname.toLowerCase() === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
      return { isValid: false, reason: 'Localhost and loopback addresses are prohibited' };
    }

    // Resolve DNS to verify IP is not internal/private
    const lookupResult = await lookupAsync(hostname);
    const ip = lookupResult.address;

    if (isPrivateIp(ip)) {
      return { isValid: false, reason: 'Internal/Private network addresses are prohibited (SSRF Protection)' };
    }

    return { isValid: true };
  } catch (error) {
    return { isValid: false, reason: 'Failed to resolve URL hostname: ' + (error as Error).message };
  }
}
