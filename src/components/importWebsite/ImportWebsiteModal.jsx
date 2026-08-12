import { useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Divider, Form, Input, InputNumber, Modal, Space, Tag, Typography } from 'antd';
import { GlobalOutlined, ImportOutlined, SearchOutlined } from '@ant-design/icons';
import { getUserFacingError } from '../../services/apiClient';
import './ImportWebsiteModal.css';

const { Text } = Typography;

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
  const selectedUrlSet = useMemo(() => new Set(selectedUrls), [selectedUrls]);

  const handleAfterOpenChange = (visible) => {
    if (visible) return;
    form.resetFields();
    setToc(null);
    setSelectedUrls([]);
    setSearchText('');
    setFallbackFollowNext(false);
    setFallbackMaxPages(3);
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
      width={820}
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
          description="Backend phân tích tài liệu HTML, import các chương đã chọn thành học liệu môn học và lập chỉ mục trong nền. Học liệu website không tạo tệp PDF để tải xuống."
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
                </Space>
                <div className="website-toc-list">
                  {visibleTocItems.length === 0 ? (
                    <Text type="secondary">Không có chương hoặc mục phù hợp từ khóa.</Text>
                  ) : (
                    visibleTocItems.map((item) => (
                      <label
                        key={item.url}
                        className="website-toc-item"
                        style={{ paddingLeft: Math.min(item.level - 1, 5) * 18 + 10 }}
                      >
                        <Checkbox
                          checked={selectedUrlSet.has(item.url)}
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
