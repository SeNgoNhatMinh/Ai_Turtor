import React from 'react';
import { Button, Card, Empty, Input, Space, Table, Tag, Typography, Upload } from 'antd';
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
      <div className="materials-layout">
        <Card title="Assigned Materials & Assignments" className="materials-list-card" bodyStyle={{ flex: 1, padding: 0, overflowY: 'auto' }}>
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
    </div>
  );
}

export default MaterialsAssignments;
