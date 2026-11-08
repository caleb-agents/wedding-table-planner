import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  guests: defineTable({
    guestId: v.string(),
    name: v.string(),
  }).index("by_guestId", ["guestId"]),
  groups: defineTable({
    groupId: v.string(),
    name: v.string(),
    sort: v.number(),
  }).index("by_groupId", ["groupId"]),
  assignments: defineTable({
    guestId: v.string(),
    groupId: v.string(),
  })
    .index("by_guestId", ["guestId"])
    .index("by_groupId", ["groupId"]),
});
