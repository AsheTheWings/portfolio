import { countAcquired, isWorkflowEligible, workflowLockReason } from './workflow-eligibility';
import type { Agent, Workflow } from '../types';

const agents = (...ids: string[]): Pick<Agent, 'agentId'>[] => ids.map((agentId) => ({ agentId }));
const workflow = (minAcquiredAgents?: number): Workflow =>
  ({ minAcquiredAgents } as unknown as Workflow);

describe('countAcquired', () => {
  it("excludes the 'none' agent", () => {
    expect(countAcquired(agents('a', 'none', 'b'))).toBe(2);
  });

  it('counts zero for an empty or all-none list', () => {
    expect(countAcquired(agents())).toBe(0);
    expect(countAcquired(agents('none', 'none'))).toBe(0);
  });
});

describe('isWorkflowEligible', () => {
  it('is always eligible when no minimum is set', () => {
    expect(isWorkflowEligible(workflow(undefined), agents())).toBe(true);
  });

  it('requires at least minAcquiredAgents non-none agents', () => {
    expect(isWorkflowEligible(workflow(2), agents('a'))).toBe(false);
    expect(isWorkflowEligible(workflow(2), agents('a', 'b'))).toBe(true);
    expect(isWorkflowEligible(workflow(2), agents('a', 'none', 'b'))).toBe(true);
  });
});

describe('workflowLockReason', () => {
  it('returns null when eligible or unconstrained', () => {
    expect(workflowLockReason(workflow(0), agents())).toBeNull();
    expect(workflowLockReason(workflow(1), agents('a'))).toBeNull();
  });

  it('describes the shortfall when locked', () => {
    expect(workflowLockReason(workflow(2), agents('a'))).toBe('Requires 2 agents (1/2 selected)');
  });
});
