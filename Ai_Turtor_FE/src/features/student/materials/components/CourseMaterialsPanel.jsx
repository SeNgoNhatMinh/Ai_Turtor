import {
  DownloadOutlined,
  FilePdfOutlined,
  LinkOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Empty, Skeleton, Tag, Typography } from 'antd';
import SearchableTable from '../../../../components/common/SearchableTable';
import { getMaterialDisplayName } from '../../../../utils/sourceLabels';

const { Text } = Typography;

const isWebsiteMaterial = (material) => (
  String(material?.sourceType || material?.type || '').toUpperCase() === 'HTML_URL'
);

export default function CourseMaterialsPanel({
  materials,
  loading = false,
  error = '',
  courseId = '',
  classId = '',
  onRetry,
  onDownload,
}) {
  const safeMaterials = Array.isArray(materials) ? materials : [];
  const columns = [
    {
      title: 'Tài liệu',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <div className="student-material-title">
          {isWebsiteMaterial(record) ? <LinkOutlined /> : <FilePdfOutlined />}
          <div>
            <Text strong>{title || 'Tài liệu chưa đặt tên'}</Text>
            <Text type="secondary">{getMaterialDisplayName(record) || 'Không có thông tin tệp'}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Lớp học',
      dataIndex: 'classId',
      key: 'classId',
      width: 160,
      render: (value) => <Tag color="blue">{value || classId}</Tag>,
    },
    {
      title: 'Ngày cập nhật',
      dataIndex: 'indexedAt',
      key: 'indexedAt',
      width: 150,
      render: (value) => (
        <Text type="secondary">{value ? new Date(value).toLocaleDateString('vi-VN') : '-'}</Text>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 130,
      align: 'right',
      render: (_, record) => {
        if (isWebsiteMaterial(record)) return <Tag icon={<LinkOutlined />}>Website</Tag>;
        if (!onDownload || !record.id) return <Text type="secondary">Không khả dụng</Text>;
        return (
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => onDownload(record.id, record.title)}
          >
            Tải xuống
          </Button>
        );
      },
    },
  ];

  return (
    <Card className="student-teacher-materials" styles={{ body: { padding: 0 } }}>
      <div className="student-teacher-materials__header">
        <div>
          <span className="student-teacher-materials__eyebrow">{courseId || 'Môn học'}</span>
          <h2>Tài liệu từ giảng viên</h2>
          <p>Chỉ gồm học liệu do giảng viên phụ trách lớp {classId || 'hiện tại'} đăng tải.</p>
        </div>
        <div className="student-teacher-materials__summary">
          <strong>{safeMaterials.length}</strong>
          <span>tài liệu</span>
          <Button
            type="text"
            aria-label="Tải lại tài liệu"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={onRetry}
          />
        </div>
      </div>

      {error && (
        <Alert
          className="student-teacher-materials__alert"
          type="error"
          showIcon
          message="Không tải được tài liệu"
          description={error}
          action={<Button size="small" onClick={onRetry}>Thử lại</Button>}
        />
      )}

      {loading && safeMaterials.length === 0 ? (
        <div className="student-teacher-materials__loading">
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      ) : safeMaterials.length === 0 && !error ? (
        <Empty
          className="student-teacher-materials__empty"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={(
            <span>
              <strong>Giảng viên chưa đăng tài liệu cho lớp này.</strong>
              <small>Khi có tài liệu mới, chúng sẽ xuất hiện tại đây.</small>
            </span>
          )}
        />
      ) : (
        <SearchableTable
          dataSource={safeMaterials}
          rowKey={(record) => record.id || record.materialId}
          searchKeys={['title', 'fileName', 'sourceFileName']}
          searchPlaceholder="Tìm tài liệu của giảng viên"
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          scroll={{ x: 720 }}
          columns={columns}
        />
      )}
    </Card>
  );
}
