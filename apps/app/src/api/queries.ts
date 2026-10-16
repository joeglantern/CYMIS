import type { AuditStatus, Bucket, ScanResult } from '@cymis/schemas';
import { QueryClient, keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { endpoints } from './endpoints';
import { ApiError } from './http';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      // No point retrying when there is no signal or the answer is a clear no.
      retry: (count, err) => {
        if (err instanceof ApiError && (err.offline || (err.status >= 400 && err.status < 500))) return false;
        return count < 2;
      },
    },
    mutations: { retry: false },
  },
});

export const keys = {
  audits: (filter?: object) => ['audits', filter ?? {}] as const,
  audit: (id: string) => ['audit', id] as const,
  progress: (id: string) => ['progress', id] as const,
  scans: (auditId: string, filter?: object) => (filter ? (['scans', auditId, filter] as const) : (['scans', auditId] as const)),
  results: (auditId: string, bucket: Bucket) => ['results', auditId, bucket] as const,
  review: () => ['review'] as const,
  imports: (auditId: string) => ['imports', auditId] as const,
  importById: (id: string) => ['import', id] as const,
  reports: (auditId: string) => ['reports', auditId] as const,
  facilities: () => ['facilities'] as const,
  users: (filter?: object) => ['users', filter ?? {}] as const,
  journey: (n: string) => ['journey', n] as const,
  mappings: () => ['mappings'] as const,
  activity: (filter?: object) => ['activity', filter ?? {}] as const,
  serviceAccounts: () => ['service-accounts'] as const,
};

export function useAudits(filter: { status?: AuditStatus; mine?: boolean } = {}) {
  return useQuery({ queryKey: keys.audits(filter), queryFn: () => endpoints.audits({ ...filter, limit: 100 }) });
}

export function useAudit(id: string | undefined) {
  return useQuery({ queryKey: keys.audit(id ?? ''), queryFn: () => endpoints.audit(id!), enabled: !!id });
}

export function useProgress(id: string | undefined) {
  return useQuery({
    queryKey: keys.progress(id ?? ''),
    queryFn: () => endpoints.progress(id!),
    enabled: !!id,
    // Sockets keep this fresh. The poll is a safety net if the socket drops.
    refetchInterval: 30_000,
  });
}

export function useScans(
  auditId: string | undefined,
  filter: { result?: ScanResult; flagged?: boolean; reviewStatus?: string; q?: string } = {},
) {
  return useInfiniteQuery({
    queryKey: keys.scans(auditId ?? '', filter),
    queryFn: ({ pageParam }) => endpoints.scans(auditId!, { ...filter, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!auditId,
    placeholderData: keepPreviousData,
  });
}

export function useResults(auditId: string | undefined, bucket: Bucket) {
  return useInfiniteQuery({
    queryKey: keys.results(auditId ?? '', bucket),
    queryFn: ({ pageParam }) => endpoints.results(auditId!, bucket, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!auditId,
  });
}

export function useFacilities() {
  return useQuery({ queryKey: keys.facilities(), queryFn: endpoints.facilities, staleTime: 5 * 60_000 });
}

export function useUsers(filter: { q?: string; role?: 'ADMIN' | 'SUPERVISOR' | 'AUDITOR'; active?: boolean } = {}) {
  return useQuery({
    queryKey: keys.users(filter),
    queryFn: () => endpoints.users({ ...filter, limit: 200 }),
    placeholderData: keepPreviousData,
  });
}

export function useJourney(number: string | undefined) {
  return useQuery({ queryKey: keys.journey(number ?? ''), queryFn: () => endpoints.journey(number!), enabled: !!number && number.length >= 4 });
}

export function useReports(auditId: string | undefined) {
  return useQuery({
    queryKey: keys.reports(auditId ?? ''),
    queryFn: () => endpoints.auditReports(auditId!),
    enabled: !!auditId,
    // Poll while a report is being made. The socket also tells us when it is ready.
    refetchInterval: (q) => (q.state.data?.some((r) => r.status === 'QUEUED' || r.status === 'RUNNING') ? 3000 : false),
  });
}
