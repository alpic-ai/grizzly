import { Tool } from "@modelcontextprotocol/sdk/types.js";
import useToolChecks from "../useToolChecks";

const CORRECT_TOOL_BASE: Tool = {
  name: "correct_tool",
  description: "The tool description",
  inputSchema: { type: "object" },
  annotations: {
    title: "A human-readable name for the tool",
  },
};

describe("useToolChecks", () => {
  test("asserts correct tool passes with flying colors", () => {
    expect(
      useToolChecks({
        tool: CORRECT_TOOL_BASE,
      }),
    ).toMatchObject({
      checksQuantity: { failed: 0 },
      issues: [],
      hasIssue: false,
    });
  });

  const failingTestCases: Tool[] = [
    {
      ...CORRECT_TOOL_BASE,
      name: "",
    },
    {
      ...CORRECT_TOOL_BASE,
      name: Array(65).fill("a").join(""),
    },
    {
      ...CORRECT_TOOL_BASE,
      name: "tool with invalid chars",
    },
    {
      ...CORRECT_TOOL_BASE,
      description: undefined,
    },
    {
      ...CORRECT_TOOL_BASE,
      description: Array(1025).fill("a").join(""),
    },
    {
      ...CORRECT_TOOL_BASE,
      annotations: { readOnlyHint: true, destructiveHint: true },
    },
    {
      ...CORRECT_TOOL_BASE,
      annotations: undefined,
    },
    {
      ...CORRECT_TOOL_BASE,
      annotations: { title: undefined },
    },
  ];
  test.each(failingTestCases)(
    "asserts tool fails for one reason",
    (inputTool) => {
      expect(useToolChecks({ tool: inputTool })).toMatchObject({
        checksQuantity: { failed: 1 },
      });
    },
  );
});
