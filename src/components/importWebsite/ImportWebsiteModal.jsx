import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Divider, Input, Modal, Space, Typography } from 'antd';
import { GlobalOutlined, ImportOutlined } from '@ant-design/icons';
import AiAnswer from '../AiAnswer';
import { useCrawler, IMPORT_STEPS } from '../../hooks/useCrawler';
import DocumentationTree from './DocumentationTree';
import ProgressDialog from './ProgressDialog';

const { Text, Title } = Typography;

const getErrorMessage = (error) =>
  error?.message || 'Website import failed. Please try another documentation site.';

export default function ImportWebsiteModal({
  open,
  onClose,
  courseId,
  currentUser,
  apiService,
  triggerToast,
  onUploaded,
}) {
  const crawler = useCrawler();
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [search, setSearch] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [previewMarkdown, setPreviewMarkdown] = useState('');

  const selectedCount = crawler.selectedPages.length;
  const canAnalyze = Boolean(urlInput.trim()) && !crawler.isAnalyzing && !isImporting;
  const canImport =
    Boolean(courseId && selectedCount > 0 && titleInput.trim()) &&
    !crawler.isAnalyzing &&
    !isImporting;

  const titleValue = useMemo(
    () => titleInput || crawler.documentTitle || 'Imported Documentation',
    [titleInput, crawler.documentTitle],
  );

  // Reset state when modal closes
  useEffect(() => {
    if (open) return;
    crawler.reset();
    setUrlInput('');
    setTitleInput('');
    setSearch('');
    setPreviewMarkdown('');
    setProgressOpen(false);
  }, [open]);

  // ---------------------------------------------------------------------------
  // Analyze
  // ---------------------------------------------------------------------------

  const handleAnalyze = async () => {
    setPreviewMarkdown('');
    setProgressOpen(true);
    try {
      const result = await crawler.analyze(urlInput);
      if (!titleInput.trim()) {
        setTitleInput(result.title || 'Imported Documentation');
      }
      setTimeout(() => setProgressOpen(false), 500);
    } catch (error) {
      setProgressOpen(false);
      triggerToast?.(getErrorMessage(error));
    }
  };

  // ---------------------------------------------------------------------------
  // Import (download → convert → merge → upload)
  // ---------------------------------------------------------------------------

  const handleImport = async () => {
    if (!courseId) {
      triggerToast?.('Choose a course before importing documentation.');
      return;
    }
    if (!crawler.selectedPages.length) {
      triggerToast?.('Select at least one documentation page.');
      return;
    }

    setIsImporting(true);
    setProgressOpen(true);
    setPreviewMarkdown('');

    try {
      await crawler.importSelected({
        courseId,
        title: titleValue,
        apiService,
        currentUser,
        onSuccess: async (finalTitle) => {
          triggerToast?.('Documentation imported successfully!');
          await onUploaded?.(finalTitle);
          setTimeout(() => setProgressOpen(false), 700);
        },
      });
    } catch (error) {
      setProgressOpen(false);
      triggerToast?.(getErrorMessage(error));
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancel = () => {
    if (isImporting) {
      crawler.cancelImport();
      setIsImporting(false);
    }
    setProgressOpen(false);
  };

  return (
    <>
      <Modal
        open={open}
        title="Import Website Documentation"
        onCancel={onClose}
        width={980}
        footer={[
          <Button key="cancel" onClick={onClose} disabled={isImporting}>
            Cancel
          </Button>,
          <Button
            key="import"
            type="primary"
            icon={<ImportOutlined />}
            onClick={handleImport}
            loading={isImporting}
            disabled={!canImport}
          >
            Import Selected ({selectedCount})
          </Button>,
        ]}
        destroyOnClose
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="Documentation is fetched through a secure CORS proxy."
            description="Supported sites: Oracle Docs, MDN, Microsoft Learn, Spring.io, Python Docs, Kubernetes.io. The proxy only allows whitelisted domains."
          />

          {!courseId && (
            <Alert
              type="warning"
              showIcon
              message="Choose a course first"
              description="Documentation will be imported as a course material."
            />
          )}

          <Card size="small">
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <Text strong>Documentation URL</Text>
                <Input
                  prefix={<GlobalOutlined />}
                  placeholder="https://docs.oracle.com/javase/specs/jvms/se8/html/index.html"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={crawler.isAnalyzing || isImporting}
                  onPressEnter={() => canAnalyze && handleAnalyze()}
                />
              </div>
              <div>
                <Text strong>Material title</Text>
                <Input
                  placeholder="Java Virtual Machine Specification"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  disabled={isImporting}
                />
              </div>
              <Button
                onClick={handleAnalyze}
                loading={crawler.isAnalyzing}
                disabled={!canAnalyze}
              >
                Analyze
              </Button>
            </Space>
          </Card>

          {crawler.error && <Alert type="error" showIcon message={crawler.error} />}

          <DocumentationTree
            pages={crawler.pages}
            checkedKeys={crawler.checkedKeys}
            onCheckedKeysChange={crawler.setCheckedKeys}
            search={search}
            onSearchChange={setSearch}
          />

          {crawler.pages.length > 0 && (
            <Text type="secondary">
              {selectedCount} of {crawler.pages.length} pages selected.
            </Text>
          )}

          {previewMarkdown && (
            <>
              <Divider />
              <Title level={5}>Markdown Preview</Title>
              <div className="website-import-preview">
                <AiAnswer markdown={previewMarkdown.slice(0, 12000)} />
                {previewMarkdown.length > 12000 && (
                  <Text type="secondary">
                    Preview truncated. The full content was sent to the backend.
                  </Text>
                )}
              </div>
            </>
          )}
        </Space>
      </Modal>

      <ProgressDialog
        open={progressOpen}
        current={crawler.progress.step}
        percent={crawler.progress.percent}
        message={crawler.progress.message}
        currentPage={crawler.progress.currentPage}
        steps={IMPORT_STEPS}
        onCancel={isImporting ? handleCancel : undefined}
      />
    </>
  );
}
