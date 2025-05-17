import { Tool } from "@modelcontextprotocol/sdk/types.js";

import useModel from "@/lib/hooks/useModel";
import { Anthropic } from "@anthropic-ai/sdk";
import { useCallback, useEffect, useState } from "react";
import { ToolUseBlock } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { ContentBlock } from "@anthropic-ai/sdk/resources/messages/messages.mjs";

const isToolUseBlock = (block: ContentBlock): block is ToolUseBlock => {
  return block.type === "tool_use";
};

type TestCase = {
  id: string;
  userPrompt: string;
  expectedToolCall: {
    toolName: string;
    parameters: Record<string, unknown>;
  };
};

export type ToolsEvaluationProps = { tools: Tool[] } & (
  | {
      status: "success";
      result: {
        testCases: TestCase[];
      };
    }
  | { status: "error"; error: unknown }
);

type ToolEvaluationResult =
  | { status: "success" }
  | { status: "none" }
  | {
      status: "failed";
      actualToolCall: {
        toolName: string;
        parameters: Record<string, unknown>;
      };
    }
  | { status: "error"; error: unknown }
  | { status: "loading" };

const ToolEvaluationResult = ({
  testCase,
  tools,
}: {
  testCase: TestCase;
  tools: Tool[];
}) => {
  const [toolEvaluationResult, setToolEvaluationResult] =
    useState<ToolEvaluationResult>({ status: "loading" });
  const { model, apiKey } = useModel();

  const evaluateToolCall = useCallback(async () => {
    const anthropic = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    const response = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: testCase.userPrompt,
        },
      ],
      system: "You're an helpful assistant",
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description || "No description available",
        input_schema: tool.inputSchema,
      })),
    });

    const toolUse = response.content.find(isToolUseBlock);

    if (!toolUse) {
      setToolEvaluationResult({ status: "none" });
      return;
    }

    if (toolUse.name === testCase.expectedToolCall.toolName) {
      setToolEvaluationResult({ status: "success" });
      return;
    }

    setToolEvaluationResult({
      status: "failed",
      actualToolCall: {
        toolName: toolUse.name,
        parameters: toolUse.input as Record<string, unknown>,
      },
    });
  }, [testCase, tools, apiKey, model]);

  useEffect(() => {
    try {
      console.log("evaluating tool call", testCase.id);
      evaluateToolCall();
    } catch (e) {
      setToolEvaluationResult({ status: "error", error: e });
    }
  }, [evaluateToolCall, setToolEvaluationResult, testCase.id]);

  switch (toolEvaluationResult.status) {
    case "loading":
      return <div>Evaluating...</div>;

    case "error":
      return <div>Error: {toolEvaluationResult.error?.toString()}</div>;

    case "none":
      return <div>No tool call</div>;

    case "failed":
      return (
        <div>
          Failed: {toolEvaluationResult.actualToolCall.toolName}($
          {JSON.stringify(toolEvaluationResult.actualToolCall.parameters)})`;
        </div>
      );

    case "success":
      return <div>Success</div>;
  }
};

const ToolsEvaluation = ({ tools, ...props }: ToolsEvaluationProps) => {
  if (props.status === "error") {
    return (
      <div>
        There was an error evaluating your tool: {props.error?.toString()}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-sm font-semibold">Test Cases</h4>
      {props.result.testCases.map((testCase) => (
        <div
          key={testCase.id}
          className="bg-blue-50 rounded-lg p-4 flex flex-col gap-2"
        >
          <div>
            <div className="text-sm text-muted-foreground mb-1">Prompt</div>
            <div className="text-sm">{testCase.userPrompt}</div>
          </div>
          <hr />
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              Expected Tool Call
            </div>
            <div className="text-sm font-mono bg-background p-2 rounded">
              {`${testCase.expectedToolCall.toolName}(${JSON.stringify(testCase.expectedToolCall.parameters)})`}
            </div>
          </div>
          <hr />
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              Test Result
            </div>
            <ToolEvaluationResult testCase={testCase} tools={tools} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ToolsEvaluation;
