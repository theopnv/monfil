import type { Result } from '../utils.ts'

interface GenericFetchError extends Error {
    name: 'GENERIC_FETCH_ERROR';
}

interface NetworkError extends Error {
    name: 'NETWORK_ERROR';
}

interface NotAllowedOrAbortedError extends Error {
    name: 'NOT_ALLOWED_OR_ABORTED_ERROR';
}

export type FetchUrlError = GenericFetchError | NetworkError | NotAllowedOrAbortedError;
type FetchUrlResult = Result<string, FetchUrlError>;

export async function fetchUrl(url: string): Promise<FetchUrlResult> {
    try {
        const response = await fetch(url)
        if (!response.ok) {
            return { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: `${response.status}: ${response.statusText}` } }
        }
        return { success: true, data: await response.text() };

    } catch (error) {
        if (error instanceof TypeError) {
            return { success: false, error: { name: 'NETWORK_ERROR', message: error.message } }
        } else if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')) {
            return { success: false, error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'Request was aborted or not allowed' } }
        }
        else {
            return { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: 'An unknown error occurred' } }
        }
    }
}
