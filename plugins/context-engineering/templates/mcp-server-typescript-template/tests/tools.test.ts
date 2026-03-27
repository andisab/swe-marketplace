/**
 * Unit tests for {server-name} tools.
 *
 * Test each handler directly by importing and calling with args.
 */

import { describe, it, expect } from "vitest";
import { handleExampleTool } from "../src/tools/example.js";

describe("example_tool", () => {
  it("returns text content for valid query", async () => {
    const result = await handleExampleTool({ query: "test", max_results: 5 });
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe("text");
  });

  it("returns error for empty query", async () => {
    const result = await handleExampleTool({ query: "", max_results: 10 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toContain("error");
  });

  it("handles no results gracefully", async () => {
    const result = await handleExampleTool({ query: "nonexistent_xyz", max_results: 10 });
    expect(result.content[0].text.toLowerCase()).toContain("no items");
  });
});
