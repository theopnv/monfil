// Result
type Success<T> = { success: true; value: T };
type Failure<E> = { success: false; error: E };

export type Result<T, E = Error> = Success<T> | Failure<E>;
