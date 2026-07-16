import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Divider, Form, Input, InputNumber, Modal, Space, Tag, Typography } from 'antd';
import { GlobalOutlined, ImportOutlined, SearchOutlined } from '@ant-design/icons';
import { getUserFacingError } from '../../services/apiClient';
import './ImportWebsiteModal.css';

const { Text } = Typography;
const MAX_SELECTED_URLS = 50;

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeTocResponse(data) {
  const items = Array.isArray(data?.items)
    ? data.items
        .filter((item) => item?.url && item?.title)
        .map((item) => ({
          title: String(item.title || '').trim(),
          url: String(item.url || '').trim(),
          level: Math.max(1, Number(item.level) || 1),
          anchor: item.anchor || null,
        }))
    : [];

  return {
    title: data?.title || '',
    sourceUrl: data?.sourceUrl || '',
    itemCount: Number(data?.itemCount) || items.length,
    items,
  };
}

export default function ImportWebsiteModal({
  open,
  onClose,
  courseId,
  currentUser,
  materialApi,
  triggerToast,
  onUploaded,
  isAdmin = false,
}) {
  const [form] = Form.useForm();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [toc, setToc] = useState(null);
  const [selectedUrls, setSelectedUrls] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [fallbackFollowNext, setFallbackFollowNext] = useState(false);
  const [fallbackMaxPages, setFallbackMaxPages] = useState(3);

  const tocItems = useMemo(() => toc?.items || [], [toc]);
  const hasToc = tocItems.length > 0;
  const visibleTocItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return tocItems;
    return tocItems.filter((item) =>
      item.title.toLowerCase().includes(keyword) || item.url.toLowerCase().includes(keyword)
    );
  }, [searchText, tocItems]);

  useEffect(() => {
    if (open) {
      const resetTimer = window.setTimeout(() => {
        form.resetFields();
        setToc(null);
        setSelectedUrls([]);
        setSearchText('');
        setFallbackFollowNext(false);
        setFallbackMaxPages(3);
        setIsAnalyzing(false);
        setIsImporting(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }
    return undefined;
  }, [open, form]);

  const validateBaseForm = async () => {
    const values = await form.validateFields(['url', 'title']);
    if (!courseId) {
      throw new Error('Choose a course before importing documentation.');
    }
    if (!isValidHttpUrl(values.url)) {
      throw new Error('Documentation URL must start with http or https.');
    }
    return values;
  };

  const handleAnalyze = async () => {
    try {
      const values = await validateBaseForm();
      setIsAnalyzing(true);
      setToc(null);
      setSelectedUrls([]);
      setSearchText('');

      const data = await materialApi.previewMaterialUrlToc(courseId, { url: values.url.trim() });
      const normalized = normalizeTocResponse(data);
      setToc(normalized);

      if (normalized.items.length === 0) {
        triggerToast?.('No table of contents found. You can still import this URL directly.');
      } else {
        triggerToast?.(`Found ${normalized.items.length} chapters or sections.`);
      }
    } catch (error) {
      triggerToast?.(getUserFacingError(error, error?.message || 'Unable to analyze documentation URL.'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleUrl = (url, checked) => {
    setSelectedUrls((current) => {
      if (!checked) return current.filter((item) => item !== url);
      if (current.includes(url)) return current;
      if (current.length >= MAX_SELECTED_URLS) {
        triggerToast?.(`You can select up to ${MAX_SELECTED_URLS} sections per import.`);
        return current;
      }
      return [...current, url];
    });
  };

  const selectVisibleUrls = () => {
    const next = [];
    const seen = new Set();

    [...selectedUrls, ...visibleTocItems.map((item) => item.url)].forEach((url) => {
      if (url && !seen.has(url) && next.length < MAX_SELECTED_URLS) {
        seen.add(url);
        next.push(url);
      }
    });

    setSelectedUrls(next);
    if (visibleTocItems.length > MAX_SELECTED_URLS || next.length === MAX_SELECTED_URLS) {
      triggerToast?.(`Selected the first ${MAX_SELECTED_URLS} available sections.`);
    }
  };

  const clearVisibleUrls = () => {
    const visibleSet = new Set(visibleTocItems.map((item) => item.url));
    setSelectedUrls((current) => current.filter((url) => !visibleSet.has(url)));
  };

  const handleImport = async () => {
    try {
      const values = await validateBaseForm();
      const title = String(values.title || toc?.title || '').trim();
      const teacherId = currentUser?.userId || currentUser?.id || currentUser?._id || 'ADMIN';
      const selected = selectedUrls.slice(0, MAX_SELECTED_URLS);
      const uploaderRole = isAdmin ? 'ADMIN' : 'TEACHER';

      if (!isAdmin) {
        if (!toc) {
          triggerToast?.('Analyze the URL before importing.');
          return;
        }
        if (hasToc && selected.length === 0) {
          triggerToast?.('Choose at least one chapter or section to import.');
          return;
        }
        if (selectedUrls.length > MAX_SELECTED_URLS) {
          triggerToast?.(`Choose ${MAX_SELECTED_URLS} sections or fewer.`);
          return;
        }
      }

      setIsImporting(true);

      const payload = (isAdmin || !hasToc)
        ? {
            url: isAdmin ? values.url.trim() : values.url.trim(),
            title,
            uploaderRole,
            teacherId,
            followNext: isAdmin ? true : fallbackFollowNext,
            maxPages: isAdmin ? 10 : (fallbackFollowNext ? Math.min(Math.max(Number(fallbackMaxPages) || 1, 1), 10) : 1),
          }
        : {
            url: toc?.sourceUrl || values.url.trim(),
            title,
            uploaderRole,
            teacherId,
            selectedUrls: selected,
          };

      const response = await materialApi.importCourseMaterialUrl(courseId, payload);

      triggerToast?.('Import started. Indexing is running in the background.');
      await onUploaded?.(response?.title || title || 'Website documentation');
      onClose();
    } catch (error) {
      triggerToast?.(getUserFacingError(error, error?.message || 'Failed to start website import.'));
    } finally {
      setIsImporting(false);
    }
  };

  const importDisabled = isAdmin
    ? (!courseId || isImporting)
    : (!courseId || isAnalyzing || isImporting || !toc || (hasToc && (selectedUrls.length === 0 || selectedUrls.length > MAX_SELECTED_URLS)));

  return (
    <Modal
      open={open}
      title="Import Website URL"
      onCancel={onClose}
      width={820}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={isAnalyzing || isImporting}>
          Cancel
        </Button>,
        <Button
          key="import"
          type="primary"
          icon={<ImportOutlined />}
          onClick={handleImport}
          loading={isImporting}
          disabled={importDisabled}
        >
          {hasToc ? `Import Selected (${selectedUrls.length}/${MAX_SELECTED_URLS})` : 'Import URL'}
        </Button>,
      ]}
      destroyOnClose
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Backend website import"
          description="The backend analyzes HTML documentation, imports the selected chapters as course material, then indexes it in the background. Website imports do not create a downloadable PDF."
        />

        {!courseId && (
          <Alert
            type="warning"
            showIcon
            message="Choose a course first"
            description="Website documentation will be imported as a shared course material."
          />
        )}

        <Card size="small">
          <Form
            form={form}
            layout="vertical"
          >
            <Form.Item
              name="url"
              label={<Text strong>Documentation URL</Text>}
              rules={[
                { required: true, message: 'Please enter a documentation URL.' },
                {
                  validator: (_, value) => (
                    !value || isValidHttpUrl(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error('URL must start with http or https.'))
                  ),
                },
              ]}
            >
              <Input
                prefix={<GlobalOutlined />}
                placeholder="https://docs.oracle.com/javase/specs/jvms/se8/html/index.html"
                disabled={isAnalyzing || isImporting}
                onChange={() => {
                  setToc(null);
                  setSelectedUrls([]);
                  setSearchText('');
                }}
              />
            </Form.Item>

            <Form.Item
              name="title"
              label={<Text strong>Material title</Text>}
              tooltip="If left blank, the backend HTML title will be used."
            >
              <Input placeholder="Java Virtual Machine Specification" disabled={isAnalyzing || isImporting} />
            </Form.Item>

            {!isAdmin && (
              <Button
                icon={<SearchOutlined />}
                onClick={handleAnalyze}
                loading={isAnalyzing}
                disabled={!courseId || isImporting}
              >
                Analyze URL
              </Button>
            )}
          </Form>
        </Card>

        {!isAdmin && toc && (
          <Card
            size="small"
            title={
              <Space wrap>
                <span>{toc.title || 'Documentation sections'}</span>
                <Tag color={hasToc ? 'blue' : 'default'}>{toc.itemCount || 0} items</Tag>
                {hasToc && <Tag>{selectedUrls.length}/{MAX_SELECTED_URLS} selected</Tag>}
              </Space>
            }
          >
            {hasToc ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Search chapters or sections"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  disabled={isImporting}
                />
                <Space wrap>
                  <Button size="small" onClick={selectVisibleUrls} disabled={isImporting || visibleTocItems.length === 0}>
                    Select visible
                  </Button>
                  <Button size="small" onClick={clearVisibleUrls} disabled={isImporting || visibleTocItems.length === 0}>
                    Clear visible
                  </Button>
                </Space>
                {selectedUrls.length >= MAX_SELECTED_URLS && (
                  <Alert
                    type="warning"
                    showIcon
                    message={`Selection limit reached (${MAX_SELECTED_URLS})`}
                    description="Backend accepts up to 50 selected chapter or section URLs per import."
                  />
                )}
                <div className="website-toc-list">
                  {visibleTocItems.length === 0 ? (
                    <Text type="secondary">No chapters or sections match your search.</Text>
                  ) : (
                    visibleTocItems.map((item) => (
                      <label
                        key={item.url}
                        className="website-toc-item"
                        style={{ paddingLeft: Math.min(item.level - 1, 5) * 18 + 10 }}
                      >
                        <Checkbox
                          checked={selectedUrls.includes(item.url)}
                          onChange={(event) => toggleUrl(item.url, event.target.checked)}
                          disabled={isImporting}
                        />
                        <span className="website-toc-copy">
                          <span className="website-toc-title">{item.title}</span>
                          <span className="website-toc-url">{item.url}</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </Space>
            ) : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Alert
                  type="warning"
                  showIcon
                  message="No table of contents found"
                  description="You can still import the current URL. Enable Follow Next only when this documentation has reliable Next links."
                />
                <Divider style={{ margin: '4px 0' }} />
                <Checkbox
                  checked={fallbackFollowNext}
                  disabled={isImporting}
                  onChange={(event) => setFallbackFollowNext(event.target.checked)}
                >
                  Follow same-domain "Next" links
                </Checkbox>
                {fallbackFollowNext && (
                  <Space direction="vertical" size={4}>
                    <Text strong>Maximum pages</Text>
                    <InputNumber
                      min={1}
                      max={10}
                      value={fallbackMaxPages}
                      disabled={isImporting}
                      onChange={(value) => setFallbackMaxPages(value || 1)}
                    />
                  </Space>
                )}
              </Space>
            )}
          </Card>
        )}
      </Space>
    </Modal>
  );
}
