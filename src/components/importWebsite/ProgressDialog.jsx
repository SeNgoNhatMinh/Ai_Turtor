import { Button, Modal, Progress, Space, Steps, Typography } from 'antd';
import { CloseCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

const DEFAULT_STEPS = [
  'Analyzing documentation',
  'Discovering chapters',
  'Downloading pages',
  'Converting to Markdown',
  'Merging content',
  'Uploading to backend',
  'Completed',
];

export default function ProgressDialog({
  open,
  current = 0,
  percent = 0,
  message = '',
  currentPage = '',
  steps = DEFAULT_STEPS,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      footer={
        onCancel
          ? [
              <Button
                key="cancel"
                danger
                icon={<CloseCircleOutlined />}
                onClick={onCancel}
              >
                Cancel Import
              </Button>,
            ]
          : null
      }
      closable={false}
      centered
      width={560}
      title="Importing Documentation"
    >
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <Steps
          direction="vertical"
          size="small"
          current={current}
          items={steps.map((title) => ({ title }))}
        />
        <Progress
          percent={Math.max(0, Math.min(100, Math.round(percent)))}
          status={current >= steps.length - 1 ? 'success' : 'active'}
        />
        {currentPage && (
          <Text type="secondary" ellipsis>
            📄 {currentPage}
          </Text>
        )}
        {message && <Text type="secondary">{message}</Text>}
      </Space>
    </Modal>
  );
}
