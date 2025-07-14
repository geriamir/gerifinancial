import { useEffect, useRef, useCallback, useState } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  rootMargin?: string;
  threshold?: number;
  root?: Element | null;
}

interface UseInfiniteScrollReturn {
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  isNearBottom: boolean;
}

export const useInfiniteScroll = ({
  hasMore,
  loading,
  onLoadMore,
  rootMargin = '100px',
  threshold = 0.1,
  root = null
}: UseInfiniteScrollOptions): UseInfiniteScrollReturn => {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isNearBottom, setIsNearBottom] = useState(false);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      setIsNearBottom(entry.isIntersecting);
      
      console.log('Intersection observer triggered:', {
        isIntersecting: entry.isIntersecting,
        hasMore,
        loading,
        shouldLoadMore: entry.isIntersecting && hasMore && !loading
      });
      
      if (entry.isIntersecting && hasMore && !loading) {
        console.log('Calling onLoadMore...');
        onLoadMore();
      }
    },
    [hasMore, loading, onLoadMore]
  );

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) {
      console.log('Sentinel element not found');
      return;
    }

    console.log('Creating intersection observer with root:', root);
    const observer = new IntersectionObserver(handleObserver, {
      root,
      rootMargin,
      threshold
    });

    observer.observe(element);
    console.log('Observing sentinel element');

    return () => {
      console.log('Disconnecting intersection observer');
      observer.disconnect();
    };
  }, [handleObserver, root, rootMargin, threshold]);

  return {
    sentinelRef,
    isNearBottom
  };
};
