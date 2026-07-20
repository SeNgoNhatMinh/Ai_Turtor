import { DownloadOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Table, Tag, Typography } from 'antd';
import { getMaterialDisplayName } from '../../../../utils/sourceLabels';

const { Text } = Typography;

const isWebsiteMaterial = (material) => (
  String(material?.sourceType || material?.type || '').toUpperCase() === 'HTML_URL'
);

export default function CourseMaterialsPanel({ materials, onDownload }) {
  if (!Array.isArray(materials) || materials.length === 0) {
    return (
      <Card styles={{ body: { padding: 16 } }}>
        <Empty description="Môn học này chưa có tài liệu." />
      </Card>
    );
  }

  const columns = [
    {
      title: 'Tên tài liệu',
      dataIndex: 'title',
      key: 'title',
      render: (title) => <Text strong>{title || 'Tài liệu chưa đặt tên'}</Text>,
    },
    {
      title: 'Tên tệp',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (_, record) => (
        <Text type="secondary">{getMaterialDisplayName(record) || 'Không có thông tin tệp'}</Text>
      ),
    },
    {
      title: 'Phạm vi',
      dataIndex: 'classId',
      key: 'classId',
      render: (value) => <Tag color="orange">{value ? `Lớp ${value}` : 'Toàn môn'}</Tag>,
    },
    {
      title: 'Ngày tải lên',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value) => <Text type="secondary">{value ? new Date(value).toLocaleDateString() : '-'}</Text>,
    },
    {
      title: 'Tải xuống',
      key: 'action',
      width: 120,
      render: (_, record) => {
        if (isWebsiteMaterial(record)) return <Tag>Tài liệu website</Tag>;
        if (!onDownload || !record.id) return <Text type="secondary">Không khả dụng</Text>;
        return (
          <Button
            type="primary"
            size="small"
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
    <Card styles={{ body: { padding: 16 } }}>
      <Table
        dataSource={materials}
        rowKey={(record) => record.id || record.materialId}
        pagination={{ pageSize: 8 }}
        scroll={{ x: 760 }}
        columns={columns}
      />
    </Card>
  );
}
