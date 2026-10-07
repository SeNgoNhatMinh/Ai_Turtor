import { useState } from 'react';
import { Input, Modal, Select } from 'antd';
import {
  STUDENT_LLM_PROVIDERS,
  readStudentOwnLlm,
  saveStudentOwnLlm,
} from '../studentOwnLlm';

function StudentOwnLlmForm({ userId, onClose, onSaved }) {
  const saved = readStudentOwnLlm(userId);
  const [provider, setProvider] = useState(saved?.provider || 'openrouter');
  const [model, setModel] = useState(saved?.model || '');
  const [apiKey, setApiKey] = useState(saved?.apiKey || '');
  const canSave = Boolean(provider && model.trim() && apiKey.trim());

  return (
    <Modal
      title="Học tiếp bằng API của bạn"
      open
      okText="Dùng API này"
      cancelText="Đóng"
      okButtonProps={{ disabled: !canSave }}
      onCancel={onClose}
      onOk={() => {
        saveStudentOwnLlm(userId, { provider, model, apiKey });
        onSaved?.();
        onClose?.();
      }}
    >
      <p>
        Hết 10 câu của hệ thống. API này chỉ viết câu trả lời từ đoạn tài liệu nhà trường đã truy xuất.
        Khóa nằm trong phiên trình duyệt này và không được lưu trên hệ thống.
      </p>
      <Select
        style={{ width: '100%', marginBottom: 12 }}
        value={provider}
        options={STUDENT_LLM_PROVIDERS.map((item) => ({ value: item.id, label: item.label }))}
        onChange={setProvider}
      />
      <Input
        style={{ marginBottom: 12 }}
        placeholder="Tên model, ví dụ openai/gpt-oss-20b"
        value={model}
        onChange={(event) => setModel(event.target.value)}
      />
      <Input.Password
        placeholder="API key"
        value={apiKey}
        onChange={(event) => setApiKey(event.target.value)}
      />
    </Modal>
  );
}

function StudentOwnLlmDialog({ open, userId, onClose, onSaved }) {
  if (!open) return null;
  return <StudentOwnLlmForm key={String(userId || '')} userId={userId} onClose={onClose} onSaved={onSaved} />;
}

export default StudentOwnLlmDialog;
