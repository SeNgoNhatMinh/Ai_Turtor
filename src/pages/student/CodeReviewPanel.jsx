import React from 'react';
import { Button, Card, Empty, Input, Select, Typography } from 'antd';
import { CodeOutlined } from '@ant-design/icons';
import { uiCopy } from '../../constants/uiCopy';
import HelpText from '../../components/common/HelpText';

const { Text, Title } = Typography;
const { TextArea } = Input;
const { Option } = Select;

function CodeReviewPanel({
  codeLanguage,
  setCodeLanguage,
  codeSnippet,
  setCodeSnippet,
  onCodeReviewQuery,
  isCodeAnalyzing,
  codeMentorDiagnostics,
}) {
  return (
    <div style={{ padding: 16 }}>
      <HelpText>{uiCopy.student.codeReview.subtitle}</HelpText>
      <Select value={codeLanguage} onChange={setCodeLanguage} style={{ width: '100%', margin: '16px 0' }}>
        <Option value="java">Java Spring Boot</Option>
        <Option value="javascript">JavaScript</Option>
        <Option value="python">Python</Option>
      </Select>
      <TextArea
        placeholder={uiCopy.student.codeReview.inputPlaceholder}
        rows={8}
        value={codeSnippet}
        onChange={(event) => setCodeSnippet(event.target.value)}
        style={{ marginBottom: 16, fontFamily: 'monospace' }}
      />
      <Button type="primary" block onClick={onCodeReviewQuery} loading={isCodeAnalyzing} icon={<CodeOutlined />}>
        {uiCopy.student.codeReview.action}
      </Button>
      <div style={{ marginTop: 24 }}>
        <Title level={5}>Diagnostics result</Title>
        {codeMentorDiagnostics ? (
          <Card size="small" className="diagnostics-card">
            <Text style={{ whiteSpace: 'pre-line' }}>{codeMentorDiagnostics}</Text>
          </Card>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={uiCopy.student.codeReview.empty} />
        )}
      </div>
    </div>
  );
}

export default CodeReviewPanel;
