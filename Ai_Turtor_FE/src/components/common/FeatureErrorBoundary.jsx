import { Component } from 'react';
import { Alert, Button } from 'antd';
import LogRocket from 'logrocket';
import { createErrorReference, reportFrontendError } from '../../utils/errorReporting';

class FeatureErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, reference: '' };
  }

  static getDerivedStateFromError() {
    return { hasError: true, reference: createErrorReference() };
  }

  componentDidCatch(error, errorInfo) {
    const { featureName = 'feature' } = this.props;
    reportFrontendError(error, {
      reference: this.state.reference,
      feature: featureName,
      componentStack: errorInfo?.componentStack || '',
    });
    LogRocket.captureException(error, {
      tags: { errorBoundary: 'FeatureErrorBoundary', feature: featureName },
      extra: { reference: this.state.reference },
    });
  }

  resetBoundary = () => {
    this.setState({ hasError: false, reference: '' });
  };

  render() {
    if (this.state.hasError) {
      const { featureName = 'Tính năng' } = this.props;
      return (
        <div className="feature-error-boundary" style={{ padding: '24px 16px' }}>
          <Alert
            type="error"
            showIcon
            title={`${featureName} gặp lỗi`}
            description={`Không thể hiển thị ${featureName.toLowerCase()}. Thử tải lại khu vực này.`}
            action={
              <Button size="small" onClick={this.resetBoundary}>Thử lại</Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default FeatureErrorBoundary;
