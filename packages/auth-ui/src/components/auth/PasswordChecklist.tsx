/**
 * PasswordChecklist Component
 * Live password-requirements checklist rendered below password inputs.
 * Rules update on every keystroke — pairs with PASSWORD_RULES from validators.
 */

'use client';

import { CheckIcon, CircleIcon } from 'lucide-react';
import { cn } from '@workspace/ui/lib/utils';
import { PASSWORD_RULES, type PasswordRule } from '../../lib/validators';

export interface PasswordChecklistProps {
  password: string;
  rules?: readonly PasswordRule[];
  className?: string;
}

export default function PasswordChecklist({
  password,
  rules = PASSWORD_RULES,
  className,
}: PasswordChecklistProps) {
  return (
    <ul className={cn('space-y-1', className)} aria-label="Password requirements">
      {rules.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className="flex items-center gap-2 text-xs">
            {met ? (
              <CheckIcon className="size-3.5 shrink-0 text-green-600" aria-hidden />
            ) : (
              <CircleIcon className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
            )}
            <span className={met ? 'text-foreground/90' : 'text-muted-foreground'}>
              {rule.label}
            </span>
            <span className="sr-only">{met ? ' (met)' : ' (not met)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
