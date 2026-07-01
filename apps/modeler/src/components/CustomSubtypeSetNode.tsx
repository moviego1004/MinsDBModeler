interface SubtypeSetNodeProps {
  data: {
    label: string;
  };
}

export default function CustomSubtypeSetNode({ data }: SubtypeSetNodeProps) {
  return (
    <div 
      className="barker-subtype-set-node" 
      style={{ 
        width: '100%', 
        height: '100%', 
        border: '1.5px dashed var(--warning)', 
        borderRadius: '8px', 
        backgroundColor: 'rgba(254, 249, 195, 0.25)', 
        position: 'relative',
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="subtype-set-label"
        style={{
          position: 'absolute',
          top: '6px',
          left: '10px',
          fontSize: '0.7rem',
          fontWeight: 'bold',
          color: 'var(--warning)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}
      >
        {data.label}
      </div>
    </div>
  );
}
