import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { latestHealthChecksCall } from "@/components/networking";
import { latestModelHealthChecksKeys } from "./queryKeys";

export interface LatestHealthChecksResponse {
  latest_health_checks?: Record<
    string,
    {
      status?: string;
      checked_at?: string;
      error_message?: string | null;
      [key: string]: unknown;
    }
  >;
}

export const useLatestModelHealthChecks = (
  accessToken: string | null,
): UseQueryResult<LatestHealthChecksResponse> => {
  return useQuery<LatestHealthChecksResponse>({
    queryKey: [...latestModelHealthChecksKeys.lists(), accessToken],
    queryFn: () => latestHealthChecksCall(accessToken!),
    enabled: !!accessToken,
  });
};
