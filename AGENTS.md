<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:workspace-ui-rules -->
# @workspace/ui Design System - MANDATORY

**ALL UI work MUST follow the @workspace/ui design system.**

## Required Skill

**ALWAYS invoke the `workspace-ui` agent skill before ANY UI work.**

The skill is located at: `.agents/skills/workspace-ui/SKILL.md`
(Canonical package source: `packages/ui/skills/workspace-ui/SKILL.md`)

## When to Use the UI Skill

**MANDATORY for ALL UI-related tasks**:
- Creating ANY UI component
- Modifying ANY existing UI component
- Building ANY form (standard, wizard, section-edit)
- Implementing ANY responsive layout
- Adding ANY loading state
- Working with ANY table or data listing
- Ensuring ANY accessibility compliance
- Following ANY design system convention
- **Before creating ANY custom UI element**

## Cross-Project Enforcement

When copying `@workspace/ui` components to another project:

### 1. Copy Required Files
Copy these files to the target project:
- `packages/ui/AGENT_UI_SKILL.md` - Agent skill for UI guidance
- `packages/ui/UI_GUIDELINES.md` - Complete design system documentation

### 2. Register the Skill
Add the UI skill to your agent configuration:
```yaml
skills:
  - name: workspace-ui
    path: ./packages/ui/AGENT_UI_SKILL.md
    priority: HIGH
    mandatory_for:
      - ui_components
      - forms
      - layouts
      - styling
```

### 3. Enforce in Code Review
Add these checks to your code review process:
- [ ] All UI components imported from `@workspace/ui`
- [ ] No custom buttons, inputs, cards, or basic UI elements
- [ ] Design tokens followed (spacing, border-radius, shadows)
- [ ] Material Design 3 patterns applied
- [ ] Accessibility features implemented
- [ ] Mobile-first responsive design

### 4. CI/CD Integration
Add automated checks:
```yaml
# Example CI check
- name: Check UI Component Usage
  run: |
    # Check for custom button implementations
    if git diff --name-only | grep -E "button|Button"; then
      echo "ERROR: Custom button detected. Use @workspace/ui Button component."
      exit 1
    fi
```

## Component Usage Rules

### MANDATORY: Use @workspace/ui Components
**ALWAYS import from**:
```tsx
import { Button, Input, Card, Dialog } from "@workspace/ui/components"
```

**NEVER create custom versions of**:
- ❌ Buttons (use Button)
- ❌ Inputs (use Input)
- ❌ Selects (use Select)
- ❌ Cards (use Card)
- ❌ Modals (use Dialog/Sheet)
- ❌ Dropdowns (use DropdownMenu)
- ❌ Loaders (use Loader/Skeleton)
- ❌ Toasts (use Toast)
- ❌ Checkboxes (use Checkbox)
- ❌ Radio buttons (use RadioGroup)
- ❌ Switches (use Switch)
- ❌ Tabs (use Tabs)
- ❌ Accordions (use Accordion)

### Component Catalog
Check `packages/ui/AGENT_UI_SKILL.md` for the complete catalog of 60+ available components before creating anything custom.

## Design Tokens

**ALWAYS use these design tokens**:
- **Border Radius**: `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px)
- **Spacing**: `gap-2` (8px), `gap-3` (12px), `gap-4` (16px), `gap-6` (24px)
- **Shadows**: `shadow-xs`, `shadow-sm`, `shadow-md`, `shadow-lg`
- **Typography**: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`

## Material Design 3 Patterns

**ALWAYS follow MD3 patterns**:
- Rounded corners: `rounded-2xl` for cards and large elements
- Touch targets: Minimum 44px height (h-11)
- Elevation: `shadow-sm` → `shadow-lg` on hover
- Ripple effects: Use `useRipple` hook for touch feedback
- Smooth transitions: `duration-300 ease-out`

## Accessibility Standards

**ALWAYS implement**:
- Keyboard navigation for all interactive elements
- ARIA labels for icon-only buttons
- Focus management for modals/drawers
- Visible focus indicators (ring-2 with offset)
- Screen reader support

## Violation Consequences

**Non-compliance will result in**:
- Code review rejection
- Technical debt flagging
- Required refactoring
- Project blockage until fixed

## Quick Reference

### Import Pattern
```tsx
import { Button, Input, Card } from "@workspace/ui/components"
import { useRipple } from "@workspace/ui/hooks"
import { cn } from "@workspace/ui/lib/utils"
```

### Button Pattern
```tsx
<Button variant="primary" size="md" loading={isLoading}>
  Submit
</Button>
```

### Input Pattern
```tsx
<Input className="rounded-xl h-11" placeholder="..." />
```

### Card Pattern
```tsx
<Card className="rounded-2xl shadow-md">
  <CardContent>Content</CardContent>
</Card>
```

## Resources

- **UI Skill**: `packages/ui/AGENT_UI_SKILL.md`
- **UI Guidelines**: `packages/ui/UI_GUIDELINES.md`
- **Component Docs**: `packages/ui/src/components/*.md`
- **Type Definitions**: `packages/ui/src/types/components/`

<!-- END:workspace-ui-rules -->
