type Success<S> = { success: true; data: S };
type Failure<E> = { success: false; error: E };

export type Result<S, E = Error> = Success<S> | Failure<E>;

export interface UnexpectedError {
  name: 'UNEXPECTED_ERROR';
  message: string;
  incidentId: string;
}

export type IpcResult<T, E = never> = Result<T, E | UnexpectedError>;
