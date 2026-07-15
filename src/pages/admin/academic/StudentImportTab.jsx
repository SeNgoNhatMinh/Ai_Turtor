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
          title="Import Students from Excel"
          hoverable
          extra={<Button size="small" icon={<DownloadOutlined />} onClick={onDownloadTemplate}>Template</Button>}
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Import students into one class section using the generated Excel template."
            description="Run Validate only first to catch file or duplicate student errors before writing data."
          />
          <Form form={form} layout="vertical">
            <Form.Item name="courseId" label="Course" rules={[{ required: true, message: 'Choose a course' }]}>
              <Select placeholder="Choose a course" onChange={onCourseChange}>
                {courses.map((course) => (
                  <Option key={course.courseId || course.id} value={course.courseId}>
                    {course.courseId} - {course.courseName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="classId" label="Class Section" rules={[{ required: true, message: 'Choose a class section' }]}>
              <Select
                placeholder={studentImportCourseId ? 'Choose a class section' : 'Choose a course first'}
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
                <Form.Item name="semesterId" label="Term Code">
                  <Input placeholder="Optional, e.g. SEM5" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="status" label="Status" initialValue="ACTIVE">
                  <Select>
                    <Option value="ACTIVE">Active</Option>
                    <Option value="COMPLETED">Completed</Option>
                    <Option value="INACTIVE">Inactive</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="courseName" label="Course Name Override">
              <Input placeholder="Optional. Uses selected course name by default." />
            </Form.Item>
            <Dragger
              beforeUpload={(file) => {
                const isExcel = /\.(xlsx|xls)$/i.test(file.name);
                if (!isExcel) {
                  triggerToast('Only Excel files are supported (.xlsx or .xls).');
                  return Upload.LIST_IGNORE;
                }
                if (file.size > 5 * 1024 * 1024) {
                  triggerToast('File is too large. Maximum size is 5MB.');
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
              <p className="ant-upload-text">Choose student enrollment Excel file</p>
              <p className="ant-upload-hint">Template columns: Student ID, Student Name.</p>
            </Dragger>
            <Space style={{ width: '100%' }} direction="vertical">
              <Button
                block
                onClick={() => onImport(true)}
                disabled={!studentImportCourseId || !studentImportClassId || !studentImportFile}
                loading={studentImportLoading}
              >
                Validate Only
              </Button>
              <Button
                type="primary"
                block
                icon={<UploadOutlined />}
                onClick={() => onImport(false)}
                disabled={!studentImportCourseId || !studentImportClassId || !studentImportFile}
                loading={studentImportLoading}
              >
                Import Students
              </Button>
            </Space>
          </Form>
        </Card>
      </Col>
      <Col xs={24} lg={15} style={{ minWidth: 0 }}>
        <Card title="Import Result" hoverable>
          {!studentImportResult ? (
            <Alert
              type="success"
              showIcon
              message="Ready to import"
              description="Download the template, fill Student ID and Student Name, then validate the file before importing."
            />
          ) : (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                type={studentImportResult.success === false ? 'error' : 'success'}
                showIcon
                message={studentImportResult.message || (studentImportResult.dryRun ? 'Validation completed.' : 'Import completed.')}
                description={`Rows: ${studentImportResult.totalRows ?? 0} | Success: ${studentImportResult.successCount ?? 0} | Errors: ${studentImportResult.errorCount ?? 0}`}
              />
              <Row gutter={[16, 16]}>
                <Col xs={24} md={12} style={{ minWidth: 0 }}>
                  <Card size="small" title="Success Messages">
                    <Table
                      scroll={{ x: 300 }}
                      dataSource={(studentImportResult.successMessages || []).map((text, index) => ({ id: `success-${index}`, text }))}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: 5 }}
                      columns={[{ title: 'Message', dataIndex: 'text', key: 'text' }]}
                      locale={{ emptyText: 'No success messages.' }}
                    />
                  </Card>
                </Col>
                <Col xs={24} md={12} style={{ minWidth: 0 }}>
                  <Card size="small" title="Error Messages">
                    <Table
                      scroll={{ x: 300 }}
                      dataSource={(studentImportResult.errorMessages || []).map((text, index) => ({ id: `error-${index}`, text }))}
                      rowKey="id"
                      size="small"
                      pagination={{ pageSize: 5 }}
                      columns={[{ title: 'Message', dataIndex: 'text', key: 'text' }]}
                      locale={{ emptyText: 'No errors.' }}
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
