import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

// Special-purpose ranges from RFC 6890 that never reach the public internet, plus multicast.
const NON_PUBLIC_RANGES = new BlockList();
NON_PUBLIC_RANGES.addSubnet('0.0.0.0', 8, 'ipv4');
NON_PUBLIC_RANGES.addSubnet('10.0.0.0', 8, 'ipv4');
NON_PUBLIC_RANGES.addSubnet('100.64.0.0', 10, 'ipv4');
NON_PUBLIC_RANGES.addSubnet('127.0.0.0', 8, 'ipv4');
NON_PUBLIC_RANGES.addSubnet('169.254.0.0', 16, 'ipv4');
NON_PUBLIC_RANGES.addSubnet('172.16.0.0', 12, 'ipv4');
NON_PUBLIC_RANGES.addSubnet('192.0.0.0', 24, 'ipv4');
NON_PUBLIC_RANGES.addSubnet('192.168.0.0', 16, 'ipv4');
NON_PUBLIC_RANGES.addSubnet('198.18.0.0', 15, 'ipv4');
NON_PUBLIC_RANGES.addSubnet('224.0.0.0', 4, 'ipv4');
NON_PUBLIC_RANGES.addSubnet('240.0.0.0', 4, 'ipv4');
NON_PUBLIC_RANGES.addAddress('::', 'ipv6');
NON_PUBLIC_RANGES.addAddress('::1', 'ipv6');
NON_PUBLIC_RANGES.addSubnet('fc00::', 7, 'ipv6');
NON_PUBLIC_RANGES.addSubnet('fe80::', 10, 'ipv6');
NON_PUBLIC_RANGES.addSubnet('ff00::', 8, 'ipv6');

export type HostClass = 'public' | 'private' | 'unresolvable';

/**
 * Tells whether an IP address is routable on the public internet.
 * @param address an IPv4 or IPv6 literal without brackets; IPv4-mapped IPv6 forms are checked as IPv4
 * @returns false for loopback, link-local, private and reserved ranges, and for anything that is not an IP address
 */
export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 0) {
    return false;
  }
  return !NON_PUBLIC_RANGES.check(address, version === 6 ? 'ipv6' : 'ipv4');
}

/**
 * Classifies a URL host by where its addresses point. A name that resolves to a mix of public and
 * private addresses counts as private, since the connection could land on either.
 * @param hostname a URL hostname: an IP literal (IPv6 may keep its brackets) or a DNS name
 * @returns 'unresolvable' when the name has no address or the lookup fails
 */
export async function classifyHost(hostname: string): Promise<HostClass> {
  const bare = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (isIP(bare) !== 0) {
    return isPublicAddress(bare) ? 'public' : 'private';
  }

  let addresses;
  try {
    addresses = await lookup(bare, { all: true });
  } catch {
    return 'unresolvable';
  }
  if (addresses.length === 0) {
    return 'unresolvable';
  }
  return addresses.every(({ address }) => isPublicAddress(address)) ? 'public' : 'private';
}
