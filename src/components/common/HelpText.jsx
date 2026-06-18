import React from 'react';
import { Typography } from 'antd';

const { Text } = Typography;

function HelpText({ children }) {
  if (!children) return null;
  return <Text className="help-text">{children}</Text>;
}

export default HelpText;
