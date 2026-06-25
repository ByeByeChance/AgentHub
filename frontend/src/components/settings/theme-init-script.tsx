/**
 * Inline script that runs before page hydration to prevent theme flash.
 * Reads theme preference from localStorage and applies 'light' or 'dark' class to <html>.
 */
export function ThemeInitScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              var theme = localStorage.getItem('agenthub-theme') || 'system';
              var root = document.documentElement;
              if (theme === 'system') {
                theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
              }
              root.classList.add(theme);
            } catch (e) {
              // localStorage unavailable — default to light (no class needed)
            }
          })();
        `,
      }}
    />
  );
}
