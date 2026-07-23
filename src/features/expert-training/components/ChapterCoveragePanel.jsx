import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Space, Tag, Tree, Typography } from 'antd';
import { Eye, ListChecks, Plus, RefreshCw } from 'lucide-react';
import AsyncState from '../../../components/common/AsyncState';
import {
  formatChapterPages,
  getChapterStatusMeta,
  getDetectedFromLabel,
  getMaterialHealthMeta,
} from '../expertTrainingUtils';
import ChapterPreviewDrawer from './ChapterPreviewDrawer';

const { Text } = Typography;

function buildTree(chapters) {
  const roots = [];
  const stack = [];
  chapters.forEach((chapter) => {
    const level = Math.max(1, Number(chapter.tocLevel) || 1);
    const node = {
      key: chapter.chapterKey || chapter.id,
      chapter,
      children: [],
    };
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    if (stack.length) stack[stack.length - 1].node.children.push(node);
    else roots.push(node);
    stack.push({ level, node });
  });
  return roots;
}

export default function ChapterCoveragePanel({
  chapters,
  loading,
  error,
  canReview,
  pendingAction,
  preview,
  previewLoading,
  previewError,
  onRefresh,
  onConfirm,
  onAddManual,
  onPreview,
  onClosePreview,
  onCreateTasks,
  onOpenMaterial,
  onSelectionChange,
}) {
  const [keyword, setKeyword] = useState('');
  const [checkedKeys, setCheckedKeys] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm] = Form.useForm();

  useEffect(() => {
    const nextKeys = chapters
      .filter((chapter) => chapter.status === 'CONFIRMED')
      .map((chapter) => chapter.chapterKey || chapter.id);
    setCheckedKeys(nextKeys);
    onSelectionChange?.(nextKeys);
  }, [chapters, onSelectionChange]);

  const visibleChapters = useMemo(() => {
    const query = keyword.trim().toLocaleLowerCase('vi-VN');
    if (!query) return chapters;
    return chapters.filter((chapter) => chapter.title.toLocaleLowerCase('vi-VN').includes(query));
  }, [chapters, keyword]);

  const treeData = useMemo(() => buildTree(visibleChapters).map(function mapNode(node) {
    const chapter = node.chapter;
    const health = getMaterialHealthMeta(chapter.materialHealth);
    const status = getChapterStatusMeta(chapter.status);
    const detectedFromLabel = getDetectedFromLabel(chapter.detectedFrom);
    return {
      key: node.key,
      title: (
        <div className="expert-training__chapter-node">
          <div>
            <strong>{chapter.title}</strong>
            <span>
              {formatChapterPages(chapter)} · {chapter.chunkCount} chunks · Gold T/E: {chapter.trainingGoldCount}/{chapter.evaluationGoldCount}
            </span>
          </div>
          <Space wrap size={[4, 4]}>
            <Tag color={status.color}>{status.label}</Tag>
            <Tag color={health.color}>{health.label}</Tag>
            {detectedFromLabel && <Tag>{detectedFromLabel}</Tag>}
          </Space>
        </div>
      ),
      children: node.children.map(mapNode),
    };
  }), [visibleChapters]);
  const visibleChapterKeys = useMemo(
    () => new Set(visibleChapters.map((chapter) => chapter.chapterKey || chapter.id)),
    [visibleChapters],
  );

  const openPreview = async (key) => {
    const chapter = chapters.find((item) => (item.chapterKey || item.id) === key);
    if (!chapter) return;
    setSelectedChapter(chapter);
    await onPreview?.(chapter);
  };

  const confirmSelection = async () => {
    if (!checkedKeys.length) return;
    await onConfirm?.(checkedKeys);
  };

  const submitManual = async ({ title }) => {
    const result = await onAddManual?.(title.trim());
    if (result) {
      setManualOpen(false);
      manualForm.resetFields();
    }
  };

  return (
    <section className="expert-training__section" aria-labelledby="chapter-coverage-heading">
      <div className="expert-training__section-heading">
        <div>
          <h2 id="chapter-coverage-heading">Chapter từ học liệu đã index</h2>
          <p>Xác nhận chapter dùng cho Coverage và xem nội dung nguồn trước khi tạo task.</p>
        </div>
        <Space wrap>
          <Button icon={<RefreshCw size={16} />} onClick={onRefresh} loading={loading}>Làm mới</Button>
          {canReview && (
            <>
              <Button icon={<Plus size={16} />} onClick={() => setManualOpen(true)}>Thêm chapter</Button>
              <Button
                type="primary"
                icon={<ListChecks size={16} />}
                disabled={!checkedKeys.length || Boolean(pendingAction)}
                loading={pendingAction === 'confirm-chapters'}
                onClick={confirmSelection}
              >
                Xác nhận ({checkedKeys.length})
              </Button>
            </>
          )}
        </Space>
      </div>

      {!canReview && (
        <Alert
          type="info"
          showIcon
          title="Chapter do Senior Mentor hoặc Admin xác nhận"
          description="Giảng viên có thể xem nội dung nguồn và nhận task đã được tạo."
        />
      )}

      <Input.Search
        allowClear
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="Tìm chapter..."
        className="expert-training__chapter-search"
      />

      <AsyncState
        loading={loading && !chapters.length}
        error={error}
        empty={!loading && !error && !visibleChapters.length}
        emptyTitle={keyword ? 'Không tìm thấy chapter' : 'Chưa phát hiện chapter'}
        emptyDescription={keyword
          ? 'Hãy thay đổi từ khóa.'
          : 'Hãy index học liệu hoặc thêm chapter thủ công.'}
        onRetry={onRefresh}
      >
        <div className="expert-training__chapter-tree">
          <Tree
            blockNode
            checkable={canReview}
            checkedKeys={checkedKeys}
            onCheck={(keys) => {
              const nextVisibleKeys = Array.isArray(keys) ? keys : keys.checked;
              setCheckedKeys((current) => {
                const nextKeys = [...new Set([
                  ...current.filter((key) => !visibleChapterKeys.has(key)),
                  ...nextVisibleKeys,
                ])];
                onSelectionChange?.(nextKeys);
                return nextKeys;
              });
            }}
            onSelect={(keys) => keys[0] && openPreview(keys[0])}
            treeData={treeData}
            defaultExpandAll
            titleRender={(node) => (
              <div className="expert-training__chapter-tree-title">
                {node.title}
                <Eye size={15} aria-hidden="true" />
              </div>
            )}
          />
          <Text type="secondary">Chọn tên chapter để xem preview. Checkbox chỉ dùng khi xác nhận Coverage.</Text>
        </div>
      </AsyncState>

      <Modal
        title="Thêm chapter thủ công"
        open={manualOpen}
        onCancel={() => setManualOpen(false)}
        onOk={() => manualForm.submit()}
        okText="Thêm và xác nhận"
        confirmLoading={pendingAction === 'add-manual-chapter'}
        destroyOnHidden
      >
        <Alert
          type="warning"
          showIcon
          title="Chỉ dùng khi học liệu không có mục lục phù hợp"
          style={{ marginBottom: 16 }}
        />
        <Form form={manualForm} layout="vertical" onFinish={submitManual}>
          <Form.Item
            name="title"
            label="Tên chapter"
            rules={[{ required: true, whitespace: true, message: 'Nhập tên chapter.' }]}
          >
            <Input maxLength={255} placeholder="Memory Management" />
          </Form.Item>
        </Form>
      </Modal>

      <ChapterPreviewDrawer
        key={selectedChapter?.chapterKey || selectedChapter?.id || 'closed-chapter-preview'}
        chapter={selectedChapter}
        preview={preview}
        loading={previewLoading}
        error={previewError}
        canReview={canReview}
        pendingAction={pendingAction}
        onClose={() => {
          setSelectedChapter(null);
          onClosePreview?.();
        }}
        onCreateTasks={onCreateTasks}
        onOpenMaterial={onOpenMaterial}
      />
    </section>
  );
}
