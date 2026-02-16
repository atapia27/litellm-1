import { useQueries } from "@tanstack/react-query";
import { individualModelHealthCheckCall } from "@/components/networking";
import { modelHealthCheckKeys } from "./queryKeys";

export interface ModelHealthCheckResult {
  healthy_count?: number;
  unhealthy_count?: number;
  healthy_endpoints?: unknown[];
  unhealthy_endpoints?: Array<{ error?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface PerModelQueryState {
  refetch: () => Promise<unknown>;
  isFetching: boolean;
  data: ModelHealthCheckResult | undefined;
  error: Error | null;
  isFetched: boolean;
  dataUpdatedAt: Date | null;
}

export const useModelHealthCheckQueries = (
  modelIds: string[],
  accessToken: string | null,
): Record<string, PerModelQueryState> => {
  const results = useQueries({
    queries: modelIds.map((modelId) => ({
      queryKey: modelHealthCheckKeys.detail(modelId),
      queryFn: () => individualModelHealthCheckCall(accessToken!, modelId),
      enabled: false,
    })),
  });

  const byModelId: Record<string, PerModelQueryState> = {};
  modelIds.forEach((modelId, index) => {
    const r = results[index];
    if (r) {
      byModelId[modelId] = {
        refetch: r.refetch,
        isFetching: r.isFetching,
        data: r.data as ModelHealthCheckResult | undefined,
        error: r.error as Error | null,
        isFetched: r.isFetched,
        dataUpdatedAt: r.dataUpdatedAt != null ? new Date(r.dataUpdatedAt) : null,
      };
    }
  });
  return byModelId;
};
