import { Space, Typography } from 'antd';

const { Title, Text } = Typography;

function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <Title level={3} className="page-title">{title}</Title>
        {description && <Text className="page-subtitle">{description}</Text>}
      </div>
      {actions && <Space wrap>{actions}</Space>}
    </div>
  );
}

export default PageHeader;
