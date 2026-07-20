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
        <Empty description="No learning materials uploaded yet for this course." />
      </Card>
    );
  }

  const columns = [
    {
      title: 'Material Title',
      dataIndex: 'title',
      key: 'title',
      render: (title) => <Text strong>{title || 'Untitled Material'}</Text>,
    },
    {
      title: 'File Name',
      dataIndex: 'fileName',
      key: 'fileName',
      render: (_, record) => (
        <Text type="secondary">{getMaterialDisplayName(record) || 'Material file unavailable'}</Text>
      ),
    },
    {
      title: 'Scope',
      dataIndex: 'classId',
      key: 'classId',
      render: (value) => <Tag color="orange">{value || 'Course-wide'}</Tag>,
    },
    {
      title: 'Upload Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value) => <Text type="secondary">{value ? new Date(value).toLocaleDateString() : '-'}</Text>,
    },
    {
      title: 'Download',
      key: 'action',
      width: 120,
      render: (_, record) => {
        if (isWebsiteMaterial(record)) return <Tag>Website material</Tag>;
        if (!onDownload || !record.id) return <Text type="secondary">Unavailable</Text>;
        return (
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => onDownload(record.id, record.title)}
          >
            Download
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
        columns={columns}
      />
    </Card>
  );
}
