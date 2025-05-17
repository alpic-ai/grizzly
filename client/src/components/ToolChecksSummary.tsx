import useToolChecks from "@/lib/hooks/useToolChecks";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { CheckIcon, XIcon } from "lucide-react";

const ToolChecksSummary = ({ tool }: { tool: Tool }) => {
  const { hasIssue, checksQuantity } = useToolChecks({ tool });

  return (
    <div className="flex flex-row gap-3 items-start text-sm">
      <div className="flex flex-row items-center gap-1 text-green-500">
        <CheckIcon className="w-4 h-4" />
        <span>{hasIssue ? checksQuantity.successfull : "All"}</span>
      </div>
      {hasIssue && (
        <div className="flex flex-row items-center gap-1 text-red-500">
          <XIcon className="w-4 h-4" />
          <span>{checksQuantity.failed}</span>
        </div>
      )}
    </div>
  );
};

export default ToolChecksSummary;
