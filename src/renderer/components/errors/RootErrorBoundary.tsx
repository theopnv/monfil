import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorRecovery } from './ErrorRecovery';
import { rendererLogger } from '@/lib/ipc-client';

interface Props { children: ReactNode }
interface State { error: Error | undefined }

export class RootErrorBoundary extends Component<Props, State> {
  override state: State = { error: undefined };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    rendererLogger.error('renderer.failure', { message: 'Root render failed' }, new Error(`${error.message}\n${info.componentStack ?? ''}`));
  }

  override render() {
    if (this.state.error) {
      return <ErrorRecovery error={this.state.error} variant="root" onRetry={() => this.setState({ error: undefined })} />;
    }
    return this.props.children;
  }
}
