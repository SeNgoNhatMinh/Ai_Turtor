import { useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Divider, Form, Input, InputNumber, Modal, Space, Tag, Typography } from 'antd';
import { FolderOpenOutlined, GlobalOutlined, ImportOutlined, LinkOutlined, SearchOutlined } from '@ant-design/icons';
import { getUserFacingError } from '../../services/apiClient';
import './ImportWebsiteModal.css';

const { Text } = Typography;

const NON_HTML_FILE_PATTERN = /\.(?:pdf|zip|rar|7z|docx?|pptx?|xlsx?|txt|md|json|xml|css|js|mjs|map|png|jpe?g|gif|svg|webp|ico|mp3|mp4|webm|woff2?|ttf|eot)$/i;

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

function getPathType(url) {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (/\.html?$/.test(path)) return 'HTML';
    return 'Không đuôi';
  } catch {
    return 'Trang web';
  }
}

function getGroupKey(item, sourceUrl) {
  try {
    const itemUrl = new URL(item.url);
    const source = new URL(sourceUrl || item.url);
    const sourceSegments = source.pathname.split('/').filter(Boolean);
    if (sourceSegments.at(-1)?.includes('.')) sourceSegments.pop();
    const itemSegments = itemUrl.pathname.split('/').filter(Boolean);
    const relative = itemSegments.slice(sourceSegments.length);
    return relative.length > 1 ? relative[0] : 'other';
  } catch {
    return 'other';
  }
}

function formatGroupLabel(key) {
  if (key === 'other') return 'Trang tài liệu';
  return decodeURIComponent(key)
    .replace(/^[A-Z0-9]+[-_]/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildPathGroups(items, sourceUrl) {
  const groups = new Map();
  items.forEach((item) => {
    const key = getGroupKey(item, sourceUrl);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return Array.from(groups, ([key, groupItems]) => ({
    key,
    label: formatGroupLabel(key),
    items: groupItems,
  }));
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
  const [manualPaths, setManualPaths] = useState('');
  const [manualItems, setManualItems] = useState([]);
  const [manualPathError, setManualPathError] = useState('');

  const tocItems = useMemo(() => {
    const byUrl = new Map();
    [...(toc?.items || []), ...manualItems].forEach((item) => byUrl.set(item.url, item));
    return Array.from(byUrl.values());
  }, [manualItems, toc]);
  const hasToc = tocItems.length > 0;
  const visibleTocItems = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    if (!keyword) return tocItems;
    return tocItems.filter((item) =>
      item.title.toLowerCase().includes(keyword) || item.url.toLowerCase().includes(keyword)
    );
  }, [searchText, tocItems]);
  const selectedUrlSet = useMemo(() => new Set(selectedUrls), [selectedUrls]);
  const pathGroups = useMemo(
    () => buildPathGroups(visibleTocItems, toc?.sourceUrl),
    [toc?.sourceUrl, visibleTocItems],
  );
  const pathTypeSummary = useMemo(
    () => [...new Set(tocItems.map((item) => getPathType(item.url)))],
    [tocItems],
  );

  const handleAfterOpenChange = (visible) => {
    if (visible) return;
    form.resetFields();
    setToc(null);
    setSelectedUrls([]);
    setSearchText('');
    setFallbackFollowNext(false);
    setFallbackMaxPages(3);
    setManualPaths('');
    setManualItems([]);
    setManualPathError('');
    setIsAnalyzing(false);
    setIsImporting(false);
  };

  const validateBaseForm = async () => {
    const values = await form.validateFields(['url', 'title']);
    if (!courseId) {
      throw new Error('Hãy chọn môn học trước khi import tài liệu.');
    }
    if (!isValidHttpUrl(values.url)) {
      throw new Error('URL tài liệu phải bắt đầu bằng http hoặc https.');
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
      setManualPaths('');
      setManualItems([]);
      setManualPathError('');

      const data = await materialApi.previewMaterialUrlToc(courseId, { url: values.url.trim() });
      const normalized = normalizeTocResponse(data);
      setToc(normalized);

      if (normalized.items.length === 0) {
        triggerToast?.('Không tìm thấy mục lục. Bạn vẫn có thể import trực tiếp URL này.');
      } else {
        triggerToast?.(`Đã tìm thấy ${normalized.items.length} chương hoặc mục.`);
      }
    } catch (error) {
      triggerToast?.(getUserFacingError(error, error?.message || 'Không thể phân tích URL tài liệu.'));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleUrl = (url, checked) => {
    setSelectedUrls((current) => {
      if (!checked) return current.filter((item) => item !== url);
      if (current.includes(url)) return current;
      return [...current, url];
    });
  };

  const selectVisibleUrls = () => {
    setSelectedUrls((current) => [
      ...new Set([...current, ...visibleTocItems.map((item) => item.url).filter(Boolean)]),
    ]);
  };

  const clearVisibleUrls = () => {
    const visibleSet = new Set(visibleTocItems.map((item) => item.url));
    setSelectedUrls((current) => current.filter((url) => !visibleSet.has(url)));
  };

  const selectGroup = (items) => {
    setSelectedUrls((current) => [
      ...new Set([...current, ...items.map((item) => item.url)]),
    ]);
  };

  const clearGroup = (items) => {
    const groupUrls = new Set(items.map((item) => item.url));
    setSelectedUrls((current) => current.filter((url) => !groupUrls.has(url)));
  };

  const addManualPaths = async () => {
    try {
      const values = await validateBaseForm();
      const sourceUrl = new URL(toc?.sourceUrl || values.url.trim());
      const candidates = manualPaths
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean);
      if (candidates.length === 0) {
        setManualPathError('Nhập ít nhất một URL hoặc đường dẫn, mỗi dòng một mục.');
        return;
      }

      const nextItems = candidates.map((value) => {
        const resolved = new URL(value, sourceUrl);
        if (!['http:', 'https:'].includes(resolved.protocol) || resolved.origin !== sourceUrl.origin) {
          throw new Error(`Đường dẫn phải cùng website: ${value}`);
        }
        if (NON_HTML_FILE_PATTERN.test(resolved.pathname)) {
          throw new Error(`Không thể import như trang HTML: ${value}`);
        }
        const lastSegment = resolved.pathname.split('/').filter(Boolean).at(-1) || resolved.hostname;
        return {
          title: decodeURIComponent(lastSegment).replace(/\.html?$/i, '').replace(/[-_]+/g, ' '),
          url: resolved.toString(),
          level: 1,
          anchor: resolved.hash ? resolved.hash.slice(1) : null,
          manual: true,
        };
      });

      setManualItems((current) => {
        const byUrl = new Map(current.map((item) => [item.url, item]));
        nextItems.forEach((item) => byUrl.set(item.url, item));
        return Array.from(byUrl.values());
      });
      setSelectedUrls((current) => [
        ...new Set([...current, ...nextItems.map((item) => item.url)]),
      ]);
      setManualPaths('');
      setManualPathError('');
      triggerToast?.(`Đã thêm ${nextItems.length} đường dẫn vào danh sách import.`);
    } catch (error) {
      setManualPathError(error?.message || 'Có đường dẫn không hợp lệ.');
    }
  };

  const handleImport = async () => {
    try {
      const values = await validateBaseForm();
      const title = String(values.title || toc?.title || '').trim();
      const teacherId = currentUser?.userId || currentUser?.id || currentUser?._id || 'ADMIN';
      const selected = selectedUrls;
      const uploaderRole = isAdmin ? 'ADMIN' : 'TEACHER';

      if (!toc) {
        triggerToast?.('Hãy phân tích URL trước khi import.');
        return;
      }
      if (hasToc && selected.length === 0) {
        triggerToast?.('Hãy chọn ít nhất một chương hoặc mục để import.');
        return;
      }
      setIsImporting(true);

      const payload = !hasToc
        ? {
            url: values.url.trim(),
            title,
            uploaderRole,
            teacherId,
            followNext: fallbackFollowNext,
            maxPages: fallbackFollowNext ? Math.max(Number(fallbackMaxPages) || 1, 1) : 1,
          }
        : {
            url: toc?.sourceUrl || values.url.trim(),
            title,
            uploaderRole,
            teacherId,
            selectedUrls: selected,
          };

      const response = await materialApi.importCourseMaterialUrl(courseId, payload);

      triggerToast?.('Đã bắt đầu import. Hệ thống đang lập chỉ mục trong nền.');
      await onUploaded?.(response?.title || title || 'Tài liệu website');
      onClose();
    } catch (error) {
      triggerToast?.(getUserFacingError(error, error?.message || 'Không thể bắt đầu import website.'));
    } finally {
      setIsImporting(false);
    }
  };

  const importDisabled = !courseId
    || isAnalyzing
    || isImporting
    || !toc
    || (hasToc && selectedUrls.length === 0);

  return (
    <Modal
      open={open}
      title="Import tài liệu từ website"
      onCancel={onClose}
      afterOpenChange={handleAfterOpenChange}
      width={920}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={isAnalyzing || isImporting}>
          Hủy
        </Button>,
        <Button
          key="import"
          type="primary"
          icon={<ImportOutlined />}
          onClick={handleImport}
          loading={isImporting}
          disabled={importDisabled}
        >
          {hasToc ? `Import mục đã chọn (${selectedUrls.length})` : 'Import URL'}
        </Button>,
      ]}
      destroyOnHidden
    >
      <Space orientation="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          title="Import website qua backend"
          description="Backend phân tích các trang HTML nội bộ cùng website, kể cả đường dẫn không có đuôi hoặc có đuôi .html/.htm. Các file PDF, ZIP và tài nguyên tĩnh không được trộn vào lần import website."
        />

        {!courseId && (
          <Alert
            type="warning"
            showIcon
            title="Hãy chọn môn học trước"
            description="Tài liệu website sẽ được import thành học liệu dùng chung của môn học."
          />
        )}

        <Card size="small">
          <Form
            form={form}
            layout="vertical"
          >
            <Form.Item
              name="url"
              label={<Text strong>URL tài liệu</Text>}
              rules={[
                { required: true, message: 'Hãy nhập URL tài liệu.' },
                {
                  validator: (_, value) => (
                    !value || isValidHttpUrl(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error('URL phải bắt đầu bằng http hoặc https.'))
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
              label={<Text strong>Tên học liệu</Text>}
              tooltip="Nếu để trống, hệ thống sẽ dùng tiêu đề HTML do backend đọc được."
            >
              <Input placeholder="Java Virtual Machine Specification" disabled={isAnalyzing || isImporting} />
            </Form.Item>

            <Button
              icon={<SearchOutlined />}
              onClick={handleAnalyze}
              loading={isAnalyzing}
              disabled={!courseId || isImporting}
            >
              Phân tích URL
            </Button>
          </Form>
        </Card>

        {toc && (
          <Card
            size="small"
            title={
              <Space wrap>
                <span>{toc.title || 'Các mục tài liệu'}</span>
                <Tag color={hasToc ? 'blue' : 'default'}>{toc.itemCount || 0} mục</Tag>
                {hasToc && <Tag>Đã chọn {selectedUrls.length} mục</Tag>}
                {hasToc && <Tag>{pathGroups.length} nhóm</Tag>}
              </Space>
            }
          >
            {hasToc ? (
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Tìm chương hoặc mục"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  disabled={isImporting}
                />
                <Space wrap>
                  <Button size="small" onClick={selectVisibleUrls} disabled={isImporting || visibleTocItems.length === 0}>
                    Chọn tất cả {visibleTocItems.length} mục đang hiển thị
                  </Button>
                  <Button size="small" onClick={clearVisibleUrls} disabled={isImporting || visibleTocItems.length === 0}>
                    Bỏ chọn mục đang hiển thị
                  </Button>
                  {pathTypeSummary.map((type) => <Tag key={type}>{type}</Tag>)}
                </Space>
                <div className="website-manual-paths">
                  <div className="website-manual-paths-heading">
                    <span>
                      <LinkOutlined /> Thêm nhiều đường dẫn
                    </span>
                    <Text type="secondary">Chỉ URL cùng website, mỗi dòng một trang.</Text>
                  </div>
                  <Input.TextArea
                    value={manualPaths}
                    onChange={(event) => {
                      setManualPaths(event.target.value);
                      setManualPathError('');
                    }}
                    placeholder={'/A-Introduction/computers\n/B-Computations/logic\nhttps://intro2c.sdds.ca/D-Modularity/functions'}
                    autoSize={{ minRows: 2, maxRows: 5 }}
                    disabled={isImporting}
                    status={manualPathError ? 'error' : undefined}
                  />
                  <div className="website-manual-paths-action">
                    {manualPathError ? <Text type="danger">{manualPathError}</Text> : <span />}
                    <Button size="small" onClick={addManualPaths} disabled={isImporting || !manualPaths.trim()}>
                      Thêm và chọn
                    </Button>
                  </div>
                </div>
                <div className="website-toc-list" aria-label="Danh sách trang tài liệu">
                  {visibleTocItems.length === 0 ? (
                    <Text type="secondary">Không có chương hoặc mục phù hợp từ khóa.</Text>
                  ) : (
                    pathGroups.map((group) => {
                      const selectedInGroup = group.items.filter((item) => selectedUrlSet.has(item.url)).length;
                      return (
                        <section className="website-path-group" key={group.key}>
                          <div className="website-path-group-header">
                            <span className="website-path-group-title">
                              <FolderOpenOutlined /> {group.label}
                              <Tag>{selectedInGroup}/{group.items.length}</Tag>
                            </span>
                            <Space size={4}>
                              <Button type="text" size="small" onClick={() => selectGroup(group.items)} disabled={isImporting}>
                                Chọn nhóm
                              </Button>
                              <Button type="text" size="small" onClick={() => clearGroup(group.items)} disabled={isImporting}>
                                Bỏ chọn
                              </Button>
                            </Space>
                          </div>
                          {group.items.map((item) => (
                            <label
                              key={item.url}
                              className="website-toc-item"
                              style={{ paddingLeft: Math.min(item.level - 1, 5) * 18 + 12 }}
                            >
                              <Checkbox
                                checked={selectedUrlSet.has(item.url)}
                                onChange={(event) => toggleUrl(item.url, event.target.checked)}
                                disabled={isImporting}
                              />
                              <span className="website-toc-copy">
                                <span className="website-toc-title-row">
                                  <span className="website-toc-title">{item.title}</span>
                                  <Tag bordered={false}>{item.manual ? 'Thêm thủ công' : getPathType(item.url)}</Tag>
                                </span>
                                <span className="website-toc-url">{item.url}</span>
                              </span>
                            </label>
                          ))}
                        </section>
                      );
                    })
                  )}
                </div>
              </Space>
            ) : (
              <Space orientation="vertical" size={12} style={{ width: '100%' }}>
                <Alert
                  type="warning"
                  showIcon
                  title="Không tìm thấy mục lục"
                  description="Bạn vẫn có thể import URL hiện tại. Chỉ bật theo liên kết tiếp theo khi website có liên kết Next đáng tin cậy."
                />
                <Divider style={{ margin: '4px 0' }} />
                <Checkbox
                  checked={fallbackFollowNext}
                  disabled={isImporting}
                  onChange={(event) => setFallbackFollowNext(event.target.checked)}
                >
                  Theo các liên kết "Next" cùng tên miền
                </Checkbox>
                {fallbackFollowNext && (
                  <Space orientation="vertical" size={4}>
                    <Text strong>Số trang tối đa</Text>
                    <InputNumber
                      min={1}
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
