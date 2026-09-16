import type { DeleteCategoryError } from "../../../main/db/crud/delete";
import type { CreateCategoryError } from "../../../main/db/crud/insert";
import type { UpdateCategoryError } from "../../../main/db/crud/update";

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
