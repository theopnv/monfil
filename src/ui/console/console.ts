import type { UserInterface } from "../UserInterface";

export const consoleUI: UserInterface = {
  displayMessage<T>(message: T): void {
    console.log(message);
  },
  displayError(error: Error): void {
    console.error(error.message);
  },
};
