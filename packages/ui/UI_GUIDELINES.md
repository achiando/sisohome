# @workspace/ui Design System Guidelines

## Overview

This document defines the comprehensive design system for `@workspace/ui` - a reusable UI component library built on React, TypeScript, Tailwind CSS, and Radix UI. These guidelines must be followed when building or modifying components to ensure consistency across all projects using this library.

## Core Principles

### 1. Component Architecture
- **Radix UI Primitives**: All interactive components use Radix UI for accessibility and behavior
- **Tailwind CSS**: All styling uses Tailwind utility classes
- **TypeScript**: Full type safety with exported interfaces
- **CVA for Variants**: Use `class-variance-authority` for component variants
- **Compound Components**: Complex components use compound patterns (Dialog, Sheet, etc.)

### 2. Design Philosophy
- **Material Design 3**: Follow MD3 patterns for elevation, rounded corners, and spacing
- **Mobile-First**: Responsive design with mobile as the primary consideration
- **Accessibility First**: Full keyboard navigation, screen reader support, focus management
- **Performance**: Optimized re-renders, CSS containment, minimal bundle size

## Component Patterns

### Button System

**Variants**: `primary | secondary | outline | subtle | destructive | text`

**Sizes**: `sm (h-9) | md (h-11) | lg (h-13) | icon (h-11 w-11)`

**Required Props**:
```tsx
<Button
  variant="primary"  // Default
  size="md"          // Default
  loading={false}    // Built-in loading state
  leftIcon={ReactNode}
  rightIcon={ReactNode}
>
  Label
</Button>
```

**Rules**:
- Always use defined variants - never create custom button styles
- Use `loading` prop for async actions - never manually add loaders
- Icons must be 4x4 size (`w-4 h-4`)
- Use `size="icon"` for icon-only buttons
- Rounded corners: `rounded-lg` (8px)

### Loading States

**Loader Component** (for inline loading):
```tsx
<Loader size="sm | md | lg" />
```

**Use Loader For**:
- Button loading states
- Input actions
- Inline text loading

**Use Skeleton For**:
- Tables
- Cards
- Page content
- Lists

**Never Use Loader For**:
- Full page loading (use Skeleton)
- Large content areas (use Skeleton)

### Form System

**UniversalForm Variants**:
- `standard` - Single-section or multi-section forms
- `wizard` - Multi-step with incremental submission
- `section-edit` - Collapsible sections with per-section save

**Key Props**:
```tsx
<UniversalForm
  variant="wizard"
  bare={false}  // Default: true (no card wrapper)
  hideSectionTitles={false}
  hideStepTitle={false}
  compact={false}
  onStepSubmit={async (stepIndex, stepData) => { ... }}
  onValidateStep={(stepIndex, values) => { ... }}
/>
```

**Field Types**:
- `text | email | number | password`
- `phone` - with country code and flag (default: Kenya/KE)
- `textarea`
- `select | multi-select`
- `radio | checkbox | toggle`
- `date | datetime`
- `file`
- `custom`

**Rules**:
- Default to `bare={true}` - forms render without card wrapper
- Use `onStepSubmit` for incremental wizard data submission
- Use `onValidateStep` for per-step validation
- Phone input defaults to Kenya (`defaultCountry="KE"`)
- Select uses `position="item-aligned"` by default

### Card System

**Card Component**:
```tsx
<Card className="rounded-2xl shadow-md">
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

**Mobile Cards** (Material Design 3):
- Rounded corners: `rounded-2xl` (16px)
- Ripple effects on tap
- Elevation: `shadow-sm` → `shadow-lg` on hover
- Touch targets: minimum 44px height
- Expandable content with smooth animations

**Rules**:
- Use `rounded-2xl` for modern MD3 look
- Add ripple effects for touch feedback
- Minimum 44px touch targets for mobile
- Smooth transitions (duration-300 ease-out)

### Input System

**Input Component**:
```tsx
<Input
  className="rounded-xl border-border/80 bg-card/50 h-11"
  placeholder="..."
/>
```

**Rules**:
- Rounded corners: `rounded-xl` (12px)
- Height: `h-11` (44px) for touch targets
- Border: `border-border/80`
- Background: `bg-card/50` for subtle depth
- Focus ring: `ring-2 ring-primary/20`

### Select Component

**Select Component**:
```tsx
<Select>
  <SelectTrigger className="rounded-xl h-11">
    <SelectValue placeholder="..." />
  </SelectTrigger>
  <SelectContent position="item-aligned" align="start">
    <SelectItem value="...">Label</SelectItem>
  </SelectContent>
</Select>
```

**Rules**:
- Default `position="item-aligned"` (not "popper")
- Default `align="start"`
- Rounded corners: `rounded-xl`
- Height: `h-11`

### Table System

**Table Component**:
- Sticky header with `backdrop-blur-sm`
- Max height with scrolling: `max-h-[600px] overflow-y-auto`
- Rounded corners: `rounded-2xl`
- Border: `border-border/80`
- Shadow: `shadow-md`

**Skeleton Loading**:
```tsx
{loading ? (
  <table>
    <thead>{/* actual headers */}</thead>
    <tbody>
      {[...Array(5)].map((_, idx) => (
        <tr key={idx}>
          {columns.map((_, cIdx) => (
            <td key={cIdx}><Skeleton className="h-4 w-full" /></td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
) : (
  {/* actual data */}
)}
```

**Rules**:
- Always show skeleton with actual headers during loading
- 5 skeleton rows is standard
- Use Skeleton component, not Loader

### Responsive Data Listing

**ResponsiveDataListing Component**:
- Desktop: Table view with sticky header
- Mobile: Card view with Material Design 3 styling
- Skeleton loading for both views
- Search with Material Design input styling
- Filter drawer with rounded-2xl cards

**Rules**:
- Table view on `md:` breakpoint and above
- Card view on mobile (`md:hidden`)
- Skeleton loading matches actual structure
- Search input: `rounded-xl h-11`
- Filter drawer: `rounded-2xl p-4`

## Design Tokens

### Spacing
- `gap-2` (8px) - Tight spacing
- `gap-3` (12px) - Default spacing
- `gap-4` (16px) - Comfortable spacing
- `gap-6` (24px) - Section spacing

### Border Radius
- `rounded-lg` (8px) - Buttons, small elements
- `rounded-xl` (12px) - Inputs, selects
- `rounded-2xl` (16px) - Cards, mobile cards, large elements

### Shadows
- `shadow-xs` - Subtle elevation
- `shadow-sm` - Default elevation
- `shadow-md` - Cards, tables
- `shadow-lg` - Hover states, emphasis

### Typography
- `text-xs` (12px) - Labels, helper text
- `text-sm` (14px) - Default body text
- `text-base` (16px) - Emphasis
- `text-lg` (18px) - Section headers
- `text-xl` (20px) - Page titles
- `text-2xl` (24px) - Large titles

### Colors
- Use CSS custom properties for theming
- Border opacity: `/60`, `/80` for subtle borders
- Background opacity: `/50`, `/70` for layered backgrounds
- Text opacity: `/60`, `/80` for muted text

## Hooks

### useRipple
Material Design ripple effect for touch feedback:
```tsx
const { ripples, createRipple } = useRipple()

<div onClick={(e) => createRipple(e)}>
  {ripples.map(ripple => <span key={ripple.id} className="animate-ripple" />)}
</div>
```

### useSwipe
Swipe gesture detection:
```tsx
const swipeHandlers = useSwipe({
  onSwipeLeft: () => { ... },
  onSwipeRight: () => { ... },
  threshold: 100,
})
```

### useMobile
Mobile detection:
```tsx
const isMobile = useMobile()
```

### useResponsive
Responsive breakpoint detection:
```tsx
const { isMobile, isTablet, isDesktop } = useResponsive()
```

## File Structure

```
packages/ui/src/
├── components/
│   ├── button.tsx          # Component file
│   ├── button.md          # Documentation
│   ├── form/              # Feature folders
│   │   ├── universal-form.tsx
│   │   ├── form-field.tsx
│   │   └── WIZARD_USAGE.md
│   ├── shared/            # Shared components
│   │   ├── responsive-data-listing.tsx
│   │   ├── responsive-mobile-card.tsx
│   │   └── infinite-scroll-sentinel.tsx
│   └── index.ts           # Barrel export
├── hooks/
│   ├── use-ripple.ts
│   ├── use-swipe.ts
│   └── use-mobile.ts
├── lib/
│   └── utils.ts           # cn() utility
├── types/
│   └── components/        # Type definitions
│       └── forms.ts
└── styles/
    └── globals.css
```

## Naming Conventions

### Components
- PascalCase for component names: `Button`, `ResponsiveMobileCard`
- kebab-case for file names: `button.tsx`, `responsive-mobile-card.tsx`
- Feature folders for complex components: `form/`, `shared/`, `analytics/`

### Props
- camelCase for prop names: `isLoading`, `onSubmit`
- Boolean props: `is*`, `has*`, `should*` prefixes
- Event handlers: `on*` prefix

### Types
- PascalCase for interfaces: `ButtonProps`, `FormFieldProps`
- PascalCase for type aliases: `FieldType`, `FormMode`

## Documentation Standards

### Component Documentation (.md files)
Every major component should have a `.md` file with:
1. **Overview** - What the component does
2. **API Reference** - Props table with types and defaults
3. **Usage Examples** - Common use cases
4. **System Rules** - DO/DON'T guidelines
5. **Design Principles** - Visual and behavioral guidelines
6. **Best Practices** - Usage recommendations

### Example Structure:
```markdown
# Component Name

## Overview
Brief description...

## API Reference
Props table...

## Usage Examples
Code examples...

## System Rules
### DO
- Rule 1
- Rule 2

### DON'T
- Rule 1
- Rule 2

## Design Principles
...

## Best Practices
...
```

## Accessibility Standards

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Use semantic HTML elements
- Implement focus management for modals/drawers
- Visible focus indicators (ring-2 with offset)

### Screen Readers
- ARIA labels for icon-only buttons
- ARIA descriptions for complex interactions
- Role attributes for custom components
- Live regions for dynamic content

### Focus Management
- Focus trap in modals/dialogs
- Focus restoration on close
- Logical tab order
- Skip links for main content

## Performance Guidelines

### React Optimization
- Use `React.memo` for pure components
- Use `useCallback` for event handlers
- Use `useMemo` for expensive computations
- Avoid unnecessary re-renders

### CSS Optimization
- Use CSS containment where appropriate
- Avoid expensive animations
- Use transforms instead of top/left for animations
- Minimize layout thrashing

### Bundle Size
- Tree-shakeable exports
- Lazy load heavy components
- Avoid large dependencies
- Use dynamic imports for optional features

## Testing Standards

### Component Testing
- Test all prop variants
- Test interaction states (hover, focus, disabled)
- Test accessibility (keyboard navigation)
- Test responsive behavior

### Visual Regression
- Test all component variants
- Test different themes
- Test different screen sizes
- Test loading states

## Migration Guide

When updating components:
1. Update the component file
2. Update the documentation (.md)
3. Update type definitions if needed
4. Add migration examples to documentation
5. Update dependent components

## Version Control

### Semantic Versioning
- **Major**: Breaking changes
- **Minor**: New features, backward compatible
- **Patch**: Bug fixes, backward compatible

### Changelog
Document all changes in CHANGELOG.md with:
- [Added] - New features
- [Changed] - Changes to existing features
- [Deprecated] - Features to be removed
- [Removed] - Removed features
- [Fixed] - Bug fixes

## Integration Guidelines

### Using in Other Projects

```bash
# Install
npm install @workspace/ui

# Import components
import { Button, Card, Input } from '@workspace/ui/components'
import { useRipple } from '@workspace/ui/hooks'
import { cn } from '@workspace/ui/lib/utils'
```

### Styling Setup
```tsx
// Add to your globals.css
@import '@workspace/ui/globals.css'
```

### Theme Setup
```tsx
// Configure CSS variables for theming
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  // ... more variables
}
```

## Common Patterns

### Compound Components
```tsx
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
  </DialogContent>
</Dialog>
```

### with CVA
```tsx
const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        primary: "primary-classes",
        secondary: "secondary-classes",
      },
      size: {
        sm: "sm-classes",
        md: "md-classes",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)
```

### with cn()
```tsx
className={cn(
  "base-classes",
  isActive && "active-classes",
  className
)}
```

## Checklist for New Components

Before adding a new component:
- [ ] Follow naming conventions
- [ ] Use Radix UI primitives if interactive
- [ ] Implement with TypeScript
- [ ] Add CVA for variants
- [ ] Include accessibility features
- [ ] Add keyboard navigation
- [ ] Create documentation (.md)
- [ ] Add to barrel export (index.ts)
- [ ] Test on mobile and desktop
- [ ] Test with screen readers
- [ ] Add loading states if applicable
- [ ] Add skeleton states if applicable
- [ ] Follow design tokens
- [ ] Use rounded corners correctly
- [ ] Use shadows correctly
- [ ] Add ripple effects for touch
- [ ] Test responsive behavior

## Resources

### Internal
- Component documentation in `/components/*.md`
- Type definitions in `/types/components/`
- Usage examples in `/form/WIZARD_USAGE.md`

### External
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Material Design 3](https://m3.material.io/)
- [Lucide Icons](https://lucide.dev/)

## Support

For questions or issues:
1. Check component documentation
2. Check this guidelines document
3. Check existing component implementations
4. Refer to Material Design 3 guidelines
