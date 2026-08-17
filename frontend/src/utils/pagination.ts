type ApiResponseLike = {
    data?: unknown;
    headers?: unknown;
};

const toNonNegativeInteger = (value: unknown): number | null => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

export const readApiTotal = (response: ApiResponseLike): number | null => {
    const responseData = response.data as { total?: unknown } | null | undefined;
    const bodyTotal = toNonNegativeInteger(responseData?.total);
    if (bodyTotal !== null) return bodyTotal;

    const headers = response.headers as
        | { get?: (name: string) => unknown; [key: string]: unknown }
        | null
        | undefined;
    const headerValue = headers?.get?.('x-total-count') ?? headers?.['x-total-count'];
    return toNonNegativeInteger(headerValue);
};

export const hasNextApiPage = (
    response: ApiResponseLike,
    nextOffset: number,
    fetchedCount: number,
    pageSize: number,
): boolean => {
    const total = readApiTotal(response);
    return total === null ? fetchedCount === pageSize : nextOffset < total;
};
