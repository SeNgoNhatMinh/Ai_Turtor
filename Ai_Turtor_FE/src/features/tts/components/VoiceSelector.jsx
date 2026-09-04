import { Select, Tooltip } from 'antd';
import { Volume2 } from 'lucide-react';
import './VoiceSelector.css';

export default function VoiceSelector({
  value,
  voices = [],
  loading = false,
  disabled = false,
  error = '',
  onChange,
  compact = false,
}) {
  const options = (Array.isArray(voices) ? voices : []).map((voice) => ({
    value: voice.id,
    label: voice.name,
    title: voice.description || voice.name,
  }));

  return (
    <Tooltip title={error || 'Chọn trực tiếp một giọng tiếng Việt do NVIDIA cung cấp'}>
      <div className={`tts-voice-selector ${compact ? 'tts-voice-selector--compact' : ''}`}>
        <Volume2 size={16} aria-hidden="true" />
        <Select
          value={value || undefined}
          options={options}
          onChange={onChange}
          loading={loading}
          disabled={disabled || loading || options.length === 0}
          placeholder={loading ? 'Đang tải giọng...' : 'Chọn giọng đọc'}
          aria-label="Chọn giọng đọc AI Tutor"
          popupMatchSelectWidth={280}
          showSearch
          optionFilterProp="label"
        />
      </div>
    </Tooltip>
  );
}
