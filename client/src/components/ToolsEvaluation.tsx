import { Tool } from "@modelcontextprotocol/sdk/types.js";

import useModel from "@/lib/hooks/useModel";
import { Anthropic } from "@anthropic-ai/sdk";
import { useCallback, useEffect, useState } from "react";
import { ToolUseBlock } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import { ContentBlock } from "@anthropic-ai/sdk/resources/messages/messages.mjs";
import {
  ChevronRight,
  ChevronDown,
  XCircleIcon,
  Loader2,
  CheckCircleIcon,
} from "lucide-react";

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

type ToolEvaluationResultProps =
  | {
      status: "success";
      actualToolCall: {
        toolName: string;
        parameters: Record<string, unknown>;
      };
    }
  | {
      status: "failed";
      actualToolCall: {
        toolName: string;
        parameters: Record<string, unknown>;
      };
    }
  | { status: "none"; actualModelResponse: string }
  | { status: "error"; error: unknown }
  | { status: "loading" };

const ToolEvaluationResult = (
  toolEvaluationResult: ToolEvaluationResultProps,
) => {
  switch (toolEvaluationResult.status) {
    case "loading":
      return (
        <div className="bg-blue-50 text-sm text-blue-500 p-2 rounded-md flex flex-row gap-1 items-center">
          <Loader2 className="w-4 h-4 animate-spin" />
          Evaluating...
        </div>
      );

    case "error":
      return (
        <div className="bg-red-50 text-sm text-red-500 p-2 rounded-md flex flex-row gap-1 items-center">
          <XCircleIcon className="w-4 h-4" />
          Error: {toolEvaluationResult.error?.toString()}
        </div>
      );

    case "none":
      return (
        <div className="bg-red-50 text-sm text-red-500 p-2 rounded-md flex flex-row gap-1 items-center">
          <XCircleIcon className="w-4 h-4" />
          Failed: No tool call
        </div>
      );

    case "failed":
      return (
        <div className="bg-red-50 text-sm text-red-500 p-2 rounded-md flex flex-row gap-1 items-center">
          <XCircleIcon className="w-4 h-4" />
          Failed: {toolEvaluationResult.actualToolCall.toolName}($
          {JSON.stringify(toolEvaluationResult.actualToolCall.parameters)})`;
        </div>
      );

    case "success":
      return (
        <div className="bg-green-50 text-sm text-green-500 p-2 rounded-md flex flex-row gap-1 items-center">
          <CheckCircleIcon className="w-4 h-4" />
          Success
        </div>
      );
  }
};

const ToolEvaluation = ({
  testCase,
  tools,
}: {
  testCase: TestCase;
  tools: Tool[];
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [toolEvaluationResult, setToolEvaluationResult] =
    useState<ToolEvaluationResultProps>({ status: "loading" });
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
      setToolEvaluationResult({
        status: "none",
        actualModelResponse:
          response.content.find((block) => block.type === "text")?.text ??
          "No model response",
      });
      return;
    }

    if (toolUse.name === testCase.expectedToolCall.toolName) {
      setToolEvaluationResult({
        status: "success",
        actualToolCall: {
          toolName: toolUse.name,
          parameters: toolUse.input as Record<string, unknown>,
        },
      });
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
      evaluateToolCall();
    } catch (e) {
      setToolEvaluationResult({ status: "error", error: e });
    }
  }, [evaluateToolCall, setToolEvaluationResult, testCase.id]);

  if (!isExpanded) {
    return (
      <div className="rounded-lg p-4 flex flex-row gap-2 items-center border border-gray-100">
        <ChevronRight
          className="w-4 h-4 cursor-pointer flex-shrink-0"
          onClick={() => setIsExpanded(true)}
        />
        <span className="bg-gray-50 text-sm text-gray-500 p-2 rounded-md w-fit">
          {testCase.id}
        </span>
        <ToolEvaluationResult {...toolEvaluationResult} />
      </div>
    );
  }

  return (
    <div
      key={testCase.id}
      className="rounded-lg p-4 flex flex-row gap-2 border border-gray-100"
    >
      <ChevronDown
        className="w-4 h-4 mt-2 cursor-pointer flex-shrink-0"
        onClick={() => setIsExpanded(false)}
      />
      <div
        key={testCase.id}
        className="flex flex-col gap-2"
        onClick={() => setIsExpanded(false)}
      >
        <div className="flex flex-row gap-2 items-center">
          <span className="bg-gray-50 text-sm text-gray-500 p-2 rounded-md w-fit">
            {testCase.id}
          </span>
          <ToolEvaluationResult {...toolEvaluationResult} />
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-1">Prompt</div>
          <div className="text-sm">{testCase.userPrompt}</div>
        </div>
        <hr />
        <div>
          <div className="text-sm text-muted-foreground mb-1">
            Expected Tool Call
          </div>
          <div className="text-sm font-mono">
            {`${testCase.expectedToolCall.toolName}(${JSON.stringify(testCase.expectedToolCall.parameters)})`}
          </div>
        </div>
        {(toolEvaluationResult.status === "failed" ||
          toolEvaluationResult.status === "success" ||
          toolEvaluationResult.status === "none") && <hr />}
        {toolEvaluationResult.status === "none" && (
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              Actual Model Response
            </div>
            <div className="text-sm font-mono">
              {toolEvaluationResult.actualModelResponse}
            </div>
          </div>
        )}
        {(toolEvaluationResult.status === "failed" ||
          toolEvaluationResult.status === "success") && (
          <div>
            <div className="text-sm text-muted-foreground mb-1">
              Actual Tool Call
            </div>
            <div className="text-sm font-mono">
              {`${toolEvaluationResult.actualToolCall.toolName}(${JSON.stringify(toolEvaluationResult.actualToolCall.parameters)})`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
      <h4 className="text-sm font-semibold">
        {props.result.testCases.length} Test Cases
      </h4>
      {props.result.testCases.map((testCase) => (
        <ToolEvaluation key={testCase.id} testCase={testCase} tools={tools} />
      ))}
    </div>
  );
};

export default ToolsEvaluation;
