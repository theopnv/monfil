import type { DeleteCategoryError } from "../../../shared/contracts";
import type { CreateCategoryError } from "../../../shared/contracts";
import type { UpdateCategoryError } from "../../../shared/contracts";
import type { ErrorPolicy } from '../../../shared/errors';

type CategoryError = CreateCategoryError | UpdateCategoryError | DeleteCategoryError;

export const categoryErrorPolicy = {
  CATEGORY_NOT_FOUND: { surface: 'field', level: 'warn', message: 'That folder no longer exists.', retry: 'none' },
  DUPLICATE_NAME: { surface: 'field', level: 'debug', message: 'A folder with that name already exists.', retry: 'none' },
  DB_ERROR: { surface: 'toast', level: 'error', message: 'The folder could not be saved.', retry: 'none' },
} satisfies ErrorPolicy<CategoryError>;

export function categoryErrorMessage(error: CategoryError): string {
  switch (error.name) {
    case 'CATEGORY_NOT_FOUND':
      return categoryErrorPolicy.CATEGORY_NOT_FOUND.message;
    case 'DUPLICATE_NAME':
      return categoryErrorPolicy.DUPLICATE_NAME.message;
    case 'DB_ERROR':
      return categoryErrorPolicy.DB_ERROR.message;
    default: {
      const exhaustiveCheck: never = error;
      return exhaustiveCheck;
    }
  }
}
