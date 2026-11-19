import { memo, useCallback } from 'react';
import { Text } from 'react-konva';
import type Konva from 'konva';
import type { TextElement } from '../../types/template';
import { konvaFontStyle } from '../../utils/textFont';
import { elementNodeProps, elementShadowProps, type ElementNodeHandlers } from './elementNode';

interface TextRendererProps {
  textElement: TextElement;
  handlers: ElementNodeHandlers;
  onDoubleClick: (id: string) => void;
  // True while this text is being edited inline: the DOM editor stands in for
  // the canvas node.
  isEditing: boolean;
}

const TextRendererComponent = ({ textElement, handlers, onDoubleClick, isEditing }: TextRendererProps) => {
  const { id } = textElement;
  const setNode = useCallback((node: Konva.Text | null) => handlers.registerNode(id, node), [handlers, id]);
  const nodeProps = elementNodeProps(textElement, handlers);

  return (
    <Text
      ref={setNode}
      {...nodeProps}
      {...elementShadowProps(textElement)}
      visible={nodeProps.visible && !isEditing}
      text={textElement.text}
      x={textElement.x}
      y={textElement.y}
      fontSize={textElement.fontSize}
      fontFamily={textElement.fontFamily}
      letterSpacing={textElement.letterSpacing ?? 0}
      lineHeight={textElement.lineHeight ?? 1}
      align={textElement.align ?? 'left'}
      fontStyle={konvaFontStyle(textElement.fontWeight)}
      fill={textElement.fillEnabled ? textElement.fill : 'transparent'}
      stroke={textElement.strokeEnabled ? textElement.stroke : undefined}
      strokeWidth={textElement.strokeEnabled ? textElement.strokeWidth : 0}
      rotation={textElement.rotation || 0}
      opacity={textElement.opacity ?? 1}
      onDblClick={() => onDoubleClick(id)}
      onDblTap={() => onDoubleClick(id)}
    />
  );
};

export const TextRenderer = memo(TextRendererComponent);
