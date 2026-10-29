import { Handle, Position, NodeResizer } from '@xyflow/react';
import type { Attribute } from '@barker-modeler/model-core';

interface EntityNodeProps {
  data: {
    name: string;
    type: 'entity' | 'supertype' | 'subtype';
    supertype?: string;
    attributes: Attribute[];
    isExternal?: boolean;
    onAttributeClick?: (attr: Attribute) => void;
    onAddAttributeClick?: () => void;
  };
  selected?: boolean;
}

export default function CustomEntityNode({ data, selected }: EntityNodeProps) {
  const { name, type, attributes, onAttributeClick, onAddAttributeClick } = data;
  const isPhysical = (data as any).isPhysical;

  return (
    <div 
      className={`barker-entity-node ${type === 'subtype' ? 'subtype-dashed' : ''} ${selected ? 'selected' : ''}`} 
      style={{ width: '100%', height: '100%' }}
    >
      <NodeResizer 
        minWidth={150} 
        minHeight={60} 
        isVisible={selected} 
      />
      {/* Target & Source Handles for React Flow on all four sides */}
      <Handle type="target" position={Position.Top} id="top-target" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Top} id="top-source" style={{ opacity: 0 }} />
      
      <Handle type="target" position={Position.Bottom} id="bottom-target" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" style={{ opacity: 0 }} />
      
      <Handle type="target" position={Position.Left} id="left-target" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="left-source" style={{ opacity: 0 }} />
      
      <Handle type="target" position={Position.Right} id="right-target" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} id="right-source" style={{ opacity: 0 }} />

      {/* Header */}
      <div className="entity-node-header">
        <h4 className="entity-node-title">
          {data.isExternal && <span style={{ color: 'var(--warning)', fontSize: '0.65rem', marginRight: '4px' }}>[EXT]</span>}
          {isPhysical && (data as any).shortName ? `${name} (${(data as any).shortName})` : name}
        </h4>
        <span className="entity-node-type">{isPhysical ? 'TABLE' : type.toUpperCase()}</span>
      </div>

      {/* Attributes List */}
      <div className="entity-node-body">
        {attributes && attributes.length > 0 ? (
          attributes.map((attr, idx) => {
            const isPK = attr.identifier;
            const isRequired = attr.required;
            const isFK = attr.fk;

            if (isPhysical) {
              const constraintText = isPK && isFK ? 'pk, fk' : isPK ? 'pk' : isFK ? 'fk' : '';
              const nullabilityText = isRequired ? '*' : 'o';
              
              return (
                <div 
                  key={idx} 
                  className="physical-table-row"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAttributeClick?.(attr);
                  }}
                >
                  <div className="physical-col-constraint">{constraintText}</div>
                  <div className="physical-col-nullability">{nullabilityText}</div>
                  <div className="physical-col-name">{attr.name}</div>
                  <div className="physical-col-type">{attr.domain || ''}</div>
                </div>
              );
            }

            // Marker symbols: PK (#), Required (*), Optional (o)
            let marker = 'o';
            let markerClass = 'optional';
            if (isPK) {
              marker = '#';
              markerClass = 'identifier';
            } else if (isRequired) {
              marker = '*';
              markerClass = 'required';
            }

            return (
              <div 
                key={idx} 
                className="entity-node-attribute"
                onClick={(e) => {
                  e.stopPropagation();
                  onAttributeClick?.(attr);
                }}
              >
                <div className="attribute-info">
                  <span className={`attribute-marker ${markerClass}`}>{marker}</span>
                  <span className="attribute-name">{attr.name}</span>
                </div>
                {attr.domain && (
                  <span className="attribute-domain">
                    {attr.domain}
                    {isFK ? ' (FK)' : ''}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div 
            className="entity-node-attribute" 
            style={{ color: 'var(--text-muted)', fontStyle: 'italic', justifyContent: 'center' }}
            onClick={(e) => {
              e.stopPropagation();
              onAddAttributeClick?.();
            }}
          >
            + Double-click or click to add attribute
          </div>
        )}
      </div>
    </div>
  );
}
