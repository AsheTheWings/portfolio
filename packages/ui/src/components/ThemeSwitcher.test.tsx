/**
 * Layer 2 — ThemeSwitcher component (jsdom).
 *
 * Rendered through renderWithProviders so the real ThemeProvider supplies
 * context. Interactions are driven with user-event; assertions are on what the
 * user sees (the dropdown opening, options appearing).
 */
import { renderWithProviders, screen, userEvent } from '@test/render';
import { ThemeSwitcher } from './ThemeSwitcher';

describe('ThemeSwitcher', () => {
  it('renders the theme toggle button', () => {
    renderWithProviders(<ThemeSwitcher />);
    expect(screen.getByTitle(/current theme/i)).toBeInTheDocument();
  });

  it('opens the theme menu and shows all options on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeSwitcher />);

    await user.click(screen.getByTitle(/current theme/i));

    expect(screen.getByRole('button', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /system/i })).toBeInTheDocument();
  });

  it('selecting a theme closes the menu', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ThemeSwitcher />);

    await user.click(screen.getByTitle(/current theme/i));
    await user.click(screen.getByRole('button', { name: /light/i }));

    expect(screen.queryByRole('button', { name: /system/i })).not.toBeInTheDocument();
  });
});
