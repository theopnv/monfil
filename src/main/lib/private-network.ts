// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

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
// ::/96 covers the unspecified and loopback addresses and the deprecated IPv4-compatible form.
NON_PUBLIC_RANGES.addSubnet('::', 96, 'ipv6');
// IPv4-translated (SIIT) addresses embed an IPv4 address that BlockList does not unwrap, unlike the ::ffff:0:0/96 mapped form.
NON_PUBLIC_RANGES.addSubnet('::ffff:0:0:0', 96, 'ipv6');
// NAT64 and 6to4 turn an IPv6 address into a connection to the embedded IPv4 address, private ones included.
NON_PUBLIC_RANGES.addSubnet('64:ff9b::', 96, 'ipv6');
NON_PUBLIC_RANGES.addSubnet('64:ff9b:1::', 48, 'ipv6');
NON_PUBLIC_RANGES.addSubnet('2002::', 16, 'ipv6');
NON_PUBLIC_RANGES.addSubnet('fc00::', 7, 'ipv6');
NON_PUBLIC_RANGES.addSubnet('fe80::', 10, 'ipv6');
NON_PUBLIC_RANGES.addSubnet('ff00::', 8, 'ipv6');

export type HostClass = 'public' | 'private' | 'unresolvable';

/**
 * Tells whether an IP address is routable on the public internet. Takes a literal without brackets; IPv4-mapped
 * IPv6 forms are checked as IPv4, and anything that is not an IP address is not public.
 */
export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 0) {
    return false;
  }
  return !NON_PUBLIC_RANGES.check(address, version === 6 ? 'ipv6' : 'ipv4');
}

/**
 * Classifies a URL host by where its addresses point. A name that resolves to a mix of public and private
 * addresses counts as private, since the connection could land on either. An IPv6 literal may keep its brackets;
 * 'unresolvable' means the name has no address or the lookup failed.
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
