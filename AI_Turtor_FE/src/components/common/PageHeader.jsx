import { Typography } from 'antd';

const { Title, Text } = Typography;

function PageHeader({ title, description, eyebrow, actions, className = '' }) {
  return (
    <header className={`page-header ${className}`.trim()}>
      <div className="page-header__copy">
        {eyebrow && <span className="page-header__eyebrow">{eyebrow}</span>}
        <Title level={3} className="page-title">{title}</Title>
        {description && <Text className="page-subtitle">{description}</Text>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}

export default PageHeader;
