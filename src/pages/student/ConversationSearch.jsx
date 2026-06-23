import React from 'react';
import { Input } from 'antd';
import { Search } from 'lucide-react';

function ConversationSearch({ value, onChange }) {
  return (
    <div className="conversation-search">
      <Search size={15} aria-hidden="true" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search conversations..."
        bordered={false}
        allowClear
      />
    </div>
  );
}

export default ConversationSearch;
