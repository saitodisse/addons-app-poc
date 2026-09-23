import { memo } from 'react';

/**
 * Leaf that inserts the HTML an add-on published.
 *
 * It is memoized on the HTML string alone. The page around it re-renders on
 * every step of a dragged control, and a rendered view is thousands of nodes:
 * without the memo React would drop the whole subtree and parse it again on
 * each of those steps, which is where the lag of a dragged slider came from.
 * With it, the HTML reaches the document only when the add-on publishes a
 * different view.
 */
export const RenderedHtmlView = memo(function RenderedHtmlView({ html }: { html: string }) {
  return <div className="host-tab-view" dangerouslySetInnerHTML={{ __html: html }} />;
});