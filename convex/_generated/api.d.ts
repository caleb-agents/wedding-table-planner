import type { ApiFromModules, FilterApi, FunctionReference } from "convex/server";
import type * as plan from "../plan.js";

declare const fullApi: ApiFromModules<{ plan: typeof plan }>;

export declare const api: FilterApi<typeof fullApi, FunctionReference<any, "public">>;
export declare const internal: FilterApi<typeof fullApi, FunctionReference<any, "internal">>;
