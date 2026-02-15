# Frontend Stack Research

## Framework Comparison

### React + Vite

**Pros:**
- Largest ecosystem — most mature DnD and animation libraries
- `@dnd-kit` is the gold standard for accessible, performant drag-and-drop (sortable lists, cross-container, keyboard DnD, smooth animations)
- `framer-motion` (now `motion`) — best animation library in any framework: spring physics, layout animations, gesture-driven interactions, exit animations
- Component ecosystem: Radix UI, cmdk (command palette), Headless UI
- React 19 with compiler eliminates most memo/performance concerns
- TanStack Query for API consumption with optimistic updates

**Cons:**
- Larger bundle (~50 KB min+gzip for react + react-dom) — negligible for self-hosted
- More boilerplate than Svelte/Vue for simple reactive state

**DnD story:** `@dnd-kit` — best-in-class. Nothing in other frameworks matches its polish.
**Animation story:** `framer-motion` — layout animations, spring physics, choreographed transitions.

---

### Vue 3 + Vite

**Pros:**
- Excellent reactivity system, less boilerplate than React
- Built-in `<Transition>` and `<TransitionGroup>` — first-class animation without a library
- Vite was created by the Vue team — best DX
- Smaller bundle (~33 KB min+gzip)
- `vue-draggable-plus` (SortableJS wrapper) is solid
- `@vueuse/core` for keyboard shortcuts (useMagicKeys)

**Cons:**
- DnD ecosystem weaker than React — SortableJS wrappers lack `@dnd-kit`'s fine-grained control
- Complex layout animations (spring physics, items sliding into position) require GSAP
- Smaller component ecosystem than React

**DnD story:** SortableJS-based — functional but less polished than `@dnd-kit`.
**Animation story:** Built-in covers ~70%. Spring physics and layout animations need GSAP.

---

### Svelte / SvelteKit

**Pros:**
- Smallest bundle (~2-5 KB runtime)
- Built-in transitions (`transition:`, `animate:flip`, `in:`, `out:`) are elegant
- Most concise reactive syntax — excellent for solo developer
- Svelte 5 runes ($state, $derived, $effect) modernize reactivity

**Cons:**
- **DnD is the weakest point** — `svelte-dnd-action` works but is less polished, fewer features
- Smaller component ecosystem — no Radix UI or cmdk equivalent
- Animation system good for simple transitions but lacks framer-motion sophistication
- Svelte 5 is newer; some libraries still catching up

**DnD story:** `svelte-dnd-action` — basic sortable/cross-container but achieving Things 3-level polish requires significant custom work.
**Animation story:** Elegant for enter/leave/flip. Complex choreography needs GSAP or custom springs.

---

### Solid.js

**Pros:**
- Extremely fast — fine-grained reactivity, no Virtual DOM
- Very small bundle (~7 KB)
- JSX familiar to React devs

**Cons:**
- **Smallest ecosystem — dealbreaker for this use case**
- No mature DnD library (`@thisbeyond/solid-dnd` is young)
- No framer-motion equivalent
- Very few component libraries
- Performance advantage imperceptible for single-user task app

---

## Head-to-Head

| Criterion | React + Vite | Vue 3 + Vite | SvelteKit | Solid.js |
|---|---|---|---|---|
| **Bundle size** | ~50 KB | ~33 KB | ~5 KB | ~7 KB |
| **DnD quality** | Excellent | Good | Fair | Poor |
| **Animation quality** | Excellent | Good | Good | Fair |
| **Keyboard shortcuts** | Excellent | Good | Good | Fair |
| **Component ecosystem** | Excellent | Good | Fair | Poor |
| **DX / boilerplate** | Good | Very Good | Excellent | Good |
| **Community / support** | Excellent | Very Good | Good | Fair |

---

## Recommendation: React + Vite

The reasoning is specific to replicating Things 3:

1. **DnD is central to Things 3** — reordering tasks, moving between projects/areas, dragging to Today. `@dnd-kit` is the only library that can deliver this at the required quality.
2. **Animations define Things 3's character** — checkbox completion, list reordering, sidebar transitions. `framer-motion` handles all these with layout animations and spring physics.
3. **Component ecosystem matters** — command palettes, date pickers, tag popovers, keyboard-navigable lists. Radix UI + cmdk provide these.
4. **Bundle size is irrelevant** — self-hosted, single-user. Optimize for polish, not bytes.

**Runner-up:** Vue 3 — sacrifice some DnD/animation polish for more ergonomic reactivity.

---

## Styling: Tailwind CSS 4

Things 3's design is minimal and systematic — exactly what utility-first excels at.

**Complement with:**
- **Radix UI** — unstyled, accessible primitives (dialogs, popovers, dropdowns, checkboxes)
- **cmdk** — command palette for Quick Entry and Quick Find
- **Lucide icons** — clean icon set matching Things 3's minimal iconography
- **CSS custom properties** — theming (light/dark, accent colors per project)

**Avoid:** Material UI, Ant Design, Vuetify — they fight Things 3's unique aesthetic.

---

## Recommended Frontend Stack

| Layer | Choice |
|---|---|
| Framework | React 19 + Vite |
| Styling | Tailwind CSS 4 |
| Components | Radix UI Primitives |
| Animations | framer-motion (motion) |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| State / Data | TanStack Query + Zustand (client state) |
| Real-time sync | EventSource (SSE) + TanStack Query invalidation |
| Keyboard | react-hotkeys-hook or tinykeys |
| Command Palette | cmdk |
| Icons | Lucide React |
| Routing | React Router 7 or TanStack Router |
| Date handling | date-fns + custom NLP parser |
