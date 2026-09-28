// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import logoUrl from "@/styles/monfil-logo.svg";

export interface MonfilLogoProps {
  className?: string;
}

export default function MonfilLogo({ className }: MonfilLogoProps) {
  return <img src={logoUrl} alt="Monfil" className={className} />;
}
