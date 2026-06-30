
interface GroupNodeProps {
  data: {
    label: string;
  };
}

export default function CustomGroupNode({ data }: GroupNodeProps) {
  return (
    <div className="barker-group-node">
      <div className="group-node-header">{data.label}</div>
    </div>
  );
}
