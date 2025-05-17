import { Tool, ToolSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const CHECKS_QUANTITY = 9;

const toolSchema = z.object({
  name: z
    .string()
    .min(1, "Tool name must not be empty")
    .max(64, "Tool name must be less than or equal to 64 characters long")
    .regex(
      /^[a-z0-9_-]*$/i,
      "Tool name can only contains letter, numbers, underscore and hypens",
    ),
  description: z
    .string({ message: "You must specify a tool description for the LLM" })
    .max(
      1024,
      "Tool description must be less than or equal to 1024 characters long",
    ),
  annotations: ToolSchema.shape.annotations
    .and(
      z.object(
        {
          title: z
            .string({ message: "Tool human-readable title is missing" })
            .min(1, "Tool annotation title must not be empty"),
        },
        { message: "You must specify a tool annotations object" },
      ),
    )
    .refine(
      ({ destructiveHint, readOnlyHint }) =>
        !(destructiveHint === true && readOnlyHint === true),
      "Tool cannot be annotated read-only and destructive at the same time",
    ),
});

const useToolChecks = ({ tool }: { tool: Tool }) => {
  const { error } = toolSchema.safeParse(tool);
  const issues = error?.issues ?? [];

  return {
    hasIssue: issues.length !== 0,
    checksQuantity: {
      successfull: CHECKS_QUANTITY - issues.length,
      failed: issues.length,
    },
    issues,
  };
};

export default useToolChecks;
