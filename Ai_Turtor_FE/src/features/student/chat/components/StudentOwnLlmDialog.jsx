import { useEffect, useState } from 'react';
import { Alert, Input, Modal, Select } from 'antd';
import { aiTutorApi } from '../../../../services/aiTutorApi';
import { getUserFacingError } from '../../../../services/apiClient';
import {
  STUDENT_LLM_PROVIDERS,
  saveStudentOwnLlm,
} from '../studentOwnLlm';

function StudentOwnLlmForm({ userId, onClose, onSaved }) {
  const [provider, setProvider] = useState('openrouter');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [configured, setConfigured] = useState(false);
  const [usage, setUsage] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const docs = STUDENT_LLM_PROVIDERS.find((item) => item.id === provider);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      aiTutorApi.getStudentLlm(),
      aiTutorApi.getStudentLlmUsage(),
    ]).then(([status, history]) => {
      if (cancelled) return;
      if (status?.configured) {
        setConfigured(true);
        setProvider(status.provider || 'openrouter');
        setModel(status.model || '');
        saveStudentOwnLlm(userId, { provider: status.provider, model: status.model });
      }
      setUsage(Array.isArray(history?.usage) ? history.usage : []);
    }).catch((reason) => {
      if (!cancelled) setError(getUserFacingError(reason, 'Không tải được trạng thái API key.'));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const status = await aiTutorApi.saveStudentLlm({ provider, model, apiKey });
      saveStudentOwnLlm(userId, { provider: status.provider || provider, model: status.model || model });
      setConfigured(true);
      setApiKey('');
      onSaved?.();
      onClose?.();
    } catch (reason) {
      setError(getUserFacingError(reason, 'Không lưu được API key.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="API LLM của bạn"
      open
      okText={configured ? 'Thay key' : 'Lưu key'}
      cancelText="Đóng"
      confirmLoading={saving}
      okButtonProps={{ disabled: !provider || !model.trim() || apiKey.trim().length < 8 }}
      onCancel={onClose}
      onOk={save}
    >
      <p>
        Key được lưu mã hóa trên hệ thống và không hiển thị lại. Hệ thống chỉ dùng key này khi hết lượt hỏi của nhà trường.
      </p>
      <p>
        Trạng thái: <strong>{configured ? 'Đã cấu hình' : 'Chưa cấu hình'}</strong>
      </p>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}
      <Select
        style={{ width: '100%', marginBottom: 12 }}
        value={provider}
        options={STUDENT_LLM_PROVIDERS.map((item) => ({ value: item.id, label: item.label }))}
        onChange={setProvider}
      />
      {docs?.docsUrl && (
        <p>
          <a href={docs.docsUrl} target="_blank" rel="noreferrer">Hướng dẫn lấy API key {docs.label}</a>
        </p>
      )}
      <Input
        style={{ marginBottom: 12 }}
        placeholder="Tên model, ví dụ openai/gpt-oss-20b"
        value={model}
        onChange={(event) => setModel(event.target.value)}
      />
      <Input.Password
        placeholder={configured ? 'Nhập key mới để thay thế' : 'API key'}
        value={apiKey}
        autoComplete="off"
        onChange={(event) => setApiKey(event.target.value)}
      />
      {usage.length > 0 && (
        <ul>
          {usage.slice(0, 5).map((item) => (
            <li key={`${item.createdAt}-${item.model}`}>
              {item.provider} / {item.model} · {item.status === 'FAILED' ? 'Lỗi' : 'Đã dùng'}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function StudentOwnLlmDialog({ open, userId, onClose, onSaved }) {
  if (!open) return null;
  return <StudentOwnLlmForm key={String(userId || '')} userId={userId} onClose={onClose} onSaved={onSaved} />;
}

export default StudentOwnLlmDialog;
