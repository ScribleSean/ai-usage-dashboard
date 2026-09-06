# Dashboard design

The reference is [lnkiai/m3e-canvas](https://github.com/lnkiai/m3e-canvas). Its published interface and theme styles were inspected before this revision. The dashboard uses its approach to Material 3 Expressive as a reference, rather than copying the canvas editor or adding it as a dependency.

The navigation rail changes to bottom navigation on narrow screens. Activity, tokens, agent results and source coverage have separate views. Connected device controls sit inside the relevant view. A consistent purple tonal palette, grouped rows and varied corner shapes establish hierarchy without a long stack of cards.

Press feedback lasts about 120–160 ms and respects reduced-motion settings. Fonts are local system fonts. Existing accessible tab and button primitives provide keyboard behavior. Longer measurement explanations are expandable. The layout remains scrollable on small screens and at large text sizes instead of clipping content to force a single screen.

The redesign keeps the original collector schema and privacy rules. Snapshot reload reads a saved local file. It does not trigger collection or a model request. No synthetic values replace missing personal data.

Build and TypeScript checks pass. Formal browser interaction, performance and accessibility testing remain open work before a stable release. Source-reference inspection is not a usability test of this application.
