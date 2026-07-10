import { Button, Card, Empty, Input, Space, Table, Tag, Typography, Upload, Tabs } from 'antd';
import { DownloadOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import { uiCopy } from '../../constants/uiCopy';

const { Paragraph, Text, Title } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

function MaterialsAssignments({
  assignments,
  selectedAssignment,
  setSelectedAssignment,
  studentSubmissionFile,
  setStudentSubmissionFile,
  studentSubmissionNote,
  setStudentSubmissionNote,
  onStudentSubmit,
  onDownloadAssignment,
  courseMaterials = [],
  onDownloadMaterial,
}) {
  const assignmentCols = [
    { title: 'Assignment', dataIndex: 'title', key: 'title', render: (text) => <Text strong>{text}</Text> },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={status === 'pending' ? 'orange' : 'green'}>{status === 'pending' ? 'Pending' : 'Graded'}</Tag>,
    },
    { title: 'Score', dataIndex: 'score', key: 'score', render: (score) => score || '-' },
    { title: 'Deadline', dataIndex: 'deadline', key: 'deadline' },
  ];

  return (
    <div className="portal-section">
      <PageHeader title={uiCopy.student.materials.title} description={uiCopy.student.materials.subtitle} />
      
      <Tabs defaultActiveKey="assignments" type="card" style={{ width: '100%' }}>
        <Tabs.TabPane tab="Assignments & Tasks" key="assignments">
          <div className="materials-layout">
            <Card title="Assigned Materials & Assignments" className="materials-list-card" styles={{ body: { flex: 1, padding: 0, overflowY: 'auto' } }}>
              <Table
                dataSource={Array.isArray(assignments) ? assignments : []}
                columns={assignmentCols}
                rowKey="id"
                pagination={false}
                onRow={(record) => ({
                  onClick: () => setSelectedAssignment(record),
                  style: { cursor: 'pointer', background: selectedAssignment?.id === record.id ? '#FFF0E6' : 'transparent' },
                })}
              />
            </Card>

            <Card
              title={selectedAssignment ? `Details: ${selectedAssignment.title}` : 'Assignment Details'}
              className="materials-detail-card"
              extra={selectedAssignment ? <Text type="secondary">{selectedAssignment.deadline}</Text> : null}
            >
              {!selectedAssignment ? (
                <Empty description={uiCopy.student.materials.empty} />
              ) : (
                <>
                  <Paragraph>{selectedAssignment.desc}</Paragraph>
                  <div className="assignment-attachment">
                    <Space>
                      <FileTextOutlined style={{ fontSize: 24, color: '#F37021' }} />
                      <div>
                        <Text strong>Attachment ({selectedAssignment.id})</Text>
                        <br />
                        <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => onDownloadAssignment(selectedAssignment.id)} style={{ padding: 0 }}>
                          Download assignment
                        </Button>
                      </div>
                    </Space>
                  </div>

                  <Title level={5}>Submit work</Title>
                  <Dragger
                    beforeUpload={(file) => {
                      setStudentSubmissionFile(file);
                      return false;
                    }}
                    fileList={studentSubmissionFile ? [studentSubmissionFile] : []}
                    onRemove={() => setStudentSubmissionFile(null)}
                    style={{ marginBottom: 16 }}
                  >
                    <p className="ant-upload-drag-icon"><UploadOutlined /></p>
                    <p className="ant-upload-text">{uiCopy.student.materials.uploadText}</p>
                    <p className="ant-upload-hint">{uiCopy.student.materials.uploadHint}</p>
                  </Dragger>

                  <TextArea
                    rows={3}
                    placeholder="Add a note for your teacher..."
                    value={studentSubmissionNote}
                    onChange={(event) => setStudentSubmissionNote(event.target.value)}
                    style={{ marginBottom: 16 }}
                  />
                  <Button type="primary" block onClick={onStudentSubmit}>Submit</Button>
                </>
              )}
            </Card>
          </div>
        </Tabs.TabPane>

        <Tabs.TabPane tab="Course Learning Materials" key="materials">
          <Card styles={{ body: { padding: 16 } }}>
            {(!courseMaterials || courseMaterials.length === 0) ? (
              <Empty description="No learning materials uploaded yet for this course." />
            ) : (
              <Table
                dataSource={courseMaterials}
                rowKey="id"
                pagination={{ pageSize: 8 }}
                columns={[
                  {
                    title: 'Material Title',
                    dataIndex: 'title',
                    key: 'title',
                    render: (text) => <Text strong>{text || 'Untitled Material'}</Text>
                  },
                  {
                    title: 'File Name',
                    dataIndex: 'fileName',
                    key: 'fileName',
                    render: (text, record) => <Text type="secondary" style={{ fontFamily: 'monospace' }}>{record.fileName || record.filePath || record.id}</Text>
                  },
                  {
                    title: 'Scope',
                    dataIndex: 'classId',
                    key: 'classId',
                    render: (text) => <Tag color="orange">{text || 'Course-wide'}</Tag>
                  },
                  {
                    title: 'Upload Date',
                    dataIndex: 'createdAt',
                    key: 'createdAt',
                    render: (text) => <Text type="secondary">{text ? new Date(text).toLocaleDateString() : '—'}</Text>
                  },
                  {
                    title: 'Download',
                    key: 'action',
                    width: 120,
                    render: (_, record) => (
                      <Button 
                        type="primary" 
                        size="small" 
                        icon={<DownloadOutlined />} 
                        onClick={() => onDownloadMaterial?.(record.id, record.title)}
                        style={{ background: 'linear-gradient(135deg, #F37021 0%, #FF8F42 100%)', border: 'none' }}
                      >
                        Download
                      </Button>
                    )
                  }
                ]}
              />
            )}
          </Card>
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
}

export default MaterialsAssignments;
