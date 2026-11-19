// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { TFunction } from 'i18next';
import type { DeleteCategoryError } from "../../../shared/contracts";
import type { CreateCategoryError } from "../../../shared/contracts";
import type { UpdateCategoryError } from "../../../shared/contracts";
import type { ErrorPolicy } from '../../../shared/errors';

type CategoryError = CreateCategoryError | UpdateCategoryError | DeleteCategoryError;

export const categoryErrorPolicy = {
  CATEGORY_NOT_FOUND: { surface: 'field', level: 'warn', messageKey: 'category.notFound', retry: 'none' },
  DUPLICATE_NAME: { surface: 'field', level: 'debug', messageKey: 'category.duplicate', retry: 'none' },
  DB_ERROR: { surface: 'toast', level: 'error', messageKey: 'category.saveFailed', retry: 'none' },
} satisfies ErrorPolicy<CategoryError>;

export function categoryErrorMessage(t: TFunction<'errors'>, error: CategoryError): string {
  switch (error.name) {
    case 'CATEGORY_NOT_FOUND':
      return t(categoryErrorPolicy.CATEGORY_NOT_FOUND.messageKey);
    case 'DUPLICATE_NAME':
      return t(categoryErrorPolicy.DUPLICATE_NAME.messageKey);
    case 'DB_ERROR':
      return t(categoryErrorPolicy.DB_ERROR.messageKey);
    default: {
      const exhaustiveCheck: never = error;
      return exhaustiveCheck;
    }
  }
}
