import { useState } from 'react';
import { message } from 'antd';
import { validateAssignmentFile } from '../../../utils/assignmentFiles';

export function useStudentMaterialsController({
  selectedAssignment,
  handleStudentSubmit,
  onDownloadAssignment,
  onDownloadSubmission,
}) {
  const [studentSubmissionFile, setStudentSubmissionFile] = useState(null);
  const [studentSubmissionNote, setStudentSubmissionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onStudentSubmit = async () => {
    if (isSubmitting) return;
    const fileValidation = validateAssignmentFile(studentSubmissionFile);
    if (!fileValidation.ok) {
      message.error(fileValidation.message);
      return;
    }

    const assignmentId = selectedAssignment?.id || selectedAssignment?.assignmentId;
    if (!assignmentId) {
      message.error('Choose an assignment before submitting work.');
      return;
    }

    setIsSubmitting(true);
    try {
      const succeeded = await handleStudentSubmit(assignmentId, studentSubmissionFile, studentSubmissionNote);
      if (succeeded) {
        setStudentSubmissionFile(null);
        setStudentSubmissionNote('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadAssignment = (assignment) => {
    onDownloadAssignment?.(assignment);
  };

  return {
    studentSubmissionFile,
    setStudentSubmissionFile,
    studentSubmissionNote,
    setStudentSubmissionNote,
    onStudentSubmit,
    isSubmitting,
    handleDownloadAssignment,
    handleDownloadSubmission: onDownloadSubmission,
  };
}
