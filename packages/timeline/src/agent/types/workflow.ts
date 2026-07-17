import type { WorkflowDescriptor } from '@agentime/protocol';

export type Workflow = WorkflowDescriptor;

export function workflowDisplayName(id: string): string {
  return id
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
