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
          <h1 ref={this.headingRef} tabIndex="-1">Trang gặp lỗi khi hiển thị</h1>
          <p>Hãy thử tải lại khu vực này trước khi làm mới toàn bộ ứng dụng.</p>
          <small>Mã tham chiếu lỗi: {this.state.reference}</small>
          <div className="app-error-boundary__actions">
            <button type="button" onClick={this.resetBoundary}>Thử lại</button>
            <button type="button" onClick={() => window.location.reload()}>Làm mới trang</button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
