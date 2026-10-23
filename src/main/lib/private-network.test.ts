// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { classifyHost, isPublicAddress } from './private-network';

vi.mock(import('node:dns/promises'), () => ({ lookup: vi.fn() }));

// Pins the `all: true` overload, the only one the code under test uses.
const mockedLookup = vi.mocked(lookup as (hostname: string, options: { all: true }) => Promise<LookupAddress[]>);

afterEach(() => {
  mockedLookup.mockReset();
});

describe('isPublicAddress', () => {
  test.each([
    '127.0.0.1',
    '127.255.255.254',
    '10.0.0.1',
    '10.255.255.255',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '192.168.255.255',
    '169.254.1.1',
    '169.254.169.254',
    '169.254.255.255',
    '100.64.0.1',
    '100.127.255.255',
    '0.0.0.0',
    '0.255.255.255',
    '192.0.0.1',
    '192.0.0.255',
    '198.18.0.1',
    '198.19.255.255',
    '224.0.0.1',
    '239.255.255.255',
    '240.0.0.1',
    '255.255.255.255',
    '::',
    '::1',
    'fe80::1',
    'febf:ffff::1',
    'fc00::1',
    'fd12:3456::1',
    'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
    'ff02::1',
    'ffff::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '::ffff:c0a8:101',
  ])('%s is not public', (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  test.each([
    '8.8.8.8',
    '1.1.1.1',
    '9.255.255.255',
    '11.0.0.1',
    '172.15.255.255',
    '172.32.0.1',
    '100.63.255.255',
    '100.128.0.1',
    '169.253.255.255',
    '169.255.0.0',
    '192.0.1.0',
    '192.167.255.255',
    '192.169.0.0',
    '198.17.255.255',
    '198.20.0.0',
    '223.255.255.255',
    '2606:4700::1111',
    '2001:4860:4860::8888',
    '::ffff:8.8.8.8',
  ])('%s is public', (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  test.each(['', 'localhost', 'example.com', '[::1]', '999.1.1.1', 'not an ip'])('%j is not an address, so not public', (input) => {
    expect(isPublicAddress(input)).toBe(false);
  });
});

describe('classifyHost', () => {
  test('a private IPv4 literal is classified without a lookup', async () => {
    // Act
    const result = await classifyHost('10.0.0.1');

    // Assert
    expect(result).toBe('private');
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  test('a public IPv4 literal is public', async () => {
    // Act
    const result = await classifyHost('8.8.8.8');

    // Assert
    expect(result).toBe('public');
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  test('a bracketed IPv6 literal keeps its meaning', async () => {
    // Act
    const result = await classifyHost('[::1]');

    // Assert
    expect(result).toBe('private');
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  test('a bare public IPv6 literal is public', async () => {
    // Act
    const result = await classifyHost('2606:4700::1111');

    // Assert
    expect(result).toBe('public');
  });

  test('a name that resolves to public addresses only is public', async () => {
    // Arrange
    mockedLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
    ]);

    // Act
    const result = await classifyHost('example.com');

    // Assert
    expect(result).toBe('public');
    expect(mockedLookup).toHaveBeenCalledWith('example.com', { all: true });
  });

  test('a name that resolves to a private address is private', async () => {
    // Arrange
    mockedLookup.mockResolvedValue([{ address: '192.168.0.10', family: 4 }]);

    // Act
    const result = await classifyHost('intranet.example');

    // Assert
    expect(result).toBe('private');
  });

  test('one private address among public ones makes the name private', async () => {
    // Arrange
    mockedLookup.mockResolvedValue([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 },
    ]);

    // Act
    const result = await classifyHost('rebinding.example');

    // Assert
    expect(result).toBe('private');
  });

  test('a name with no address is unresolvable', async () => {
    // Arrange
    mockedLookup.mockResolvedValue([]);

    // Act
    const result = await classifyHost('empty.example');

    // Assert
    expect(result).toBe('unresolvable');
  });

  test('a failed lookup is unresolvable', async () => {
    // Arrange
    mockedLookup.mockRejectedValue(Object.assign(new Error('getaddrinfo ENOTFOUND missing.invalid'), { code: 'ENOTFOUND' }));

    // Act
    const result = await classifyHost('missing.invalid');

    // Assert
    expect(result).toBe('unresolvable');
  });
});
