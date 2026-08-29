import { formatStudentChatMessage } from '../../../../utils/formatStudentChatMessage';

export default function StudentMessageContent({ text }) {
  const { prose, code } = formatStudentChatMessage(text);

  if (!code) {
    return <div className="student-message-prose">{prose || String(text || '')}</div>;
  }

  return (
    <>
      {prose ? <div className="student-message-prose">{prose}</div> : null}
      <pre className="student-message-code"><code>{code}</code></pre>
    </>
  );
}
