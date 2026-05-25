# Chat Composer Kill List

These patterns are banned from repo-owned chat composer work:

- Full-row black strips behind composers.
- Row-wide fades, backdrops, or masks that obscure text outside the actual input or drawer rectangle.
- Popup-positioned Attach panels.
- Popup-positioned Skills+Connectors panels.
- Drawer surfaces that float with a visual gap from the input bar.
- Drawer widths based on viewport or arbitrary card widths instead of 90% of the rendered composer width.
- Icon triggers that open but cannot close on second click.
- Local chat input shells pretending to be the shared composer.
- NarrativeFlow-specific composer chrome that diverges from the repo-owned composer.
- Compact sidebars rendering full composer controls.
- Popups or modals using drawer geometry.
- Hidden or empty toolbar slot labels rendered as visible UI.
- Composer wrappers that capture, dim, or blur scroll content outside the composer/drawer footprint.
