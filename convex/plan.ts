import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  assertCustomGuestId,
  cleanGuestName,
  isCustomGuestId,
  MAX_PLAN_GUESTS,
} from "../src/utils/guestName";
import {
  GROUP_CAP,
  PUBLISHED_GUESTS,
  assertGroupCount,
  assertGroupId,
  cleanName,
  defaultGroups,
  isPublishedGuest,
} from "./published";

const guestResult = v.object({ guestId: v.string(), name: v.string() });
const groupResult = v.object({ groupId: v.string(), name: v.string(), sort: v.number() });
const assignmentResult = v.object({ guestId: v.string(), groupId: v.string() });

async function upsertPublishedGuests(ctx: MutationCtx): Promise<void> {
  const rows = await ctx.db.query("guests").take(MAX_PLAN_GUESTS);
  const byId = new Map(rows.map(row => [row.guestId, row]));
  for (const guest of PUBLISHED_GUESTS) {
    const existing = byId.get(guest.id);
    if (!existing) {
      await ctx.db.insert("guests", { guestId: guest.id, name: guest.name });
    } else if (existing.name !== guest.name) {
      await ctx.db.patch(existing._id, { name: guest.name });
    }
  }
}

async function groupById(ctx: QueryCtx | MutationCtx, groupId: string) {
  return ctx.db.query("groups").withIndex("by_groupId", q => q.eq("groupId", groupId)).unique();
}

async function assignmentByGuest(ctx: QueryCtx | MutationCtx, guestId: string) {
  return ctx.db.query("assignments").withIndex("by_guestId", q => q.eq("guestId", guestId)).unique();
}

async function guestById(ctx: QueryCtx | MutationCtx, guestId: string) {
  return ctx.db.query("guests").withIndex("by_guestId", q => q.eq("guestId", guestId)).unique();
}

async function requireListedGuest(ctx: QueryCtx | MutationCtx, guestId: string): Promise<void> {
  if (isPublishedGuest(guestId)) return;
  if (!isCustomGuestId(guestId)) throw new Error("That guest is not on the public list.");
  const guest = await guestById(ctx, guestId);
  if (!guest) throw new Error("That guest is not on the list.");
}

const publishedRank = new Map(PUBLISHED_GUESTS.map((guest, index) => [guest.id, index]));

function sortGuests<T extends { guestId: string }>(guests: T[]): T[] {
  return guests.sort((a, b) => {
    const ar = publishedRank.get(a.guestId);
    const br = publishedRank.get(b.guestId);
    if (ar !== undefined && br !== undefined) return ar - br;
    if (ar !== undefined) return -1;
    if (br !== undefined) return 1;
    return a.guestId < b.guestId ? -1 : a.guestId > b.guestId ? 1 : 0;
  });
}

export const get = query({
  args: {},
  returns: v.object({
    guests: v.array(guestResult),
    groups: v.array(groupResult),
    assignments: v.array(assignmentResult),
  }),
  handler: async ctx => {
    const guests = sortGuests(await ctx.db.query("guests").take(MAX_PLAN_GUESTS));
    const groups = await ctx.db.query("groups").take(50);
    const assignments = await ctx.db.query("assignments").take(MAX_PLAN_GUESTS);
    return {
      guests: guests.map(guest => ({ guestId: guest.guestId, name: guest.name })),
      groups: groups.map(group => ({ groupId: group.groupId, name: group.name, sort: group.sort })),
      assignments: assignments.map(seat => ({ guestId: seat.guestId, groupId: seat.groupId })),
    };
  },
});

export const ensureDefaults = mutation({
  args: {},
  returns: v.null(),
  handler: async ctx => {
    await upsertPublishedGuests(ctx);
    const existing = await ctx.db.query("groups").take(1);
    if (existing.length === 0) {
      for (const group of defaultGroups()) {
        await ctx.db.insert("groups", group);
      }
    }
    return null;
  },
});

export const seat = mutation({
  args: { guestId: v.string(), groupId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireListedGuest(ctx, args.guestId);
    assertGroupId(args.groupId);
    const group = await groupById(ctx, args.groupId);
    if (!group) throw new Error("That table does not exist.");
    const current = await assignmentByGuest(ctx, args.guestId);
    if (current?.groupId === args.groupId) return null;
    const seated = await ctx.db.query("assignments").withIndex("by_groupId", q => q.eq("groupId", args.groupId)).take(GROUP_CAP + 1);
    if (seated.length >= GROUP_CAP) throw new Error("That table is full.");
    if (current) await ctx.db.delete(current._id);
    await ctx.db.insert("assignments", { guestId: args.guestId, groupId: args.groupId });
    return null;
  },
});

export const unseat = mutation({
  args: { guestId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireListedGuest(ctx, args.guestId);
    const current = await assignmentByGuest(ctx, args.guestId);
    if (current) await ctx.db.delete(current._id);
    return null;
  },
});

export const renameGroup = mutation({
  args: { groupId: v.string(), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertGroupId(args.groupId);
    const group = await groupById(ctx, args.groupId);
    if (!group) throw new Error("That table does not exist.");
    await ctx.db.patch(group._id, { name: cleanName(args.name) });
    return null;
  },
});

export const addGroup = mutation({
  args: { groupId: v.string(), name: v.string(), sort: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertGroupId(args.groupId);
    const groups = await ctx.db.query("groups").take(50);
    assertGroupCount(groups.length + 1);
    const existing = groups.find(group => group.groupId === args.groupId);
    if (existing) return null;
    await ctx.db.insert("groups", { groupId: args.groupId, name: cleanName(args.name), sort: args.sort });
    return null;
  },
});

export const removeGroup = mutation({
  args: { groupId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertGroupId(args.groupId);
    const seated = await ctx.db.query("assignments").withIndex("by_groupId", q => q.eq("groupId", args.groupId)).take(1);
    if (seated.length > 0) throw new Error("Move everyone out before removing that table.");
    const group = await groupById(ctx, args.groupId);
    if (group) await ctx.db.delete(group._id);
    return null;
  },
});

export const addGuest = mutation({
  args: { guestId: v.string(), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (isPublishedGuest(args.guestId)) throw new Error("That guest is part of the original list.");
    assertCustomGuestId(args.guestId);
    const name = cleanGuestName(args.name);
    const existing = await guestById(ctx, args.guestId);
    if (existing) {
      if (existing.name === name) return null;
      throw new Error("That guest id is already in use.");
    }
    const count = (await ctx.db.query("guests").take(MAX_PLAN_GUESTS + 1)).length;
    if (count >= MAX_PLAN_GUESTS) throw new Error("The guest list is full.");
    await ctx.db.insert("guests", { guestId: args.guestId, name });
    return null;
  },
});

export const removeGuest = mutation({
  args: { guestId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (isPublishedGuest(args.guestId)) throw new Error("That guest is part of the original list.");
    assertCustomGuestId(args.guestId);
    const seated = await assignmentByGuest(ctx, args.guestId);
    if (seated) throw new Error("Move that guest out before removing them.");
    const guest = await guestById(ctx, args.guestId);
    if (guest) await ctx.db.delete(guest._id);
    return null;
  },
});

export const importLocal = mutation({
  args: {
    groups: v.array(v.object({ groupId: v.string(), name: v.string(), sort: v.number() })),
    assignments: v.array(v.object({ guestId: v.string(), groupId: v.string() })),
    guests: v.optional(v.array(v.object({ guestId: v.string(), name: v.string() }))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const occupied = await ctx.db.query("assignments").take(1);
    if (occupied.length > 0) throw new Error("The shared plan already has assignments.");
    assertGroupCount(args.groups.length);
    if (args.assignments.length > MAX_PLAN_GUESTS) throw new Error("Too many assignments.");
    const incoming = (args.guests ?? []).map(guest => {
      if (isPublishedGuest(guest.guestId)) throw new Error("That guest is part of the original list.");
      assertCustomGuestId(guest.guestId);
      return { guestId: guest.guestId, name: cleanGuestName(guest.name) };
    });
    if (incoming.length > MAX_PLAN_GUESTS) throw new Error("Too many added guests.");
    const incomingIds = new Set<string>();
    for (const guest of incoming) {
      if (incomingIds.has(guest.guestId)) throw new Error("A guest is listed twice.");
      incomingIds.add(guest.guestId);
      const existing = await guestById(ctx, guest.guestId);
      if (existing && existing.name !== guest.name) throw new Error("That guest id is already in use.");
    }
    const knownGuests = new Set<string>([
      ...PUBLISHED_GUESTS.map(guest => guest.id),
      ...incomingIds,
    ]);
    const stored = await ctx.db.query("guests").take(MAX_PLAN_GUESTS);
    for (const guest of stored) {
      if (isCustomGuestId(guest.guestId)) knownGuests.add(guest.guestId);
    }
    const groupIds = new Set<string>();
    for (const group of args.groups) {
      assertGroupId(group.groupId);
      cleanName(group.name);
      if (groupIds.has(group.groupId)) throw new Error("A table is listed twice.");
      groupIds.add(group.groupId);
    }
    const counts = new Map<string, number>();
    const seenGuests = new Set<string>();
    for (const seat of args.assignments) {
      if (!knownGuests.has(seat.guestId)) throw new Error("An assignment uses an unknown guest.");
      assertGroupId(seat.groupId);
      if (!groupIds.has(seat.groupId)) throw new Error("An assignment uses an unknown table.");
      if (seenGuests.has(seat.guestId)) throw new Error("A guest is listed twice.");
      seenGuests.add(seat.guestId);
      const next = (counts.get(seat.groupId) ?? 0) + 1;
      if (next > GROUP_CAP) throw new Error("A table would have more than 10 people.");
      counts.set(seat.groupId, next);
    }
    const oldGroups = await ctx.db.query("groups").take(50);
    for (const group of oldGroups) await ctx.db.delete(group._id);
    for (const group of args.groups) {
      await ctx.db.insert("groups", { groupId: group.groupId, name: cleanName(group.name), sort: group.sort });
    }
    for (const guest of incoming) {
      const existing = await guestById(ctx, guest.guestId);
      if (!existing) await ctx.db.insert("guests", guest);
    }
    for (const seat of args.assignments) {
      await ctx.db.insert("assignments", { guestId: seat.guestId, groupId: seat.groupId });
    }
    await upsertPublishedGuests(ctx);
    return null;
  },
});
