export type ToolsEvaluationProps =
  | {
      status: "success";
      result: string;
    }
  | { status: "error"; error: unknown };

const ToolsEvaluation = (props: ToolsEvaluationProps) => {
  if (props.status === "error") {
    return (
      <div>
        There was an error evaluating your tool: {props.error?.toString()}
      </div>
    );
  }

  return <div>{props.result}</div>;
};

export default ToolsEvaluation;
