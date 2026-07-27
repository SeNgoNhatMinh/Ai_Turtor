import { Alert, Drawer, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import StatusLabel from '../../../components/common/StatusLabel';
import {
  formatExpertTaskDateTime,
  getExpertTaskDueMeta,
  getTaskGoldUsage,
} from '../expertTrainingUtils';
import ChapterMaterialPreviewContent from './ChapterMaterialPreviewContent';

const { Paragraph, Text, Title } = Typography;

export default function TaskPreviewDrawer({
  task,
  preview,
  loading,
  error,
  open,
  onClose,
  onOpenMaterial,
}) {
  if (!task) return null;
  const usage = getTaskGoldUsage(task);
  const dueMeta = getExpertTaskDueMeta(task);

  return (
    <Drawer
      title="Tài liệu chương"
      open={open}
      onClose={onClose}
      size="large"
      rootClassName="expert-training__drawer expert-training__task-preview-drawer"
      destroyOnHidden
    >
      <div className="expert-training__task-preview">
        <div className="expert-training__task-preview-strip">
          <div className="expert-training__task-preview-head">
            <div>
              <Title level={5}>{task.title || task.chapter}</Title>
              <Space wrap size={[6, 6]}>
                <StatusLabel status={task.status} />
                {usage && (
                  <Tag color={usage === 'EVALUATION' ? 'purple' : 'blue'}>
                    {usage === 'EVALUATION' ? 'Evaluation holdout' : 'Training · RAG sau duyệt'}
                  </Tag>
                )}
                <Tag>{task.chapter}</Tag>
              </Space>
            </div>
          </div>

          <div className="expert-training__task-preview-schedule">
            <div>
              <Text type="secondary">Giao task</Text>
              <div>{formatExpertTaskDateTime(task.createdAt, 'Chưa có thời gian')}</div>
            </div>
            <div className={`expert-training__task-due expert-training__task-due--${dueMeta.tone}`}>
              <Text type="secondary">Hạn hoàn thành</Text>
              <div>{dueMeta.label}</div>
            </div>
          </div>

          <Paragraph className="expert-training__task-instructions">
            {task.instructions || 'Không có hướng dẫn bổ sung.'}
          </Paragraph>
        </div>

        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : error ? (
          <Alert type="error" showIcon title="Không tải được tài liệu chương" description={error} />
        ) : !preview ? (
          <Empty description="Chưa có preview cho chương này." />
        ) : (
          <ChapterMaterialPreviewContent preview={preview} onOpenMaterial={onOpenMaterial} />
        )}
      </div>
    </Drawer>
  );
}
