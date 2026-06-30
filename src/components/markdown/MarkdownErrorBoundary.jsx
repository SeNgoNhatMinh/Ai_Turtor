import React from 'react';

class MarkdownErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.warn('AI markdown render failed. Falling back to plain text.', error);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.contentKey !== this.props.contentKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return <pre className="ai-answer-render-error">{this.props.fallbackText}</pre>;
    }

    return this.props.children;
  }
}

export default MarkdownErrorBoundary;
