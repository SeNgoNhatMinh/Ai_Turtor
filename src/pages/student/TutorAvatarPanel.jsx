import React, { useState } from 'react';
import { Alert, Divider, Tag, Typography } from 'antd';
import {
  Lightbulb, Keyboard, BookOpen, Zap, MessageSquare,
  Code, ThumbsUp, AlertCircle, Bot
} from 'lucide-react';
import SplineAvatar from '../../components/SplineAvatar';

const { Text } = Typography;

const SUGGESTIONS_BY_COURSE = {
  PRJ301: [
    'Explain the MVC flow in Spring Boot.',
    'How do I configure Spring Security with JWT?',
    'What is the difference between @Service and @Component?',
    'When should I use JPA OneToMany vs ManyToMany?',
    'How do I design a clean REST API in Spring Boot?',
  ],
  DBI202: [
    'What is the difference between JOIN and UNION?',
    'When should I add an index in SQL?',
    'Explain 1NF, 2NF, and 3NF with examples.',
    'How can I optimize a slow SQL query?',
    'What are transactions and ACID properties?',
  ],
  DEFAULT: [
    'Can you explain this concept in simpler terms?',
    'Can you give me a practical example?',
    'What exercises should I practice next?',
    'How should I debug this error?',
    'Summarize the key points I should remember.',
  ],
};

const SHORTCUTS = [
  { keys: ['Enter'], desc: 'Send message' },
  { keys: ['Shift', 'Enter'], desc: 'New line' },
  { keys: ['Up'], desc: 'Edit the last message' },
];

const STATUS_CONFIG = {
  idle: { color: '#10B981', label: 'Ready', icon: <Zap size={12} /> },
  thinking: { color: '#F59E0B', label: 'Thinking...', icon: <MessageSquare size={12} /> },
  success: { color: '#3B82F6', label: 'Answered', icon: <ThumbsUp size={12} /> },
};

function TutorAvatarPanel({
  avatarEmotion = 'idle',
  setAvatarEmotion,
  courseId,
  setChatInput,
}) {
  const [clickedIdx, setClickedIdx] = useState(null);
  const suggestions = SUGGESTIONS_BY_COURSE[courseId] || SUGGESTIONS_BY_COURSE.DEFAULT;
  const status = STATUS_CONFIG[avatarEmotion] || STATUS_CONFIG.idle;

  const handleSuggestion = (text, idx) => {
    setClickedIdx(idx);
    setTimeout(() => setClickedIdx(null), 600);
    if (setChatInput) {
      setChatInput(text);
    }
  };

  return (
    <div style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflowY: 'auto' }}>

      <div style={{
        background: 'linear-gradient(135deg, rgba(243,112,33,0.06) 0%, rgba(20,184,166,0.06) 100%)',
        border: '1px solid rgba(243,112,33,0.15)',
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: status.color,
          boxShadow: avatarEmotion === 'thinking' ? `0 0 8px ${status.color}` : 'none',
          animation: avatarEmotion === 'thinking' ? 'pulse 1.2s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }} />
        <div>
          <Text style={{ fontSize: 11, color: '#6B7280' }}>AI Tutor</Text>
          <div style={{ fontSize: 13, fontWeight: 600, color: status.color, display: 'flex', alignItems: 'center', gap: 4 }}>
            {status.icon} {status.label}
          </div>
        </div>
        {courseId && (
          <Tag color="orange" style={{ marginLeft: 'auto', fontSize: 11 }}>{courseId}</Tag>
        )}
      </div>

      <Alert
        type="info"
        showIcon
        icon={<Bot size={16} />}
        message="Tutor Avatar"
        description="This avatar visualizes the AI Tutor state. It is not a separate chatbot, so use the chat box in the center to ask questions."
        style={{ borderColor: 'rgba(243,112,33,0.18)', background: '#FFF7F0' }}
      />

      <div style={{
        minHeight: 300,
        border: '1px solid rgba(243,112,33,0.16)',
        borderRadius: 12,
        padding: 12,
        background: '#fff',
      }}>
        <SplineAvatar emotion={avatarEmotion} setEmotion={setAvatarEmotion} />
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Lightbulb size={14} style={{ color: '#F37021' }} />
          <Text style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Suggested questions</Text>
          <Text type="secondary" style={{ fontSize: 10 }}>Click to fill the chat box</Text>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleSuggestion(s, i)}
              style={{
                background: clickedIdx === i
                  ? 'rgba(243,112,33,0.12)'
                  : 'rgba(243,112,33,0.04)',
                border: `1px solid ${clickedIdx === i ? 'rgba(243,112,33,0.5)' : 'rgba(243,112,33,0.18)'}`,
                borderRadius: 8,
                padding: '7px 10px',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: 12,
                color: '#374151',
                lineHeight: 1.4,
                transition: 'all 0.18s ease',
                width: '100%',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(243,112,33,0.09)';
                e.currentTarget.style.borderColor = 'rgba(243,112,33,0.35)';
              }}
              onMouseLeave={e => {
                if (clickedIdx !== i) {
                  e.currentTarget.style.background = 'rgba(243,112,33,0.04)';
                  e.currentTarget.style.borderColor = 'rgba(243,112,33,0.18)';
                }
              }}
            >
              <span style={{ color: '#F37021', marginRight: 6, fontWeight: 700 }}>-&gt;</span>
              {s}
            </button>
          ))}
        </div>
      </div>

      <Divider style={{ margin: '0' }} />

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Keyboard size={14} style={{ color: '#6B7280' }} />
          <Text style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Keyboard shortcuts</Text>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SHORTCUTS.map((sc, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 11 }}>{sc.desc}</Text>
              <div style={{ display: 'flex', gap: 4 }}>
                {sc.keys.map(k => (
                  <kbd key={k} style={{
                    background: '#F3F4F6',
                    border: '1px solid #D1D5DB',
                    borderRadius: 4,
                    padding: '1px 6px',
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: '#374151',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  }}>{k}</kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Divider style={{ margin: '0' }} />

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <BookOpen size={14} style={{ color: '#6B7280' }} />
          <Text style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Tips for better answers</Text>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[
            { icon: <Code size={11} />, text: 'Paste code in Code Review when you need deeper debugging help.' },
            { icon: <AlertCircle size={11} />, text: 'Low-confidence AI answers can create a support request automatically.' },
            { icon: <ThumbsUp size={11} />, text: 'Reviewing answers helps improve guidance for your class.' },
          ].map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
              <span style={{ color: '#9CA3AF', marginTop: 1, flexShrink: 0 }}>{tip.icon}</span>
              <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.5 }}>{tip.text}</Text>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default TutorAvatarPanel;
