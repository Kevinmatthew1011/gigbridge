---
name: frontend-best-creator
description: Create or reshape distinctive, production-ready frontend interfaces from a subject-specific design thesis, then verify the result through rendered critique. Use for web pages, application screens, dashboards, components, and focused UI refinement where visual quality matters.
license: Complete terms in LICENSE.txt
---

# Frontend Best Creator

This edition is adapted from Anthropic's `frontend-design` skill at commit `2235be7c60b551f5de82ade908fd3816455afcda`. Its instructions have been changed to emphasize a repeatable design loop and rendered verification.

Build interfaces with a clear point of view while preserving the product's real purpose and behavior. Treat accessibility, responsiveness, and interaction states as part of the design rather than cleanup work.

## Frame the job

Inspect the existing product, code, content, constraints, and user journey before proposing a visual direction. State:

- the concrete subject and audience;
- the screen's single most important job;
- the behavior and content that must remain intact;
- the visual problem the work should solve.

Use real product content. Do not fill the interface with generic marketing copy, invented metrics, or placeholder data when verified content exists.

## Write a design thesis

Before implementation, write one concise thesis connecting the subject to the intended visual experience. Derive the following from that thesis:

- a restrained palette with named color roles;
- deliberate display, body, and data typography roles;
- a hierarchy and layout concept;
- one memorable signature element;
- a motion approach, including when stillness is more appropriate.

Spend expressive energy on the signature element and keep supporting surfaces disciplined. Structural devices such as labels, dividers, numbering, and cards must communicate real relationships in the content.

## Run the subject-specific swap test

Ask whether the proposed palette, typography, layout, signature element, and copy could be transferred unchanged to an unrelated product. If most of the direction survives the swap, it is too generic. Revise the choices until they clearly arise from this subject, audience, and task.

Avoid habitual design formulas unless the brief specifically calls for them. A fashionable style is not a thesis. Use gradients, oversized metrics, glass panels, dense editorial grids, rounded card collections, and decorative animation only when the subject makes them appropriate.

## Build from the thesis

Implement the revised direction in the project's existing stack and design system. Preserve product behavior during reshaping work, including calculations, validation, navigation, loading, error, empty, success, and reduced-motion states.

- Establish shared tokens before styling individual elements.
- Make hierarchy legible through type, spacing, contrast, and grouping.
- Use plain, specific interface language from the user's perspective.
- Keep action names consistent from control to resulting feedback.
- Make the primary journey obvious without explanatory clutter.
- Support narrow mobile screens, keyboard navigation, visible focus, semantic markup, sufficient contrast, and touch-friendly targets.
- Keep CSS specificity predictable and remove obsolete styles introduced by the previous layout.
- Prefer one coherent interaction moment over scattered effects.

When changing an existing interface, keep business logic and data contracts untouched unless the user has included functional changes in scope.

## Verify through rendered critique

Do not judge the result from source code alone. Run the product and inspect rendered screenshots at representative desktop and mobile widths. Exercise the main journey and meaningful loading, empty, error, and success states.

Critique the render against the thesis:

- Does the first view reveal the screen's job and next action?
- Does the signature element belong specifically to this subject?
- Is the hierarchy clear without relying on decoration?
- Are dense data and long content still readable?
- Are mobile composition and touch interactions intentional?
- Are focus, contrast, motion, and failure states usable?
- Did the reshape preserve the product's behavior and real content?

Fix visible problems, render again, and stop when another pass would add decoration rather than clarity. Report the implemented direction, rendered evidence reviewed, behavior verification performed, and any remaining limitations.
