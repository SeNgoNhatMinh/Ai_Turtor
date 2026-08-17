import { fireEvent, screen, waitFor } from '@testing-library/react';

export async function selectAntOption(combobox, optionText, { timeout = 10000 } = {}) {
  fireEvent.mouseDown(combobox);
  const option = await screen.findByText(optionText, {}, { timeout });
  fireEvent.click(option);
}

export async function waitForAntSelectChange(callback, { timeout = 10000 } = {}) {
  await waitFor(callback, { timeout });
}
