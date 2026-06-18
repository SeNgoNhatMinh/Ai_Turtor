import React from 'react';
import { Alert, Empty, Spin } from 'antd';

function StateBlock({ loading, error, empty, emptyDescription, children }) {
  if (loading) {
    return <div className="state-block"><Spin /></div>;
  }
  if (error) {
    return <Alert type="error" showIcon message="Unable to load data" description={error} />;
  }
  if (empty) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyDescription || 'No data available'} />;
  }
  return children;
}

export default StateBlock;
