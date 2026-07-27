import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
	resolve: {
		// Mirror tsconfig's "@/*" → "./*" path alias.
		alias: { "@": path.resolve(__dirname) },
	},
	test: {
		include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
		// Node by default (most suites are pure logic and it is much faster);
		// files that render React opt into jsdom with a
		// `// @vitest-environment jsdom` pragma on their first line.
		environment: "node",
	},
});
