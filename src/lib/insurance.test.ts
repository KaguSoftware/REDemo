import { describe, it, expect } from "vitest";
import { policyState, isoDaysFrom } from "./insurance";
import { oneYearLater } from "./db/propertyInsurance";

const TODAY = "2026-07-27";
const HORIZON = "2026-08-26";

describe("policyState", () => {
	it("separates expired, expiring and valid", () => {
		expect(policyState("2026-07-26", TODAY, HORIZON)).toBe("expired");
		expect(policyState("2026-07-27", TODAY, HORIZON)).toBe("expiring"); // today counts as expiring, not expired
		expect(policyState("2026-08-26", TODAY, HORIZON)).toBe("expiring"); // the horizon is inclusive
		expect(policyState("2026-08-27", TODAY, HORIZON)).toBe("valid");
	});

	it("compares ISO strings without constructing dates", () => {
		// Zero-padded ISO dates order lexicographically, which is the whole reason
		// this is safe to do with `<`. A single-digit month would break it.
		expect(policyState("2026-09-01", TODAY, HORIZON)).toBe("valid");
		expect(policyState("2025-12-31", TODAY, HORIZON)).toBe("expired");
	});
});

describe("isoDaysFrom", () => {
	it("adds days across a month boundary", () => {
		expect(isoDaysFrom("2026-07-27", 30)).toBe("2026-08-26");
	});

	it("adds days across a year boundary", () => {
		expect(isoDaysFrom("2026-12-20", 30)).toBe("2027-01-19");
	});

	it("handles a leap day", () => {
		expect(isoDaysFrom("2028-02-28", 1)).toBe("2028-02-29");
	});
});

describe("oneYearLater", () => {
	it("advances a policy by exactly one year", () => {
		expect(oneYearLater("2026-07-27")).toBe("2027-07-27");
		expect(oneYearLater("2026-01-01")).toBe("2027-01-01");
	});

	it("clamps 29 February to 28 February, the way an insurer does", () => {
		// Naive Date arithmetic rolls this to 1 March, which would silently give
		// the office a policy that ends a day later than the paper says.
		expect(oneYearLater("2028-02-29")).toBe("2029-02-28");
	});

	it("does not drift across a DST boundary", () => {
		// Turkey is permanently UTC+3 now, but the browser's zone is whatever the
		// agent's laptop says. A local-time Date would land on the 30th or 28th
		// for dates either side of a transition; this must not.
		expect(oneYearLater("2026-03-29")).toBe("2027-03-29");
		expect(oneYearLater("2026-10-25")).toBe("2027-10-25");
	});

	it("returns empty for a blank or malformed date", () => {
		expect(oneYearLater("")).toBe("");
		expect(oneYearLater("27.07.2026")).toBe("");
	});
});
