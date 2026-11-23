// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test } from 'vitest';
import { findReportedEvent, forgetReportedEvents, rememberReportedEvent } from './incidents';

afterEach(forgetReportedEvents);

describe('reported events', () => {
  test('finds the event of an incident', () => {
    // Arrange
    rememberReportedEvent('aaaaaaaa', 'event-a');
    rememberReportedEvent('bbbbbbbb', 'event-b');

    // Act, Assert
    expect(findReportedEvent('aaaaaaaa')).toBe('event-a');
  });

  test('gives the latest event for an unknown incident or none', () => {
    // Arrange
    rememberReportedEvent('aaaaaaaa', 'event-a');
    rememberReportedEvent(undefined, 'event-b');

    // Act, Assert
    expect(findReportedEvent('zzzzzzzz')).toBe('event-b');
    expect(findReportedEvent()).toBe('event-b');
  });

  test('gives nothing before any report', () => {
    // Act, Assert
    expect(findReportedEvent('aaaaaaaa')).toBeUndefined();
  });

  test('keeps the newest event of an incident that reports twice', () => {
    // Arrange
    rememberReportedEvent('aaaaaaaa', 'first');
    rememberReportedEvent('aaaaaaaa', 'second');

    // Act, Assert
    expect(findReportedEvent('aaaaaaaa')).toBe('second');
  });

  test('keeps the last 50 incidents and forgets the oldest', () => {
    // Arrange
    for (let index = 0; index < 51; index += 1) {
      rememberReportedEvent(`incident-${index}`, `event-${index}`);
    }

    // Act, Assert
    expect(findReportedEvent('incident-1')).toBe('event-1');
    expect(findReportedEvent('incident-50')).toBe('event-50');
    expect(findReportedEvent('incident-0')).toBe('event-50');
  });

  test('does not forget an incident that was reported again before the limit', () => {
    // Arrange
    for (let index = 0; index < 50; index += 1) {
      rememberReportedEvent(`incident-${index}`, `event-${index}`);
    }
    rememberReportedEvent('incident-0', 'again');
    rememberReportedEvent('incident-50', 'event-50');

    // Act, Assert
    expect(findReportedEvent('incident-0')).toBe('again');
    expect(findReportedEvent('incident-1')).toBe('event-50');
  });

  test('forgets everything', () => {
    // Arrange
    rememberReportedEvent('aaaaaaaa', 'event-a');

    // Act
    forgetReportedEvents();

    // Assert
    expect(findReportedEvent('aaaaaaaa')).toBeUndefined();
  });
});
