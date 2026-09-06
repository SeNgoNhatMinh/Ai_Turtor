import {
  DownloadOutlined,
  FilePdfOutlined,
  FolderOpenOutlined,
  LinkOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Empty, Skeleton, Tag, Tooltip, Typography } from 'antd';
import SearchableTable from '../../../../components/common/SearchableTable';
import { getMaterialDisplayName } from '../../../../utils/sourceLabels';

const { Text } = Typography;

const isWebsiteMaterial = (material) => (
  String(material?.sourceType || material?.type || '').toUpperCase() === 'HTML_URL'
);

const getReadableError = (error) => {
  const message = String(error || '').trim();
  if (/unauthorized|\b401\b/i.test(message)) {
    return 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại rồi tải lại danh sách.';
  }
  return message || 'Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.';
};

const isSessionError = (error) => /phiên đăng nhập|unauthorized|\b401\b/i.test(String(error || ''));

export default function CourseMaterialsPanel({
  materials,
  loading = false,
  error = '',
  courseId = '',
  classId = '',
  onRetry,
  onLoginAgain,
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
      responsive: ['md'],
      render: (value) => <Tag color="blue">{value || classId}</Tag>,
    },
    {
      title: 'Ngày cập nhật',
      dataIndex: 'indexedAt',
      key: 'indexedAt',
      width: 150,
      responsive: ['lg'],
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
            ghost
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
        <div className="student-teacher-materials__heading">
          <span className="student-teacher-materials__heading-icon" aria-hidden="true">
            <FolderOpenOutlined />
          </span>
          <div>
            <span className="student-teacher-materials__eyebrow">{courseId || 'Môn học'}</span>
            <h2>Tài liệu từ giảng viên</h2>
            <p>Học liệu được chia sẻ riêng cho lớp {classId || 'hiện tại'}.</p>
          </div>
        </div>
        <div className="student-teacher-materials__summary">
          <strong>{safeMaterials.length}</strong>
          <span>tài liệu</span>
          <Tooltip title="Tải lại danh sách">
            <Button
              type="text"
              aria-label="Tải lại tài liệu"
              icon={<ReloadOutlined />}
              loading={loading}
              disabled={!onRetry}
              onClick={onRetry}
            />
          </Tooltip>
        </div>
      </div>

      {error && (
        <Alert
          className="student-teacher-materials__alert"
          type="error"
          showIcon
          message="Không tải được tài liệu"
          description={getReadableError(error)}
          action={isSessionError(error) && onLoginAgain
            ? <Button type="primary" size="small" onClick={onLoginAgain}>Đăng nhập lại</Button>
            : onRetry ? <Button size="small" onClick={onRetry}>Thử lại</Button> : null}
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
          size="middle"
          rowClassName="student-material-row"
          locale={{ emptyText: 'Không tìm thấy tài liệu phù hợp.' }}
          columns={columns}
        />
      )}
    </Card>
  );
}
