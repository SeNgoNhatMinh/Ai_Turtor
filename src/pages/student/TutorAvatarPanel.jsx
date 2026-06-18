import React from 'react';
import { Alert } from 'antd';
import SplineAvatar from '../../components/SplineAvatar';
import { uiCopy } from '../../constants/uiCopy';

function TutorAvatarPanel({ avatarEmotion, setAvatarEmotion }) {
  return (
    <div className="avatar-panel">
      <Alert
        type="info"
        showIcon
        message={uiCopy.student.avatar.title}
        description={uiCopy.student.avatar.subtitle}
        style={{ margin: 16 }}
      />
      <div style={{ height: 360 }}>
        <SplineAvatar emotion={avatarEmotion} setEmotion={setAvatarEmotion} />
      </div>
    </div>
  );
}

export default TutorAvatarPanel;
