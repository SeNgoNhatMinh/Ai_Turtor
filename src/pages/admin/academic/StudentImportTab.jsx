import { Alert, Button, Card, Col, Form, Input, Row, Select, Space, Table, Upload } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { getClassCode } from './adminAcademicUtils';

const { Option } = Select;
const { Dragger } = Upload;

function StudentImportTab({
  form,
  courses,
  studentImportCourseId,
  studentImportClassId,
  studentImportClasses,
  studentImportFile,
  studentImportLoading,
  studentImportResult,
  triggerToast,
  onDownloadTemplate,
  onCourseChange,
  onClassChange,
  onFileChange,
  onFileRemove,
  onImport,
}) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={9}>
        <Card
          title="Import sinh viên từ Excel"
          hoverable
          extra={<Button size="small" icon={<DownloadOutlined />} onClick={onDownloadTemplate}>Tải tệp mẫu</Button>}
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title="Import sinh viên vào một lớp học phần bằng tệp Excel mẫu."
            description="Hãy kiểm tra dữ liệu trước để phát hiện lỗi tệp hoặc sinh viên trùng trước khi ghi dữ liệu."
          />
          <Form form={form} layout="vertical">
            <Form.Item name="courseId" label="Môn học" rules={[{ required: true, message: 'Chọn môn học' }]}>
              <Select placeholder="Chọn môn học" onChange={onCourseChange}>
                {courses.map((course) => (
                  <Option key={course.courseId || course.id} value={course.courseId}>
                    {course.courseId} - {course.courseName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="classId" label="Lớp học phần" rules={[{ required: true, message: 'Chọn lớp học phần' }]}>
              <Select
                placeholder={studentImportCourseId ? 'Chọn lớp học phần' : 'Chọn môn học trước'}
                disabled={!studentImportCourseId}
                onChange={onClassChange}
              >
                {studentImportClasses.map((classSection) => {
                  const classCode = getClassCode(classSection);
                  const teacherLabel = classSection.teacherName || classSection.mentorName || classSection.teacherEmail || classSection.teacherId;
                  return (
                  <Option key={classCode} value={classCode}>
                    {classCode}{teacherLabel ? ` - ${teacherLabel}` : ''}
                  </Option>
                  );
                })}
              </Select>
            </Form.Item>
            <Row gutter={12}>
              <Col xs={24} md={12}>
                <Form.Item name="semesterId" label="Mã học kỳ">
                  <Input placeholder="Không bắt buộc, ví dụ: SEM5" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="status" label="Trạng thái" initialValue="ACTIVE">
                  <Select>
                    <Option value="ACTIVE">Đang hoạt động</Option>
                    <Option value="COMPLETED">Đã hoàn tất</Option>
                    <Option value="INACTIVE">Ngừng hoạt động</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="courseName" label="Tên môn học thay thế">
              <Input placeholder="Không bắt buộc. Mặc định dùng tên môn đã chọn." />
            </Form.Item>
            <Dragger
              beforeUpload={(file) => {
                const isExcel = /\.(xlsx|xls)$/i.test(file.name);
                if (!isExcel) {
                  triggerToast('Chỉ hỗ trợ tệp Excel (.xlsx hoặc .xls).');
                  return Upload.LIST_IGNORE;
                }
                if (file.size > 5 * 1024 * 1024) {
                  triggerToast('Tệp quá lớn. Dung lượng tối đa là 5 MB.');
                  return Upload.LIST_IGNORE;
                }
                onFileChange(file);
                return false;
              }}
              fileList={studentImportFile ? [studentImportFile] : []}
              onRemove={onFileRemove}
              accept=".xlsx,.xls"
              maxCount={1}
              style={{ marginBottom: 16 }}
            >
              <p className="ant-upload-drag-icon"><UploadOutlined /></p>
              <p className="ant-upload-text">Chọn tệp Excel ghi danh sinh viên</p>
              <p className="ant-upload-hint">Các cột mẫu: Student ID, Student Name.</p>
            </Dragger>
            <Space style={{ width: '100%' }} orientation="vertical">
              <Button
                block
                onClick={() => onImport(true)}
                disabled={!studentImportCourseId || !studentImportClassId || !studentImportFile}
                loading={studentImportLoading}
              >
                Kiểm tra dữ liệu
              </Button>
              <Button
                type="primary"
                block
                icon={<UploadOutlined />}
                onClick={() => onImport(false)}
                disabled={!studentImportCourseId || !studentImportClassId || !studentImportFile}
                loading={studentImportLoading}
              >
                Import sinh viên
              </Button>
            </Space>
          </Form>
        </Card>
      </Col>
      <Col xs={24} lg={15} style={{ minWidth: 0 }}>
        <Card title="Kết quả import" hoverable>
          {!studentImportResult ? (
            <Alert
              type="success"
              showIcon
              title="Sẵn sàng import"
              description="Tải tệp mẫu, điền Student ID và Student Name, sau đó kiểm tra trước khi import."
            />
          ) : (
            <Space orientation="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                type={studentImportResult.success === false ? 'error' : 'success'}
                showIcon
                title={studentImportResult.message || (studentImportResult.dryRun ? 'Đã kiểm tra dữ liệu.' : 'Đã hoàn tất import.')}
                description={`Tổng dòng: ${studentImportResult.totalRows ?? 0} | Thành công: ${studentImportResult.successCount ?? 0} | Lỗi: ${studentImportResult.errorCount ?? 0}`}
              />
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12} style={{ minWidth: 0 }}>
                  <Card size="small" title="Dòng thành công">
                    <Table
                      scroll={{ x: 300 }}
                      dataSource={(studentImportResult.successMessages || []).map((text, index) => ({ id: `success-${index}`, text }))}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: 5 }}
                      columns={[{ title: 'Nội dung', dataIndex: 'text', key: 'text' }]}
                      locale={{ emptyText: 'Không có thông báo thành công.' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={12} style={{ minWidth: 0 }}>
                  <Card size="small" title="Dòng có lỗi">
                    <Table
                      scroll={{ x: 300 }}
                      dataSource={(studentImportResult.errorMessages || []).map((text, index) => ({ id: `error-${index}`, text }))}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: 5 }}
                      columns={[{ title: 'Nội dung', dataIndex: 'text', key: 'text' }]}
                      locale={{ emptyText: 'Không có lỗi.' }}
                    />
                  </Card>
                </Col>
              </Row>
            </Space>
          )}
        </Card>
      </Col>
    </Row>
  );
}

export default StudentImportTab;
