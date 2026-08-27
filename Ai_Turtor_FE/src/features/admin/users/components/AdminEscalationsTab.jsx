import { useMemo, useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Card, Table } from 'antd';
import ActionButton from '../../../../components/common/ActionButton';
import { CollectionToolbar } from '../../../../components/common/CollectionControls';
import EntityActionMenu from '../../../../components/common/EntityActionMenu';
import StatusLabel from '../../../../components/common/StatusLabel';
import { confirmDanger } from '../../../../components/common/confirmDialog';
import { findPersonById, getPersonDisplayName, getPersonEmail } from '../../../../utils/displayNames';
import { getStatusLabel } from '../../../../utils/statusLabels';

function escalationQuestion(record) {
  return record?.originalQuestion || record?.question || record?.questionPreview || '';
}

function escalationSearchHaystack(record, users) {
  const account = findPersonById(users, record.studentId || record.userId);
  const displayRecord = { ...(account || {}), ...record };
  return [
    getPersonDisplayName(displayRecord, ''),
    getPersonEmail(displayRecord),
    record.userName,
    record.userEmail,
    record.assignedMentorName,
    record.assignedMentorEmail,
    escalationQuestion(record),
    record.status,
    getStatusLabel(record.status || 'PENDING'),
  ].join(' ').toLowerCase();
}

export default function AdminEscalationsTab({ escalations, users }) {
  const [search, setSearch] = useState('');
  const filteredEscalations = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return escalations.list;
    return escalations.list.filter((record) => escalationSearchHaystack(record, users).includes(needle));
  }, [escalations.list, search, users]);

  const columns = [
    {
      title: 'Sinh viên',
      dataIndex: 'userId',
      key: 'userId',
      render: (value, record) => {
        const account = findPersonById(users, record.studentId || value);
        const displayRecord = { ...(account || {}), ...record };
        const email = getPersonEmail(displayRecord);
        return (
          <div className="entity-name-cell">
            <strong>{getPersonDisplayName(displayRecord, 'Sinh viên')}</strong>
            {email && <span>{email}</span>}
          </div>
        );
      },
    },
    {
      title: 'Câu hỏi',
      key: 'question',
      ellipsis: true,
      render: (_, record) => escalationQuestion(record) || '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      render: (value) => <StatusLabel status={value || 'PENDING'} />,
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_, record) => (
        <EntityActionMenu
          items={[{ key: 'delete', icon: <Trash2 size={14} />, label: 'Xóa yêu cầu', danger: true }]}
          ariaLabel="Thao tác yêu cầu hỗ trợ"
          onAction={() => confirmDanger({
            title: 'Xóa yêu cầu hỗ trợ này?',
            content: 'Yêu cầu sẽ bị xóa khỏi hàng chờ quản trị.',
            onOk: () => escalations.remove(record.id),
          })}
        />
      ),
    },
  ];

  return (
    <Card hoverable>
      <CollectionToolbar
        query={search}
        onQueryChange={setSearch}
        filteredCount={filteredEscalations.length}
        totalCount={escalations.list.length}
        placeholder="Tìm sinh viên, câu hỏi hoặc trạng thái..."
      >
        <ActionButton onClick={escalations.reload} icon={<RefreshCw size={14} />}>Làm mới</ActionButton>
      </CollectionToolbar>
      <Table
        dataSource={filteredEscalations}
        columns={columns}
        rowKey="id"
        loading={escalations.loading}
        pagination={{ pageSize: 8 }}
        size="middle"
        sticky
        scroll={{ x: 680, y: 520 }}
        locale={{ emptyText: search.trim() ? 'Không tìm thấy yêu cầu hỗ trợ phù hợp.' : 'Không có yêu cầu hỗ trợ.' }}
      />
    </Card>
  );
}
