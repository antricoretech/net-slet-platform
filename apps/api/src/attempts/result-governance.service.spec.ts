import { ResultGovernanceService } from './result-governance.service';

describe('ResultGovernanceService', () => {
  function service(result: Record<string, unknown>) {
    const tx = {
      $executeRaw: jest.fn(),
      attemptResult: { findFirst: jest.fn().mockResolvedValue(result), update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...result, ...data })) },
      auditEvent: { create: jest.fn() },
    };
    const database = { $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)) };
    return { governance: new ResultGovernanceService(database as never, {} as never), tx };
  }

  test('publishes a terminal pending result with approval evidence and audit', async () => {
    const { governance, tx } = service({ id: 'result-1', attemptId: 'attempt-1', status: 'PENDING', releasedAt: null, releaseApprovalReference: null, attempt: { status: 'SUBMITTED' }, scoreRun: { scoreRunHash: 'hash-1' } });
    await expect(governance.publish('attempt-1', 'admin-1', { approvalReference: 'APR-1', reason: 'Owner-approved release' })).resolves.toMatchObject({ attemptId: 'attempt-1', status: 'PUBLISHED', releaseApprovalReference: 'APR-1' });
    expect(tx.attemptResult.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'result-1' }, data: expect.objectContaining({ releasedById: 'admin-1', releaseApprovalReference: 'APR-1', status: 'PUBLISHED' }) }));
    expect(tx.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'RESULT_RELEASED', accountId: 'admin-1', attemptId: 'attempt-1' }) }));
  });

  test('publication is idempotent after the result is already published', async () => {
    const { governance, tx } = service({ id: 'result-1', attemptId: 'attempt-1', status: 'PUBLISHED', releasedAt: new Date(), releaseApprovalReference: 'APR-1', attempt: { status: 'SUBMITTED' }, scoreRun: { scoreRunHash: 'hash-1' } });
    await expect(governance.publish('attempt-1', 'admin-2', { approvalReference: 'APR-2', reason: 'Retry' })).resolves.toMatchObject({ status: 'PUBLISHED', releaseApprovalReference: 'APR-1' });
    expect(tx.attemptResult.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
});
