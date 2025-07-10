import type {
  PaginationParams,
  OffsetPaginationParams,
  PagePaginationParams,
  PaginatedResponse
} from '../services/api/types/verification';

export interface UsePaginationOptions {
  defaultPageSize?: number;
  defaultPage?: number;
  defaultOffset?: number;
  mode?: 'page' | 'offset';
}

export const DEFAULT_PAGE_SIZE = 20;

export const createPagination = (options: UsePaginationOptions = {}): PaginationParams => {
  const {
    defaultPageSize = DEFAULT_PAGE_SIZE,
    defaultPage = 0,
    defaultOffset = 0,
    mode = 'page'
  } = options;

  return mode === 'page'
    ? { page: defaultPage, pageSize: defaultPageSize }
    : { offset: defaultOffset, limit: defaultPageSize };
};

export const calculateTotalPages = (total: number, pageSize: number): number => {
  return Math.ceil(total / pageSize);
};

export const hasNextPage = (
  currentPage: number,
  totalPages: number
): boolean => currentPage < totalPages - 1;

export const hasPreviousPage = (currentPage: number): boolean => currentPage > 0;

export const getPageFromOffset = (
  offset: number,
  limit: number
): number => Math.floor(offset / limit);

export const getOffsetFromPage = (
  page: number,
  pageSize: number
): number => page * pageSize;

export const isOffsetPagination = (params: PaginationParams): params is OffsetPaginationParams => {
  return 'offset' in params || 'limit' in params || 'skip' in params;
};

export const isPagePagination = (params: PaginationParams): params is PagePaginationParams => {
  return 'page' in params || 'pageSize' in params;
};

export const convertToPagePagination = (
  params: OffsetPaginationParams
): PagePaginationParams => {
  const limit = params.limit || DEFAULT_PAGE_SIZE;
  const offset = params.offset || params.skip || 0;
  return {
    page: getPageFromOffset(offset, limit),
    pageSize: limit
  };
};

export const convertToOffsetPagination = (
  params: PagePaginationParams
): OffsetPaginationParams => {
  const pageSize = params.pageSize || DEFAULT_PAGE_SIZE;
  const page = params.page || 0;
  return {
    offset: getOffsetFromPage(page, pageSize),
    limit: pageSize
  };
};

export const createEmptyPaginatedResponse = <T>(): PaginatedResponse<T> => ({
  items: [],
  total: 0,
  hasMore: false
});

export const isPaginationComplete = <T>(
  response: PaginatedResponse<T>,
  params: PaginationParams
): boolean => {
  if (isPagePagination(params)) {
    const totalPages = calculateTotalPages(
      response.total,
      params.pageSize || DEFAULT_PAGE_SIZE
    );
    return (params.page || 0) >= totalPages - 1;
  }

  const offset = isOffsetPagination(params)
    ? params.offset || params.skip || 0
    : 0;
  const limit = isOffsetPagination(params)
    ? params.limit || DEFAULT_PAGE_SIZE
    : DEFAULT_PAGE_SIZE;

  return offset + limit >= response.total;
};

export const getNextPageParams = (
  params: PaginationParams,
  total: number
): PaginationParams => {
  if (isPagePagination(params)) {
    const currentPage = params.page || 0;
    const pageSize = params.pageSize || DEFAULT_PAGE_SIZE;
    const totalPages = calculateTotalPages(total, pageSize);

    return hasNextPage(currentPage, totalPages)
      ? { ...params, page: currentPage + 1 }
      : params;
  }

  const offset = isOffsetPagination(params)
    ? params.offset || params.skip || 0
    : 0;
  const limit = isOffsetPagination(params)
    ? params.limit || DEFAULT_PAGE_SIZE
    : DEFAULT_PAGE_SIZE;

  return offset + limit < total
    ? { ...params, offset: offset + limit }
    : params;
};
