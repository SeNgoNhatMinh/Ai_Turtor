import React from 'react';
import { RefreshCw, Send } from 'lucide-react';

function TeacherLiveChatTab({
  chatInbox = [],
  selectedChatEsc,
  handleSelectTeacherChat,
  loadTeacherInbox,
  chatRoomDetail,
  onCloseTeacherChat,
  teacherChatMessages = [],
  teacherUserId,
  teacherChatEndRef,
  teacherChatInput,
  setTeacherChatInput,
  isTeacherChatSending,
  onSendTeacherChat,
}) {
  return (
    <div className="grid-2-cols portal-view">
      <div className="glass-card">
        <div className="card-header">
          <h3>Active Support Chats</h3>
          <button type="button" className="btn-small-chat" onClick={() => loadTeacherInbox?.()}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Refresh
          </button>
        </div>
        {chatInbox.length === 0 ? (
          <p className="no-data-text">No active 1-on-1 support chats.</p>
        ) : (
          <div className="escalations-list">
            {chatInbox.map((esc) => (
              <div
                key={esc.id}
                className={`escalation-card-item ${selectedChatEsc?.id === esc.id ? 'active-escalation' : ''}`}
                onClick={() => handleSelectTeacherChat(esc)}
              >
                <span className="badge-esc pending">{String(esc.status).toUpperCase()}</span>
                <h5>{esc.student}</h5>
                <p className="esc-context">{esc.title}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-card">
        <div className="card-header">
          <h3>Live Chat</h3>
          {selectedChatEsc && (
            <button type="button" className="btn-reject-cand" onClick={onCloseTeacherChat}>Close chat</button>
          )}
        </div>
        {!selectedChatEsc ? (
          <p className="no-data-text">Select a support chat from the inbox.</p>
        ) : (
          <>
            {chatRoomDetail?.status && <p className="esc-context">Room status: {chatRoomDetail.status}</p>}
            <div className="chat-message-list" style={{ minHeight: 280, maxHeight: 400, overflowY: 'auto', padding: 12 }}>
              {teacherChatMessages.map((msg, idx) => (
                <div key={`${msg.timestamp || msg.createdAt || idx}-${idx}`} className={`support-message ${msg.senderId === teacherUserId ? 'mine' : ''}`}>
                  <div className={`support-bubble ${msg.senderId === teacherUserId ? 'mine' : ''}`}>{msg.content}</div>
                </div>
              ))}
              <div ref={teacherChatEndRef} />
            </div>
            <form
              className="escalation-chat-reply-box"
              onSubmit={(e) => { e.preventDefault(); onSendTeacherChat(); }}
            >
              <div className="input-group" style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="glass-input-field"
                  value={teacherChatInput}
                  onChange={(e) => setTeacherChatInput(e.target.value)}
                  placeholder="Reply to student..."
                  disabled={isTeacherChatSending}
                />
                <button type="submit" className="btn-submit-form" disabled={!teacherChatInput.trim() || isTeacherChatSending}>
                  <Send style={{ width: 14, height: 14, display: 'inline-block' }} /> {isTeacherChatSending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default TeacherLiveChatTab;
