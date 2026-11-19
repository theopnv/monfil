// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { createI18n } from '../../shared/i18n/create-i18n';
import { errorDetails, translateError, translateErrorWithDetails, translateFeedFailure } from './error-text';

const t = createI18n('en').getFixedT('en', 'errors');

describe('translateError', () => {
  test('uses the sentence of the error name', () => {
    // Act
    const text = translateError(t, { name: 'FEED_NOT_FOUND' });

    // Assert
    expect(text).toBe('That feed no longer exists.');
  });

  test('picks the variant that the reason names and fills it with the other params', () => {
    // Act
    const text = translateError(t, { name: 'GENERIC_FETCH_ERROR', params: { reason: 'rateLimited', status: 429 } });

    // Assert
    expect(text).toBe('The server is rate limiting requests (HTTP 429).');
  });

  test('falls back to the sentence of the name when the reason has no variant', () => {
    // Act
    const text = translateError(t, { name: 'NETWORK_ERROR', params: { reason: 'a-reason-that-does-not-exist' } });

    // Assert
    expect(text).toBe('Monfil could not reach the server.');
  });

  test('falls back to a generic sentence for a name it does not know', () => {
    // Act
    const text = translateError(t, { name: 'SOMETHING_NEW' });

    // Assert
    expect(text).toBe('Something went wrong.');
  });

  test('chooses the singular or plural sentence by count and joins a list with the language rules', () => {
    // Act
    const one = translateError(t, { name: 'UNSUPPORTED_FORMAT', params: { reason: 'conferenceIgnoredFilters', filters: ['region'], count: 1 } });
    const many = translateError(t, { name: 'UNSUPPORTED_FORMAT', params: { reason: 'conferenceIgnoredFilters', filters: ['region', 'callForPapers'], count: 2 } });

    // Assert
    expect(one).toBe('Monfil cannot apply the region filter from developers.events. Remove it from the link, or type topics and places.');
    expect(many).toBe('Monfil cannot apply the region and callForPapers filters from developers.events. Remove them from the link, or type topics and places.');
  });

  test('joins suggestions with "or"', () => {
    // Act
    const text = translateError(t, { name: 'UNSUPPORTED_FORMAT', params: { reason: 'conferenceUnknownTopicSuggest', terms: ['"devopz"', '"jva"'], suggestions: ['devops', 'java', 'testing'] } });

    // Assert
    expect(text).toBe('No conference has the topic "devopz" or "jva". Try devops, java, or testing.');
  });

  test('shows a name that holds quotes without escaping it', () => {
    // Act
    const text = translateError(t, { name: 'DUPLICATE_NAME', params: { reason: 'search', name: 'Tom & "Jerry"' } });

    // Assert
    expect(text).toBe('A saved search named "Tom & "Jerry"" already exists.');
  });
});

describe('errorDetails', () => {
  test.each([
    { name: 'DB_ERROR' },
    { name: 'FS_ERROR' },
    { name: 'BACKUP_FAILED' },
    { name: 'MALFORMED_XML' },
    { name: 'NETWORK_ERROR' },
    { name: 'NOT_ALLOWED_OR_ABORTED_ERROR' },
    { name: 'PARSE_ERROR' },
    { name: 'UNKNOWN_ERROR' },
  ])('returns the raw text of a $name', ({ name }) => {
    // Act
    const details = errorDetails({ name, message: 'SQLITE_BUSY: raw detail' });

    // Assert
    expect(details).toBe('SQLITE_BUSY: raw detail');
  });

  test('returns nothing when a variant sentence already tells the whole story', () => {
    // Act
    const details = errorDetails({ name: 'NETWORK_ERROR', message: 'Could not resolve a.example.', params: { reason: 'unresolvable', host: 'a.example' } });

    // Assert
    expect(details).toBeUndefined();
  });

  test('returns nothing for an error whose message is only the English sentence', () => {
    // Act
    const details = errorDetails({ name: 'FEED_NOT_FOUND', message: 'No feed found with id 4' });

    // Assert
    expect(details).toBeUndefined();
  });

  test('returns nothing when the message is empty', () => {
    // Act
    const details = errorDetails({ name: 'DB_ERROR', message: '' });

    // Assert
    expect(details).toBeUndefined();
  });
});

describe('translateErrorWithDetails', () => {
  test('puts the Details line after the sentence', () => {
    // Act
    const text = translateErrorWithDetails(t, { name: 'FS_ERROR', message: 'EACCES: permission denied' });

    // Assert
    expect(text).toBe('Monfil could not read or write the file. Details: EACCES: permission denied');
  });

  test('gives the sentence alone when there are no details', () => {
    // Act
    const text = translateErrorWithDetails(t, { name: 'CANCELLED', message: 'Export cancelled.' });

    // Assert
    expect(text).toBe('The action was cancelled.');
  });
});

describe('translateFeedFailure', () => {
  test('translates a failure that has a code', () => {
    // Act
    const text = translateFeedFailure(t, { code: 'BLOCKED_URL_ERROR', params: { reason: 'private' } });

    // Assert
    expect(text).toBe('This address is not on the public internet.');
  });

  test.each([
    { name: 'null', failure: { code: null, params: null } },
    { name: 'undefined', failure: {} },
  ])('gives a row stored before error codes existed a generic sentence when the code is $name', ({ failure }) => {
    // Act
    const text = translateFeedFailure(t, failure);

    // Assert
    expect(text).toBe('Monfil could not read this feed.');
  });
});
