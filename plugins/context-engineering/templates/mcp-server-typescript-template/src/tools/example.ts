/**
 * Example tool handler.
 *
 * Replace this with your implementation. Export the handler function
 * and register it in server.ts.
 */

interface ExampleToolArgs {
  query: string;
  max_results: number;
}

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export async function handleExampleTool(args: ExampleToolArgs): Promise<ToolResult> {
  const { query, max_results } = args;

  // Input validation
  if (!query || !query.trim()) {
    return {
      content: [{ type: "text", text: "Error: query cannot be empty. Provide a search term." }],
      isError: true,
    };
  }

  const clampedMax = Math.min(Math.max(1, max_results), 100);

  // TODO: Replace with your implementation
  const results: Array<{ name: string; score: number }> = [];

  if (results.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `No items found matching '${query}'. Try broader terms.`,
        },
      ],
    };
  }

  const lines = [`Found ${results.length} items:\n`];
  results.forEach((item, i) => {
    lines.push(`${i + 1}. **${item.name}** (score: ${item.score.toFixed(2)})`);
  });

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}
