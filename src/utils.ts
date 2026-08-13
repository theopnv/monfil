// Result
type Success<S> = { success: true; data: S };
type Failure<E> = { success: false; error: E };

export type Result<S, E = Error> = Success<S> | Failure<E>;
