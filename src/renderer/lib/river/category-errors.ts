// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ParseKeys, TFunction } from 'i18next';
import type { CreateCategoryError, DeleteCategoryError, UpdateCategoryError } from "../../../shared/contracts";

type CategoryError = CreateCategoryError | UpdateCategoryError | DeleteCategoryError;

const MESSAGE_KEYS = {
  CATEGORY_NOT_FOUND: 'category.notFound',
  DUPLICATE_NAME: 'category.duplicate',
  DB_ERROR: 'category.saveFailed',
} as const satisfies Record<CategoryError['name'], ParseKeys<'errors'>>;

export function categoryErrorMessage(t: TFunction<'errors'>, error: CategoryError): string {
  return t(MESSAGE_KEYS[error.name]);
}
