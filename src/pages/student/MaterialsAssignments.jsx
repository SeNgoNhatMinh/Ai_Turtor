import { Button, Card, Empty, Input, Space, Table, Tag, Typography, Upload, Tabs } from 'antd';
import { DownloadOutlined, FileTextOutlined, UploadOutlined } from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import { uiCopy } from '../../constants/uiCopy';
import { getMaterialDisplayName } from '../../utils/sourceLabels';

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
  isSubmitting = false,
  onDownloadAssignment,
  onDownloadSubmission,
  courseMaterials = [],
  onDownloadMaterial,
}) {
  const getAssignmentFileName = (assignment) => assignment?.attachmentFileName
    || assignment?.fileName
    || assignment?.originalFileName
    || assignment?.title
    || 'Assignment attachment';

  const assignmentCols = [
    { title: 'Assignment', dataIndex: 'title', key: 'title', render: (text) => <Text strong>{text}</Text> },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        const normalized = String(record.submission?.status || status || 'PENDING').toUpperCase();
        const isSubmitted = Boolean(record.submission);
        return <Tag color={normalized === 'REVIEWED' ? 'green' : isSubmitted ? 'blue' : 'orange'}>{normalized.replaceAll('_', ' ')}</Tag>;
      },
    },
    { title: 'Score', dataIndex: 'score', key: 'score', render: (score) => score ?? '-' },
    {
      title: 'Deadline',
      key: 'deadline',
      render: (_, record) => {
        const value = record.dueAt || record.deadline;
        return value ? new Date(value).toLocaleString() : '-';
      },
    },
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
                rowKey={(record) => record.id || record.assignmentId}
                pagination={false}
                onRow={(record) => ({
                  onClick: () => setSelectedAssignment(record),
                  style: {
                    cursor: 'pointer',
                    background: (selectedAssignment?.id || selectedAssignment?.assignmentId) === (record.id || record.assignmentId)
                      ? 'var(--surface-selected, #fff4ec)'
                      : 'transparent',
                  },
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
                  <Paragraph>{selectedAssignment.description || selectedAssignment.desc || 'No assignment description.'}</Paragraph>
                  <div className="assignment-attachment">
                    <Space>
                      <FileTextOutlined style={{ fontSize: 24, color: '#F37021' }} />
                      <div>
                        <Text strong>{getAssignmentFileName(selectedAssignment)}</Text>
                        <br />
                        <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => onDownloadAssignment(selectedAssignment.id || selectedAssignment.assignmentId)} style={{ padding: 0 }}>
                          Download assignment
                        </Button>
                      </div>
                    </Space>
                  </div>

                  {selectedAssignment.submission && (
                    <Card size="small" title="Your submission" style={{ marginBottom: 16 }}>
                      <Space direction="vertical" size={4}>
                        <Text>Status: {String(selectedAssignment.submission.status || 'SUBMITTED').replaceAll('_', ' ')}</Text>
                        {selectedAssignment.submission.score != null && <Text strong>Score: {selectedAssignment.submission.score}</Text>}
                        {selectedAssignment.submission.teacherFeedback && (
                          <Paragraph style={{ margin: 0 }}>Teacher feedback: {selectedAssignment.submission.teacherFeedback}</Paragraph>
                        )}
                        <Button
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={() => onDownloadSubmission?.(selectedAssignment.submission)}
                        >
                          Download submitted file
                        </Button>
                      </Space>
                    </Card>
                  )}

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
                  <Button type="primary" block loading={isSubmitting} disabled={!studentSubmissionFile} onClick={onStudentSubmit}>
                    {selectedAssignment.submission ? 'Submit a new version' : 'Submit assignment'}
                  </Button>
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
                    render: (_, record) => (
                      <Text type="secondary">
                        {getMaterialDisplayName(record) || 'Material file unavailable'}
                      </Text>
                    )
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
