declare module 'json-highlighter' {
  import type { CSSProperties, ReactNode } from 'react';

  interface JsonHighlighterProps {
    json: unknown;
    space?: number;
    paths?: Array<string | Array<string | number>>;
    highlightStyle?: CSSProperties;
    highlightTag?: ReactNode;
  }

  export function JsonHighlighter(props: JsonHighlighterProps): ReactNode;
}
