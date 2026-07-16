import { Alert, Button, Card, Col, Form, Input, Row, Select, Space, Tag, Upload } from 'antd';
import { DownloadOutlined, GlobalOutlined, UploadOutlined } from '@ant-design/icons';
import { Database, Eye, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import EntityActionMenu from '../../../components/common/EntityActionMenu';
import { DataTable } from '../../../components/ui/data-table';
import { getRecordId, getWebsiteSourceLabel, isWebsiteMaterial } from './adminAcademicUtils';

const { Option } = Select;
const { Dragger } = Upload;

function CourseMaterialsTab({
  form,
  courses,
  materialCourseId,
  materialFile,
  materialUploadBusy,
  courseMaterials,
  materialsLoading,
  onCourseChange,
  onFileChange,
  onFileRemove,
  onUpload,
  onOpenWebsiteImport,
  onReload,
  onMaterialAction,
}) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={9}>
        <Card title="Upload Shared Course Material" hoverable>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title="Course materials are managed by Admin because they are shared across classes."
          />
          <Form form={form} layout="vertical" onFinish={onUpload}>
            <Form.Item label="Course" required>
              <Select
                placeholder="Choose a course"
                value={materialCourseId || undefined}
                onChange={onCourseChange}
              >
                {courses.map((course) => (
                  <Option key={course.courseId || course.id} value={course.courseId}>
                    {course.courseId} - {course.courseName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="title" label="Material title" rules={[{ required: true, message: 'Enter a material title' }]}>
              <Input placeholder="Lecture 01 - OOP" />
            </Form.Item>
            <Dragger
              beforeUpload={(file) => {
                onFileChange(file);
                return false;
              }}
              fileList={materialFile ? [materialFile] : []}
              onRemove={onFileRemove}
              accept=".pdf"
              maxCount={1}
              style={{ marginBottom: 16 }}
            >
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p className="ant-upload-text">Choose a course material file</p>
              <p className="ant-upload-hint">PDF only. This upload is course-wide. Class ID is not sent.</p>
            </Dragger>
            <Button
              type="primary"
              htmlType="submit"
              block
              icon={<UploadOutlined />}
              loading={materialUploadBusy}
              disabled={!materialCourseId || !materialFile || materialUploadBusy}
            >
              {materialUploadBusy ? 'Uploading...' : 'Upload Course Material'}
            </Button>
            <Button
              block
              icon={<GlobalOutlined />}
              style={{ marginTop: 10 }}
              disabled={!materialCourseId || materialUploadBusy}
              onClick={onOpenWebsiteImport}
            >
              Import Website URL
            </Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} lg={15} style={{ minWidth: 0 }}>
        <Card
          className="admin-materials-table-card"
          title="Shared Course Materials"
          hoverable
          style={{ overflow: 'hidden' }}
          styles={{ body: { overflowX: 'auto', padding: '16px' } }}
          extra={<Button size="small" onClick={onReload} icon={<RefreshCw size={14} />} disabled={!materialCourseId}>Reload</Button>}
        >
          {materialsLoading && courseMaterials.length === 0 ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
          ) : (
            <DataTable
              data={courseMaterials || []}
              columns={[
                {
                  accessorKey: 'title',
                  header: 'Title',
                  cell: ({ row }) => (
                    <span className="admin-material-title-text font-semibold text-gray-800" title={row.getValue('title') || 'Untitled Material'}>
                      {row.getValue('title') || 'Untitled Material'}
                    </span>
                  ),
                },
                {
                  accessorKey: 'fileName',
                  header: 'Source',
                  cell: ({ row }) => (
                    <Space direction="vertical" size={2}>
                      <Space size={6} wrap>
                        <Tag color={isWebsiteMaterial(row.original) ? 'blue' : 'default'}>
                          {isWebsiteMaterial(row.original) ? 'Website' : 'PDF'}
                        </Tag>
                        {row.original.indexingStatus && <Tag>{row.original.indexingStatus}</Tag>}
                      </Space>
                      <span className="admin-material-source-text text-sm text-gray-500 font-mono">
                        {isWebsiteMaterial(row.original)
                          ? getWebsiteSourceLabel(row.original)
                          : row.getValue('fileName') || row.original.sourceFileName || row.original.filePath || row.original.id}
                      </span>
                    </Space>
                  ),
                },
                { 
                  accessorKey: 'classId', 
                  header: 'Scope', 
                  cell: ({ row }) => <Tag>{row.getValue('classId') || 'Course-wide'}</Tag> 
                },
                {
                  accessorKey: 'createdAt',
                  header: 'Uploaded',
                  cell: ({ row }) => (
                    <span className="admin-material-date-text text-xs text-gray-500">
                      {row.getValue('createdAt') ? new Date(row.getValue('createdAt')).toLocaleString('en-US') : '—'}
                    </span>
                  ),
                },
                {
                  id: 'actions',
                  header: '',
                  cell: ({ row }) => {
                    const materialId = getRecordId(row.original);
                    return (
                      <EntityActionMenu
                        items={[
                          { key: 'view', icon: <Eye size={14} />, label: 'View details' },
                          { key: 'edit', icon: <Pencil size={14} />, label: 'Edit metadata' },
                          {
                            key: 'download',
                            icon: <DownloadOutlined />,
                            label: isWebsiteMaterial(row.original) ? 'No PDF download' : 'Download',
                            disabled: isWebsiteMaterial(row.original),
                          },
                          { key: 'reindex', icon: <Database size={14} />, label: 'Reindex' },
                          { type: 'divider' },
                          { key: 'delete', icon: <Trash2 size={14} />, label: 'Delete', danger: true },
                        ]}
                        onAction={(key, meta) => onMaterialAction(key, row.original, materialId, meta)}
                        ariaLabel="Material actions"
                      />
                    );
                  },
                },
              ]}
            />
          )}
        </Card>
      </Col>
    </Row>
  );
}

export default CourseMaterialsTab;
