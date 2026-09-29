# shadcn/ui monorepo template

This is a Next.js monorepo template with shadcn/ui.

## Adding components

To add components to your app, run the following command at the root of your `web` app:

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This will place the ui components in the `packages/ui/src/components` directory.

## Using components

To use the components in your app, import them from the `ui` package.

```tsx
import { Button } from "@workspace/ui/components/button";
```
Enforcement File Created
Created WORKSPACE_UI_ENFORCEMENT.md at WORKSPACE_UI_ENFORCEMENT.md

This standalone file contains all the enforcement rules you need to copy to other projects:

Required skill invocation
Cross-project enforcement guide (4 steps)
Component usage rules (prohibited list)
Design tokens reference
Material Design 3 patterns
Accessibility standards
Violation consequences
Quick reference patterns
CI/CD integration examples
To use in another project:

Copy WORKSPACE_UI_ENFORCEMENT.md to your project root
Copy AGENT_UI_SKILL.md and UI_GUIDELINES.md from the UI package
Add the skill to your agent configuration
Implement the code review checklist
Add the CI/CD checks