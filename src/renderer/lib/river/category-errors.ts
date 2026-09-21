import type { DeleteCategoryError } from "../../../shared/contracts";
import type { CreateCategoryError } from "../../../shared/contracts";
import type { UpdateCategoryError } from "../../../shared/contracts";

export function categoryErrorMessage(error: CreateCategoryError | UpdateCategoryError | DeleteCategoryError): string {
  switch (error.name) {
    case 'CATEGORY_NOT_FOUND':
      return 'That folder no longer exists.';
    case 'DUPLICATE_NAME':
      return 'A folder with that name already exists.';
    case 'DB_ERROR':
      return error.message;
    default: {
      const exhaustiveCheck: never = error;
      return exhaustiveCheck;
    }
  }
}
