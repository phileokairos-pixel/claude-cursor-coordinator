# Canonical examples — when in doubt, copy this file

Both Cursor and Claude must consult this before writing similar code. Don't invent new patterns when a canonical reference exists.

This file is a TEMPLATE. Replace these placeholder examples with references from your own codebase.

## Wizard form (multi-step with validation)
- Reference: `path/to/your/canonical/wizard.tsx`
- Pattern: `useForm` + `<button type="button" onClick={handleSubmit}>` (NOT `<form onSubmit>`)
- Why: implicit form submission via Enter key can break multi-step forms

## Form request / validation
- Reference: `path/to/your/canonical/request.php`
- Pattern: shared source-of-truth methods so backend validation + frontend dropdowns stay in sync

## Service with side effects
- Reference: `path/to/your/canonical/service.php`
- Pattern: `DB::transaction` (or equivalent) wraps related side effects atomically

## Middleware / route guard
- Reference: `path/to/your/canonical/middleware.php`
- Pattern: friendly redirect to alternate flow with intended-URL preservation

## Thin controller
- Reference: `path/to/your/canonical/controller.php`
- Pattern: constructor-inject service, validate via FormRequest, delegate, redirect

## State-aware UI component
- Reference: `path/to/your/canonical/component.tsx`
- Pattern: prop-driven banner with localStorage dismiss state

## Adding a new section here

When you ship a feature that introduces a new pattern that should be reused, add a section here. Format: reference path, pattern summary, why it's the canonical choice.
