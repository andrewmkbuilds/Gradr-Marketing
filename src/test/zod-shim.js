/**
 * Vitest zod resolution shim.
 *
 * zod 3.25+ exposes a "@zod/source" export condition pointing at raw TS, and
 * its compiled `index.js` does `import * as z … export { z }` — a namespace
 * re-export that Vite/vitest silently drops, so `import { z } from "zod"`
 * resolves to `undefined`. This shim binds the namespace to a concrete
 * `const` so the named export survives. Aliased in `vitest.config.ts`.
 */
import * as zNamespace from "../../node_modules/zod/v3/external.js";

export * from "../../node_modules/zod/v3/external.js";
export const z = zNamespace;
export default zNamespace;
