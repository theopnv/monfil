import type { IUserInterface } from "../IUserInterface";

export const consoleUI: IUserInterface = {
  displayMessage(message: string): void {
    console.log(message);
  },
  displayError(error: Error): void {
    console.error(error.message);
  },
};
