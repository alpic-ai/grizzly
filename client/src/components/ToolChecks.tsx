import useToolChecks from "@/lib/hooks/useToolChecks";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { XCircleIcon } from "lucide-react";

const ToolChecks = ({ tool }: { tool: Tool }) => {
  const { hasIssue, issues } = useToolChecks({ tool });

  if (!hasIssue) {
    return;
  }

  return (
    <ul className="flex flex-col gap-2">
      {issues.map((issue) => (
        <li
          key={issue.code}
          className="bg-red-50 text-red-500 flex flex-row items-center gap-2 p-2 rounded-md text-sm"
        >
          <XCircleIcon className="h-4 w-4 flex-shrink-0" />
          {issue.message}
        </li>
      ))}
    </ul>
  );
};

export default ToolChecks;
