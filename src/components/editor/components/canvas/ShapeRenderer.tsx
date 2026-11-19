import { memo, useCallback } from 'react';
import { Rect, Line, Star, Ellipse, Path } from 'react-konva';
import type Konva from 'konva';
import type { ShapeElement } from '../../types/template';
import { elementNodeProps, elementShadowProps, type ElementNodeHandlers } from './elementNode';

interface ShapeRendererProps {
  shape: ShapeElement;
  handlers: ElementNodeHandlers;
}

const ShapeRendererComponent = ({ shape, handlers }: ShapeRendererProps) => {
  const { id } = shape;
  const setNode = useCallback((node: Konva.Node | null) => handlers.registerNode(id, node), [handlers, id]);

  // Ensure all numeric properties are valid
  const safeX = Number.isFinite(shape.x) ? shape.x : 100;
  const safeY = Number.isFinite(shape.y) ? shape.y : 100;
  const safeWidth = Number.isFinite(shape.width) ? shape.width : 200;
  const safeHeight = Number.isFinite(shape.height) ? shape.height : 150;
  const safeRotation = Number.isFinite(shape.rotation) ? shape.rotation : 0;
  const safeOpacity = Number.isFinite(shape.opacity) ? shape.opacity : 1;

  const commonProps = {
    ...elementNodeProps(shape, handlers),
    ...elementShadowProps(shape),
    fill: shape.fillEnabled ? shape.fill : undefined,
    stroke: shape.strokeEnabled ? shape.stroke : undefined,
    strokeWidth: shape.strokeEnabled ? shape.strokeWidth : 0,
    rotation: safeRotation,
    opacity: safeOpacity,
  };

  if (shape.shapeType === 'rectangle') {
    return <Rect {...commonProps} ref={setNode} x={safeX} y={safeY} width={safeWidth} height={safeHeight} />;
  }

  if (shape.shapeType === 'triangle') {
    return (
      <Line
        {...commonProps}
        ref={setNode}
        points={[safeWidth / 2, 0, safeWidth, safeHeight, 0, safeHeight]}
        x={safeX}
        y={safeY}
        closed
      />
    );
  }

  if (shape.shapeType === 'star') {
    return (
      <Star
        {...commonProps}
        ref={setNode}
        x={safeX + safeWidth / 2}
        y={safeY + safeHeight / 2}
        numPoints={5}
        innerRadius={Math.min(safeWidth, safeHeight) / 4}
        outerRadius={Math.min(safeWidth, safeHeight) / 2}
      />
    );
  }

  if (shape.shapeType === 'circle') {
    // An ellipse, so the shape fills its width x height box exactly as the
    // off-screen renderer draws it (a Konva Circle has a single radius).
    return (
      <Ellipse
        {...commonProps}
        ref={setNode}
        x={safeX + safeWidth / 2}
        y={safeY + safeHeight / 2}
        radiusX={safeWidth / 2}
        radiusY={safeHeight / 2}
      />
    );
  }

  if (shape.shapeType === 'heart') {
    const heartPath = `M ${safeWidth / 2} ${safeHeight * 0.3}
      C ${safeWidth / 2} ${safeHeight * 0.15}, ${safeWidth * 0.35} 0, ${safeWidth * 0.25} 0
      C ${safeWidth * 0.1} 0, 0 ${safeHeight * 0.15}, 0 ${safeHeight * 0.3}
      C 0 ${safeHeight * 0.55}, ${safeWidth / 2} ${safeHeight * 0.8}, ${safeWidth / 2} ${safeHeight}
      C ${safeWidth / 2} ${safeHeight * 0.8}, ${safeWidth} ${safeHeight * 0.55}, ${safeWidth} ${safeHeight * 0.3}
      C ${safeWidth} ${safeHeight * 0.15}, ${safeWidth * 0.9} 0, ${safeWidth * 0.75} 0
      C ${safeWidth * 0.65} 0, ${safeWidth / 2} ${safeHeight * 0.15}, ${safeWidth / 2} ${safeHeight * 0.3} Z`;

    return <Path {...commonProps} ref={setNode} data={heartPath} x={safeX} y={safeY} />;
  }

  return null;
};

export const ShapeRenderer = memo(ShapeRendererComponent);
