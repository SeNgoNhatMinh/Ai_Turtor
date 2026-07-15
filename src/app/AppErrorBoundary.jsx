import { Component, createRef } from 'react';
import { createErrorReference, reportFrontendError } from '../utils/errorReporting';
import './AppErrorBoundary.css';

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, reference: '' };
    this.headingRef = createRef();
  }

  static getDerivedStateFromError() {
    return { hasError: true, reference: createErrorReference() };
  }

  componentDidCatch(error, errorInfo) {
    reportFrontendError(error, {
      reference: this.state.reference,
      componentStack: errorInfo?.componentStack || '',
    });
    window.requestAnimationFrame(() => this.headingRef.current?.focus());
  }

  resetBoundary = () => {
    this.setState({ hasError: false, reference: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="app-error-boundary" role="alert">
          <h1 ref={this.headingRef} tabIndex="-1">Something went wrong</h1>
          <p>The page could not finish rendering. Try again before refreshing the whole application.</p>
          <small>Error reference: {this.state.reference}</small>
          <div className="app-error-boundary__actions">
            <button type="button" onClick={this.resetBoundary}>Try again</button>
            <button type="button" onClick={() => window.location.reload()}>Refresh page</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
