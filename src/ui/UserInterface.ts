export interface UserInterface {
  displayMessage<T>(message: T): void;
  displayError: (error: Error) => void;
}
