import { Component, type ErrorInfo, type PropsWithChildren } from 'react';

import { reportError } from '../monitoring/errorReporter';
import { FatalErrorScreen } from './FatalErrorScreen';

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<PropsWithChildren, State> {
  state: State = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportError(error, {
      domain: 'ui',
      action: 'render',
      details: {
        componentStack: info.componentStack,
      },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <FatalErrorScreen onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}
