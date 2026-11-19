// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import i18next, { type i18n, type ThirdPartyModule } from 'i18next';
import { DEFAULT_LANGUAGE, type LanguageCode } from './languages';
import { DEFAULT_NAMESPACE, NAMESPACES, resources } from './resources';

/** Builds an i18next instance with every bundled language. All resources are in memory, so it is ready when this returns. Plugins must come here, because `use` after `init` is too late for them. */
export function createI18n(language: LanguageCode, plugins: readonly ThirdPartyModule[] = []): i18n {
  const instance = i18next.createInstance();
  for (const plugin of plugins) {
    instance.use(plugin);
  }
  void instance.init({
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    resources,
    // Stryker disable next-line ArrayDeclaration: i18next also reads the namespaces from the resources
    ns: [...NAMESPACES],
    defaultNS: DEFAULT_NAMESPACE,
    // React escapes its own output, and the main process shows plain text.
    interpolation: { escapeValue: false },
    // Stryker disable next-line BooleanLiteral: with in-memory resources and no backend, i18next finishes init at once either way
    initAsync: false,
  });
  return instance;
}
