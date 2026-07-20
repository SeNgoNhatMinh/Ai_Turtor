import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import QuizDraftEditor from '../../src/pages/teacher/QuizDraftEditor';

const draft = {
  id: 'draft-1',
  status: 'DRAFT',
  title: 'OOP Quiz',
  topic: 'OOP',
  questions: [{
    questionId: 'q-1',
    type: 'MULTIPLE_CHOICE',
    questionText: 'What is encapsulation?',
    options: ['Hiding implementation details', 'Creating many classes'],
    correctAnswer: 'Hiding implementation details',
    explanation: 'Encapsulation protects internal state.',
  }],
};

describe('QuizDraftEditor', () => {
  it('selects the official answer from the available options and saves it', async () => {
    const onSave = vi.fn().mockResolvedValue({ ...draft });
    render(<QuizDraftEditor draft={draft} onSave={onSave} />);

    fireEvent.click(await screen.findByRole('radio', { name: 'Creating many classes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].questions[0].correctAnswer).toBe('Creating many classes');
  });

  it('keeps the selected answer synchronized when its option text changes', async () => {
    const onSave = vi.fn().mockResolvedValue({ ...draft });
    render(<QuizDraftEditor draft={draft} onSave={onSave} />);

    fireEvent.change(await screen.findByPlaceholderText('Option 1'), { target: { value: 'Protecting internal state' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0][0].questions[0].correctAnswer).toBe('Protecting internal state');
  });

  it('blocks saving duplicate options', async () => {
    const onSave = vi.fn();
    render(<QuizDraftEditor draft={draft} onSave={onSave} />);

    fireEvent.change(await screen.findByPlaceholderText('Option 2'), { target: { value: 'Hiding implementation details' } });

    expect(await screen.findByText(/Answer options must be unique/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('adds and removes draft questions before publishing', async () => {
    render(<QuizDraftEditor draft={draft} onSave={vi.fn()} />);

    expect(await screen.findByText('Question 1')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
    expect(await screen.findByText('Question 2')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Delete question 2' }));
    expect(screen.queryByText('Question 2')).not.toBeInTheDocument();
  });
});
