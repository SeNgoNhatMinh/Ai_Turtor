import { Alert, Button, Card, Col, Descriptions, Form, Input, Progress, Row, Select, Space, Steps, Tag, Upload } from 'antd';
import { DownloadOutlined, GlobalOutlined, UploadOutlined } from '@ant-design/icons';
import { Database, Eye, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import EntityActionMenu from '../../../../components/common/EntityActionMenu';
import { DataTable } from '../../../../components/common/DataTable';
import {
  getCourseSelectOptions,
  getRecordId,
  getWebsiteSourceLabel,
  isWebsiteMaterial,
} from '../adminAcademicUtils';
import StatusLabel from '../../../../components/common/StatusLabel';

const { Dragger } = Upload;

const IMPORT_STAGES = [
  ['UPLOADING', 'Uploading'],
  ['PARSING', 'Parsing'],
  ['CHUNKING', 'Chunking'],
  ['EXTRACTING_TERMS', 'Extracting technical terms'],
  ['TRANSLATING', 'Translating EN → VI'],
  ['VALIDATING', 'Validating'],
  ['EMBEDDING', 'Embedding'],
  ['INDEXING', 'Indexing'],
  ['COMPLETED', 'Completed'],
];

function ImportProgressCard({ job, loading, onRetry, onCancel }) {
  if (!job) return null;
  const stage = String(job.stage || job.status || 'QUEUED').toUpperCase();
  const status = String(job.status || '').toUpperCase();
  const current = Math.max(0, IMPORT_STAGES.findIndex(([key]) => key === stage));
  const failed = status === 'FAILED';
  const cancelled = status === 'CANCELLED';
  return (
    <Card className="admin-import-progress" title="Admin Material Import" size="small">
      <Space orientation="vertical" size={14} style={{ width: '100%' }}>
        <Space wrap>
          <strong>{job.materialId || 'Material import'}</strong>
          <StatusLabel status={status || stage} />
        </Space>
        <Progress
          percent={Number(job.progressPercent || 0)}
          status={failed ? 'exception' : status === 'COMPLETED' ? 'success' : 'active'}
          aria-label={`Tiến độ import ${Number(job.progressPercent || 0)} phần trăm`}
        />
        <Steps
          direction="vertical"
          size="small"
          current={current}
          status={failed ? 'error' : 'process'}
          items={IMPORT_STAGES.map(([, title], index) => ({
            title,
            status: failed && index === current ? 'error' : undefined,
          }))}
        />
        <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label="Current">
            {job.currentChapter || '—'}{job.currentChunk != null ? ` · Chunk ${job.currentChunk} / ${job.totalChunks || '—'}` : ''}
          </Descriptions.Item>
          <Descriptions.Item label="Chapters">{job.completedChapters || 0} / {job.totalChapters || '—'}</Descriptions.Item>
          <Descriptions.Item label="Chunks">{job.completedChunks || 0} / {job.totalChunks || '—'}</Descriptions.Item>
          <Descriptions.Item label="Vietnamese translations">{job.translatedChunks || 0}</Descriptions.Item>
          <Descriptions.Item label="Technical terms preserved">{job.technicalTermsPreserved || 0}</Descriptions.Item>
          <Descriptions.Item label="Failed chunks">{job.failedChunks || 0}</Descriptions.Item>
          <Descriptions.Item label="Translation model">NVIDIABuild-Autogen-17</Descriptions.Item>
        </Descriptions>
        {job.errorMessage && <Alert type="error" showIcon title={job.errorMessage} />}
        <Space wrap>
          {failed && <Button onClick={onRetry} loading={loading}>Retry failed import</Button>}
          {['QUEUED', 'PENDING', 'RETRY'].includes(status) && (
            <Button danger onClick={onCancel} loading={loading}>Cancel</Button>
          )}
          {cancelled && <span>Import đã được hủy trước khi worker xử lý.</span>}
        </Space>
      </Space>
    </Card>
  );
}

function CourseMaterialsTab({
  form,
  courses,
  materialCourseId,
  materialFile,
  materialUploadBusy,
  courseMaterials,
  materialsLoading,
  activeImportJob,
  importJobLoading,
  onCourseChange,
  onFileChange,
  onFileRemove,
  onUpload,
  onOpenWebsiteImport,
  onReload,
  onRetryImportJob,
  onCancelImportJob,
  onMaterialAction,
}) {
  const courseOptions = getCourseSelectOptions(courses);
  const handleCourseSelect = (courseId) => {
    const course = (courses || []).find((item) => (item.courseId || item.id) === courseId);
    form.setFieldValue('syllabusDescription', course?.description || '');
    onCourseChange(courseId);
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={9}>
        <Card title="Tải học liệu dùng chung" hoverable>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title="Admin quản lý học liệu dùng chung cho tất cả lớp thuộc môn học."
          />
          <Form form={form} layout="vertical" onFinish={onUpload}>
            <Form.Item label="Môn học" required>
              <Select
                placeholder="Chọn môn học"
                value={materialCourseId || undefined}
                onChange={handleCourseSelect}
                options={courseOptions}
              />
            </Form.Item>
            <Form.Item
              className="syllabus-form-item"
              name="syllabusDescription"
              label="Nội dung chính trong chương trình học (syllabus)"
              extra="Nội dung này do nhà trường cung cấp và sẽ được AI Tutor hiển thị trực tiếp, không tự suy luận từ tài liệu."
              rules={[
                { required: true, whitespace: true, message: 'Nhập syllabus chính thức của môn học' },
                {
                  validator: (_, value) => (
                    !value || String(value).split(/\r?\n/).some((line) => line.includes(':'))
                      ? Promise.resolve()
                      : Promise.reject(new Error('Mỗi chủ đề cần theo định dạng "Chủ đề: mô tả"'))
                  ),
                },
              ]}
            >
              <Input.TextArea
                rows={8}
                maxLength={20000}
                showCount
                placeholder={'Cú pháp Python: Quy tắc viết câu lệnh, biểu thức và comment\nNhập xuất & tương tác: Nhận dữ liệu người dùng và in kết quả\nCấu trúc điều khiển: if/else, vòng lặp và rẽ nhánh'}
              />
            </Form.Item>
            <Form.Item name="title" label="Tên học liệu" rules={[{ required: true, message: 'Nhập tên học liệu' }]}>
              <Input placeholder="Lecture 01 - OOP" />
            </Form.Item>
            <Dragger
              beforeUpload={(file) => {
                onFileChange(file);
                return false;
              }}
              fileList={materialFile ? [materialFile] : []}
              onRemove={onFileRemove}
              accept=".pdf,.md,.markdown"
              maxCount={1}
              style={{ marginBottom: 16 }}
            >
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p className="ant-upload-text">Chọn tệp học liệu môn học</p>
              <p className="ant-upload-hint">PDF hoặc Markdown. Học liệu áp dụng toàn môn và không gửi mã lớp.</p>
            </Dragger>
            <Button
              type="primary"
              htmlType="submit"
              block
              icon={<UploadOutlined />}
              loading={materialUploadBusy}
              disabled={!materialCourseId || !materialFile || materialUploadBusy}
            >
              {materialUploadBusy ? 'Đang tải lên...' : 'Tải học liệu'}
            </Button>
            <Button
              block
              icon={<GlobalOutlined />}
              style={{ marginTop: 10 }}
              disabled={!materialCourseId || materialUploadBusy}
              onClick={onOpenWebsiteImport}
            >
              Import từ URL website
            </Button>
          </Form>
        </Card>
        <ImportProgressCard
          job={activeImportJob}
          loading={importJobLoading}
          onRetry={onRetryImportJob}
          onCancel={onCancelImportJob}
        />
      </Col>
      <Col xs={24} lg={15} style={{ minWidth: 0 }}>
        <Card
          className="admin-materials-table-card"
          title="Học liệu dùng chung"
          hoverable
          style={{ overflow: 'hidden' }}
          styles={{ body: { overflowX: 'auto', padding: '16px' } }}
          extra={<Button size="small" onClick={onReload} icon={<RefreshCw size={14} />} disabled={!materialCourseId}>Làm mới</Button>}
        >
          {materialsLoading && courseMaterials.length === 0 ? (
            <div className="admin-material-loading">Đang tải...</div>
          ) : (
            <DataTable
              data={courseMaterials || []}
              searchable
              searchKeys={['title', 'fileName', 'sourceFileName', 'sourceUrl', 'classId', 'indexingStatus']}
              searchPlaceholder="Tìm tên, nguồn hoặc trạng thái học liệu"
              maxBodyHeight={560}
              columns={[
                {
                  accessorKey: 'title',
                  header: 'Tên học liệu',
                  cell: ({ row }) => (
                    <span className="admin-material-title-text" title={row.getValue('title') || 'Học liệu chưa đặt tên'}>
                      {row.getValue('title') || 'Học liệu chưa đặt tên'}
                    </span>
                  ),
                },
                {
                  accessorKey: 'fileName',
                  header: 'Nguồn',
                  cell: ({ row }) => (
                    <Space orientation="vertical" size={2}>
                      <Space size={6} wrap>
                        <Tag color={isWebsiteMaterial(row.original) ? 'blue' : 'default'}>
                          {isWebsiteMaterial(row.original) ? 'Website' : 'PDF'}
                        </Tag>
                        {row.original.indexingStatus && <StatusLabel status={row.original.indexingStatus} />}
                      </Space>
                      <span className="admin-material-source-text">
                        {isWebsiteMaterial(row.original)
                          ? getWebsiteSourceLabel(row.original)
                          : row.getValue('fileName') || row.original.sourceFileName || row.original.filePath || 'Không có tên tệp'}
                      </span>
                    </Space>
                  ),
                },
                { 
                  accessorKey: 'classId', 
                  header: 'Phạm vi',
                  cell: ({ row }) => <Tag>{row.getValue('classId') || 'Toàn môn học'}</Tag>
                },
                {
                  accessorKey: 'createdAt',
                  header: 'Ngày tải lên',
                  cell: ({ row }) => (
                    <span className="admin-material-date-text">
                      {row.getValue('createdAt') ? new Date(row.getValue('createdAt')).toLocaleString('vi-VN') : '—'}
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
                          { key: 'view', icon: <Eye size={14} />, label: 'Xem chi tiết' },
                          { key: 'edit', icon: <Pencil size={14} />, label: 'Sửa thông tin' },
                          {
                            key: 'download',
                            icon: <DownloadOutlined />,
                            label: isWebsiteMaterial(row.original) ? 'Không có tệp PDF' : 'Tải xuống',
                            disabled: isWebsiteMaterial(row.original),
                          },
                          { key: 'reindex', icon: <Database size={14} />, label: 'Lập chỉ mục lại' },
                          { type: 'divider' },
                          { key: 'delete', icon: <Trash2 size={14} />, label: 'Xóa', danger: true },
                        ]}
                        onAction={(key) => onMaterialAction(key, row.original, materialId)}
                        ariaLabel="Thao tác học liệu"
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
