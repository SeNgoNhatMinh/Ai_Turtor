import { Alert, Button, Modal, Spin, Typography } from 'antd';

const { Paragraph, Text } = Typography;

export default function EvaluationProgress({
  active,
  elapsedMs,
  collapsed,
  onCollapse,
  onExpand,
}) {
  if (!active) return null;

  return (
    <>
      {collapsed && (
        <Alert
          type="info"
          showIcon
          title="Evaluation vẫn đang chạy"
          description="Bạn có thể tiếp tục xem dữ liệu trên trang. Kết quả sẽ tự cập nhật từ backend khi hoàn tất."
          action={<Button size="small" onClick={onExpand}>Xem tiến trình</Button>}
        />
      )}
      <Modal
        title="Đang chạy Evaluation"
        open={!collapsed}
        closable={elapsedMs >= 30000}
        maskClosable={false}
        keyboard={false}
        onCancel={() => elapsedMs >= 30000 && onCollapse()}
        footer={elapsedMs >= 30000 ? (
          <Button onClick={onCollapse}>Vẫn chạy nền</Button>
        ) : null}
      >
        <div className="expert-training__evaluation-progress">
          <Spin size="large" description="Đang chấm benchmark..." />
          <Paragraph>
            Evaluation có thể mất vài phút. FE đang chờ kết quả canonical từ n8n/backend.
          </Paragraph>
          <Text type="secondary">Đã chạy {Math.max(1, Math.floor(elapsedMs / 1000))} giây.</Text>
        </div>
      </Modal>
    </>
  );
}
