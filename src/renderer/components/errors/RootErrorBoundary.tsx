// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorRecovery } from './ErrorRecovery';
import { rendererLogger } from '@/lib/ipc-client';

interface Props { children: ReactNode }
interface State { error: Error | undefined; incidentId: string | undefined }

export class RootErrorBoundary extends Component<Props, State> {
  override state: State = { error: undefined, incidentId: undefined };

  static getDerivedStateFromError(error: Error): Pick<State, 'error'> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    const incidentId = crypto.randomUUID();
    this.setState({ incidentId });
    const failure = new Error(error.message);
    failure.name = error.name;
    failure.stack = `${error.stack ?? `${error.name}: ${error.message}`}\n${info.componentStack ?? ''}`;
    rendererLogger.error('renderer.failure', { message: 'Root render failed', incidentId }, failure);
  }

  override render() {
    if (this.state.error) {
      return <ErrorRecovery error={this.state.error} variant="root" {...(this.state.incidentId ? { incidentId: this.state.incidentId } : {})} onRetry={() => this.setState({ error: undefined, incidentId: undefined })} />;
    }
    return this.props.children;
  }
}
