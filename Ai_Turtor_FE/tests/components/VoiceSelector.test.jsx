import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VoiceSelector from '../../src/features/tts/components/VoiceSelector';

const voices = [
  { id: 'Magpie-Multilingual.VI-VN.Long.Neutral', name: 'Long · Neutral' },
  { id: 'Magpie-Multilingual.VI-VN.Mai.Happy', name: 'Mai · Happy' },
];

describe('VoiceSelector', () => {
  it('loads NVIDIA voices and reports the selected provider voice', async () => {
    const onChange = vi.fn();
    render(<VoiceSelector value="Magpie-Multilingual.VI-VN.Long.Neutral" voices={voices} onChange={onChange} />);

    expect(screen.getByText('Long · Neutral')).toBeVisible();
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('Mai · Happy'));

    expect(onChange).toHaveBeenCalledWith(
      'Magpie-Multilingual.VI-VN.Mai.Happy',
      expect.anything(),
    );
  });
});
