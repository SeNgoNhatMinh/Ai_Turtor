import { useState } from 'react';
import { message } from 'antd';
import { validateUploadFile } from '../../../utils/validators';

export function useStudentMaterialsController({
  selectedAssignment,
  handleStudentSubmit,
  onDownloadAssignment,
}) {
  const [studentSubmissionFile, setStudentSubmissionFile] = useState(null);
  const [studentSubmissionNote, setStudentSubmissionNote] = useState('');

  const onStudentSubmit = () => {
    const fileValidation = validateUploadFile(studentSubmissionFile);
    if (!fileValidation.ok) {
      message.error(fileValidation.message);
      return;
    }

    handleStudentSubmit(selectedAssignment.id, studentSubmissionFile, studentSubmissionNote).then(() => {
      setStudentSubmissionFile(null);
      setStudentSubmissionNote('');
      message.success('Submission uploaded successfully.');
    });
  };

  const handleDownloadAssignment = (assignmentId) => {
    onDownloadAssignment?.(assignmentId);
  };

  return {
    studentSubmissionFile,
    setStudentSubmissionFile,
    studentSubmissionNote,
    setStudentSubmissionNote,
    onStudentSubmit,
    handleDownloadAssignment,
  };
}
