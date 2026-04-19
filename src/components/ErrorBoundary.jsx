import { Component } from 'preact';
import { AlertIcon, RefreshIcon } from './Icons';

/**
 * Catches render-phase exceptions in its subtree and renders a retry
 * fallback instead of blanking the whole app. Used to wrap each tab
 * component so a crash in the Viewer doesn't take out the Dashboard.
 *
 * Preact's Component supports componentDidCatch + getDerivedStateFromError
 * with the same contract as React. Resetting via state ({hasError:false})
 * mounts a fresh subtree on the next render; if the underlying cause
 * persists it'll re-throw and land us back here.
 */
export class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', this.props.label || 'unnamed', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const label = this.props.label;
      return (
        <div className="error-boundary" role="alert">
          <AlertIcon className="error-boundary-icon" aria-hidden="true" />
          <h2 className="error-boundary-title">
            Something broke{label ? ` in ${label}` : ''}
          </h2>
          <p className="error-boundary-message">
            {this.state.error?.message || 'An unexpected error occurred rendering this view.'}
          </p>
          <button type="button" className="btn" onClick={this.handleRetry}>
            <RefreshIcon aria-hidden="true" />
            <span>Retry</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
