import { Input } from 'antd';
import { Search, X } from 'lucide-react';
import { uiCopy } from '../../constants/uiCopy';

function ConversationSearch({ value, onChange }) {
  return (
    <div className="conversation-search">
      <Search size={15} aria-hidden="true" className="conversation-search-icon" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={uiCopy.student.chat.searchPlaceholder}
        aria-label="Search conversations"
        variant="borderless"
      />
      <button
        type="button"
        className={`conversation-search-clear ${value ? 'visible' : ''}`}
        onClick={() => onChange('')}
        aria-label="Clear search"
        tabIndex={value ? 0 : -1}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export default ConversationSearch;
