import { useMemo, useState } from 'react';
import { Button, Empty, Input, Space, Tree, Typography } from 'antd';
import {
  DownOutlined,
  MinusSquareOutlined,
  PlusSquareOutlined,
  SearchOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

const matchesSearch = (page, keyword) => {
  const q = String(keyword || '').trim().toLowerCase();
  if (!q) return true;
  return `${page.title || ''} ${page.url || ''}`.toLowerCase().includes(q);
};

export default function DocumentationTree({
  pages = [],
  checkedKeys = [],
  onCheckedKeysChange,
  search,
  onSearchChange,
}) {
  const [expandedKeys, setExpandedKeys] = useState([]);

  const visiblePages = useMemo(
    () => pages.filter((page) => matchesSearch(page, search)),
    [pages, search],
  );

  const treeData = useMemo(
    () =>
      visiblePages.map((page, index) => ({
        key: page.key,
        title: (
          <div className="website-import-tree-item">
            <Text strong>{page.title || `Page ${index + 1}`}</Text>
            <Text type="secondary" className="website-import-tree-url">
              {page.url}
            </Text>
          </div>
        ),
        children: page.children?.length
          ? page.children.map((child, ci) => ({
              key: child.key,
              title: (
                <div className="website-import-tree-item">
                  <Text>{child.title || `Section ${ci + 1}`}</Text>
                  <Text type="secondary" className="website-import-tree-url">
                    {child.url}
                  </Text>
                </div>
              ),
            }))
          : undefined,
      })),
    [visiblePages],
  );

  const allKeys = useMemo(
    () => treeData.map((node) => node.key),
    [treeData],
  );

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const setAll = (selected) => {
    onCheckedKeysChange?.(selected ? pages.map((p) => p.key) : []);
  };

  const handleCheck = (keys) => {
    onCheckedKeysChange?.(Array.isArray(keys) ? keys : keys?.checked || []);
  };

  const expandAll = () => setExpandedKeys(allKeys);
  const collapseAll = () => setExpandedKeys([]);

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <div className="website-import-tree-toolbar">
        <Text strong>Found {pages.length} pages</Text>
        <Space size={4}>
          <Button size="small" onClick={() => setAll(true)} disabled={!pages.length}>
            Select All
          </Button>
          <Button size="small" onClick={() => setAll(false)} disabled={!pages.length}>
            Clear
          </Button>
          <Button
            size="small"
            icon={<PlusSquareOutlined />}
            onClick={expandAll}
            disabled={!pages.length}
          >
            Expand All
          </Button>
          <Button
            size="small"
            icon={<MinusSquareOutlined />}
            onClick={collapseAll}
            disabled={!pages.length}
          >
            Collapse All
          </Button>
        </Space>
      </div>

      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Search pages"
        value={search}
        onChange={(e) => onSearchChange?.(e.target.value)}
      />

      {visiblePages.length ? (
        <div className="website-import-tree-wrap">
          <Tree
            checkable
            selectable={false}
            checkedKeys={checkedKeys}
            expandedKeys={expandedKeys}
            onExpand={setExpandedKeys}
            onCheck={handleCheck}
            treeData={treeData}
            switcherIcon={<DownOutlined />}
          />
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            pages.length
              ? 'No pages match your search.'
              : 'Analyze a documentation URL to find pages.'
          }
        />
      )}
    </Space>
  );
}
