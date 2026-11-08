// @vitest-environment node
import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import { api } from '../../convex/_generated/api';
import schema from '../../convex/schema';
import publicGuests from '../data/public-guests.json';

const modules = import.meta.glob('../../convex/**/*.{ts,js}');

function backend() {
  return convexTest(schema, modules);
}

const published = publicGuests.guests;

describe('shared plan', () => {
  it('seeds only public ids and names, then syncs a seat to a second reader', async () => {
    const t = backend();
    await t.mutation(api.plan.ensureDefaults, {});
    await t.mutation(api.plan.ensureDefaults, {});
    const clientA = await t.query(api.plan.get, {});
    expect(clientA.guests).toHaveLength(published.length);
    expect(clientA.guests.map(guest => guest.guestId)).toEqual(published.map(guest => guest.id));
    expect(clientA.guests.map(guest => guest.name)).toEqual(published.map(guest => guest.name));
    expect(Object.keys(clientA.guests[0]).sort()).toEqual(['guestId', 'name']);
    expect(clientA.groups).toHaveLength(14);
    expect(clientA.assignments).toEqual([]);

    await t.mutation(api.plan.seat, { guestId: 'g001', groupId: 'group-1' });
    const clientB = await t.query(api.plan.get, {});
    expect(clientB.assignments).toEqual([{ guestId: 'g001', groupId: 'group-1' }]);

    const reloaded = await t.query(api.plan.get, {});
    expect(reloaded).toEqual(clientB);
  });

  it('moves and unseats one person without touching the other', async () => {
    const t = backend();
    await t.mutation(api.plan.ensureDefaults, {});
    await t.mutation(api.plan.seat, { guestId: 'g001', groupId: 'group-1' });
    await t.mutation(api.plan.seat, { guestId: 'g002', groupId: 'group-1' });
    await t.mutation(api.plan.seat, { guestId: 'g001', groupId: 'group-2' });
    let plan = await t.query(api.plan.get, {});
    expect(plan.assignments).toHaveLength(2);
    expect(plan.assignments).toContainEqual({ guestId: 'g002', groupId: 'group-1' });
    expect(plan.assignments).toContainEqual({ guestId: 'g001', groupId: 'group-2' });
    await t.mutation(api.plan.unseat, { guestId: 'g001' });
    plan = await t.query(api.plan.get, {});
    expect(plan.assignments).toEqual([{ guestId: 'g002', groupId: 'group-1' }]);
  });

  it('keeps a table at 10 people when extra seats arrive together', async () => {
    const t = backend();
    await t.mutation(api.plan.ensureDefaults, {});
    const ids = published.slice(0, 11).map(guest => guest.id);
    const results = await Promise.allSettled(ids.map(guestId => t.mutation(api.plan.seat, { guestId, groupId: 'group-1' })));
    const plan = await t.query(api.plan.get, {});
    const seated = plan.assignments.filter(seat => seat.groupId === 'group-1');
    expect(seated).toHaveLength(10);
    expect(results.filter(result => result.status === 'rejected').length).toBeGreaterThan(0);
    await expect(t.mutation(api.plan.seat, { guestId: ids[10], groupId: 'group-1' })).rejects.toThrow(/full/);
  });

  it('refuses a move into a full table and refuses a stale import over existing seats', async () => {
    const t = backend();
    await t.mutation(api.plan.ensureDefaults, {});
    for (const guest of published.slice(0, 10)) {
      await t.mutation(api.plan.seat, { guestId: guest.id, groupId: 'group-1' });
    }
    await t.mutation(api.plan.seat, { guestId: published[10].id, groupId: 'group-2' });
    await expect(t.mutation(api.plan.seat, { guestId: published[10].id, groupId: 'group-1' })).rejects.toThrow(/full/);
    const plan = await t.query(api.plan.get, {});
    expect(plan.assignments.find(seat => seat.guestId === published[10].id)?.groupId).toBe('group-2');
    await expect(t.mutation(api.plan.importLocal, {
      groups: [{ groupId: 'stale', name: 'Stale', sort: 1 }],
      assignments: [{ guestId: 'g001', groupId: 'stale' }],
    })).rejects.toThrow(/already has assignments/);
    const after = await t.query(api.plan.get, {});
    expect(after.assignments).toEqual(plan.assignments);
  });

  it('imports a browser plan only while the shared plan is empty', async () => {
    const t = backend();
    await t.mutation(api.plan.ensureDefaults, {});
    await t.mutation(api.plan.importLocal, {
      groups: [{ groupId: 'family', name: 'Family', sort: 1 }],
      assignments: [{ guestId: 'g001', groupId: 'family' }],
    });
    const plan = await t.query(api.plan.get, {});
    expect(plan.groups.map(group => group.name)).toEqual(['Family']);
    expect(plan.assignments).toEqual([{ guestId: 'g001', groupId: 'family' }]);
    expect(plan.guests).toHaveLength(135);
    await expect(t.mutation(api.plan.seat, { guestId: 'not-a-guest', groupId: 'family' })).rejects.toThrow(/public list/);
  });

  it('renames a table and will not remove one that still has someone', async () => {
    const t = backend();
    await t.mutation(api.plan.ensureDefaults, {});
    await t.mutation(api.plan.renameGroup, { groupId: 'group-1', name: 'Family' });
    await t.mutation(api.plan.seat, { guestId: 'g135', groupId: 'group-1' });
    await expect(t.mutation(api.plan.removeGroup, { groupId: 'group-1' })).rejects.toThrow(/Move everyone/);
    await t.mutation(api.plan.unseat, { guestId: 'g135' });
    await t.mutation(api.plan.removeGroup, { groupId: 'group-1' });
    const plan = await t.query(api.plan.get, {});
    expect(plan.groups.find(group => group.groupId === 'group-1')).toBeUndefined();
    expect(plan.guests.find(guest => guest.guestId === 'g135')?.name).toBe('Athena');
  });

  it('adds a separate person for a repeated name and keeps them unassigned', async () => {
    const t = backend();
    await t.mutation(api.plan.ensureDefaults, {});
    const id = 'c_abcd1234efgh';
    await t.mutation(api.plan.addGuest, { guestId: id, name: '  Jean   Huang ' });
    await t.mutation(api.plan.addGuest, { guestId: id, name: 'Jean Huang' });
    await t.mutation(api.plan.ensureDefaults, {});
    const plan = await t.query(api.plan.get, {});
    const matches = plan.guests.filter(guest => guest.name === 'Jean Huang');
    expect(matches.map(guest => guest.guestId)).toEqual(['g001', id]);
    expect(plan.guests).toHaveLength(published.length + 1);
    expect(plan.assignments).toEqual([]);
    expect(plan.guests.at(-1)?.guestId).toBe(id);
    expect(Object.keys(plan.guests.at(-1) ?? {}).sort()).toEqual(['guestId', 'name']);
    await expect(t.mutation(api.plan.addGuest, { guestId: id, name: 'Someone Else' })).rejects.toThrow(/already in use/);
    expect((await t.query(api.plan.get, {})).guests.find(guest => guest.guestId === id)?.name).toBe('Jean Huang');
  });

  it('rejects an empty name, a long name, a published id, and an unsafe id', async () => {
    const t = backend();
    await t.mutation(api.plan.ensureDefaults, {});
    await expect(t.mutation(api.plan.addGuest, { guestId: 'c_abcd1234efgh', name: '   ' })).rejects.toThrow(/Enter a name/);
    await expect(t.mutation(api.plan.addGuest, { guestId: 'c_abcd1234efgh', name: 'A'.repeat(81) })).rejects.toThrow(/80/);
    await expect(t.mutation(api.plan.addGuest, { guestId: 'g001', name: 'Nope' })).rejects.toThrow(/original list/);
    await expect(t.mutation(api.plan.addGuest, { guestId: 'guest_not_custom', name: 'Nope' })).rejects.toThrow(/not valid/);
    const plan = await t.query(api.plan.get, {});
    expect(plan.guests).toHaveLength(published.length);
  });

  it('seats an added guest under the same cap and will not delete an original name', async () => {
    const t = backend();
    await t.mutation(api.plan.ensureDefaults, {});
    const id = 'c_abcd1234efgh';
    await t.mutation(api.plan.addGuest, { guestId: id, name: 'Nia Okonkwo' });
    await t.mutation(api.plan.seat, { guestId: id, groupId: 'group-1' });
    for (const guest of published.slice(0, 9)) {
      await t.mutation(api.plan.seat, { guestId: guest.id, groupId: 'group-1' });
    }
    await expect(t.mutation(api.plan.seat, { guestId: published[9].id, groupId: 'group-1' })).rejects.toThrow(/full/);
    await expect(t.mutation(api.plan.removeGuest, { guestId: id })).rejects.toThrow(/Move that guest/);
    await expect(t.mutation(api.plan.removeGuest, { guestId: 'g001' })).rejects.toThrow(/original list/);
    let plan = await t.query(api.plan.get, {});
    expect(plan.assignments.filter(seat => seat.groupId === 'group-1')).toHaveLength(10);
    expect(plan.assignments).toContainEqual({ guestId: id, groupId: 'group-1' });
    expect(plan.guests.find(guest => guest.guestId === 'g001')?.name).toBe(published[0].name);
    await t.mutation(api.plan.unseat, { guestId: id });
    await t.mutation(api.plan.removeGuest, { guestId: id });
    plan = await t.query(api.plan.get, {});
    expect(plan.guests.find(guest => guest.guestId === id)).toBeUndefined();
    expect(plan.guests).toHaveLength(published.length);
    expect(plan.assignments).toHaveLength(9);
    expect(plan.assignments.find(seat => seat.guestId === 'g001')?.groupId).toBe('group-1');
  });

  it('keeps two same-name guests added at the same time, and imports one with a seat', async () => {
    const t = backend();
    await t.mutation(api.plan.ensureDefaults, {});
    const first = 'c_aaaa1111bbbb';
    const second = 'c_bbbb2222cccc';
    await Promise.all([
      t.mutation(api.plan.addGuest, { guestId: first, name: 'Pat Lee' }),
      t.mutation(api.plan.addGuest, { guestId: second, name: 'Pat Lee' }),
    ]);
    let plan = await t.query(api.plan.get, {});
    expect(plan.guests.filter(guest => guest.name === 'Pat Lee').map(guest => guest.guestId)).toEqual([first, second]);
    const fresh = backend();
    await fresh.mutation(api.plan.ensureDefaults, {});
    await fresh.mutation(api.plan.importLocal, {
      groups: [{ groupId: 'family', name: 'Family', sort: 1 }],
      assignments: [{ guestId: first, groupId: 'family' }],
      guests: [{ guestId: first, name: '  Pat   Lee ' }],
    });
    plan = await fresh.query(api.plan.get, {});
    expect(plan.guests.find(guest => guest.guestId === first)?.name).toBe('Pat Lee');
    expect(plan.assignments).toEqual([{ guestId: first, groupId: 'family' }]);
    expect(plan.guests).toHaveLength(published.length + 1);
    expect(plan.guests.find(guest => guest.guestId === 'g135')?.name).toBe('Athena');
  });
});
