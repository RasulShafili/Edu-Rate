"use client";

import { useCallback, useRef } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import type {
  AdminClub,
  AdminClubCreateInput,
  AdminClubQuery,
  AdminClubUpdateInput,
  AdminCollectionKind,
  AdminCollectionRecord,
  AdminEvent,
  AdminEventCreateInput,
  AdminEventQuery,
  AdminEventUpdateInput,
  AdminListQuery,
  AdminOverview,
  AdminPage,
  AdminUser,
  AdminUserCreateInput,
  AdminUserQuery,
  AdminUserUpdateInput,
} from "../data/admin";
import { adminRoleLabels } from "../data/admin";
import { ApiError } from "../lib/api/client";
import { adminService } from "../services/admin.service";

export type AdminResourceState<T> = {
  data: T | undefined;
  error: ApiError | undefined;
  isLoading: boolean;
  isValidating: boolean;
  refetch: () => Promise<T | undefined>;
};

export type AdminMutationState<TRecord, TCreate, TUpdate> = {
  create: (input: TCreate) => Promise<TRecord>;
  update: (id: string, input: TUpdate) => Promise<TRecord>;
  remove: (id: string) => Promise<void>;
  error: ApiError | undefined;
  isMutating: boolean;
  resetError: () => void;
};

const overviewKey = ["admin", "overview"] as const;

export const adminCacheKeys = {
  overview: overviewKey,
  users: (query: Required<Pick<AdminUserQuery, "page" | "pageSize">> & AdminUserQuery) =>
    [
      "admin",
      "users",
      query.search ?? "",
      query.status ?? "all",
      query.role ?? "all",
      query.page,
      query.pageSize,
    ] as const,
  clubs: (query: Required<Pick<AdminClubQuery, "page" | "pageSize">> & AdminClubQuery) =>
    [
      "admin",
      "clubs",
      query.search ?? "",
      query.status ?? "all",
      query.category ?? "all",
      query.page,
      query.pageSize,
    ] as const,
  events: (query: Required<Pick<AdminEventQuery, "page" | "pageSize">> & AdminEventQuery) =>
    [
      "admin",
      "events",
      query.search ?? "",
      query.status ?? "all",
      query.category ?? "all",
      query.from ?? "",
      query.to ?? "",
      query.page,
      query.pageSize,
    ] as const,
};

export function useAdminOverview(): AdminResourceState<AdminOverview> {
  const loader = useCallback(
    (signal: AbortSignal) => adminService.getOverview({ signal }),
    [],
  );

  return useAdminResource(overviewKey, loader, false);
}

export function useAdminUsers(
  query: AdminUserQuery = {},
): AdminResourceState<AdminPage<AdminUser>> {
  const search = query.search?.trim() || undefined;
  const status = query.status ?? "all";
  const role = query.role ?? "all";
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const key = adminCacheKeys.users({ search, status, role, page, pageSize });
  const loader = useCallback(
    (signal: AbortSignal) =>
      adminService.getUsers(
        { search, status, role, page, pageSize },
        { signal },
      ),
    [page, pageSize, role, search, status],
  );

  return useAdminResource(key, loader, true);
}

export function useAdminClubs(
  query: AdminClubQuery = {},
): AdminResourceState<AdminPage<AdminClub>> {
  const search = query.search?.trim() || undefined;
  const status = query.status ?? "all";
  const category = query.category || undefined;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const key = adminCacheKeys.clubs({
    search,
    status,
    category,
    page,
    pageSize,
  });
  const loader = useCallback(
    (signal: AbortSignal) =>
      adminService.getClubs(
        { search, status, category, page, pageSize },
        { signal },
      ),
    [category, page, pageSize, search, status],
  );

  return useAdminResource(key, loader, true);
}

export function useAdminEvents(
  query: AdminEventQuery = {},
): AdminResourceState<AdminPage<AdminEvent>> {
  const search = query.search?.trim() || undefined;
  const status = query.status ?? "all";
  const category = query.category || undefined;
  const from = query.from || undefined;
  const to = query.to || undefined;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const key = adminCacheKeys.events({
    search,
    status,
    category,
    from,
    to,
    page,
    pageSize,
  });
  const loader = useCallback(
    (signal: AbortSignal) =>
      adminService.getEvents(
        { search, status, category, from, to, page, pageSize },
        { signal },
      ),
    [category, from, page, pageSize, search, status, to],
  );

  return useAdminResource(key, loader, true);
}

export function useAdminUserMutations(
  query: AdminUserQuery = {},
): AdminMutationState<AdminUser, AdminUserCreateInput, AdminUserUpdateInput> {
  const normalizedQuery = normalizeUserQuery(query);
  const key = adminCacheKeys.users(normalizedQuery);

  return useAdminCollectionMutations(
    "users",
    key,
    {
      create: (input) => adminService.createUser(input),
      update: (id, input) => adminService.updateUser(id, input),
      remove: (id) => adminService.deleteUser(id),
      optimisticCreate: createOptimisticUser,
      optimisticUpdate: updateOptimisticUser,
    },
    canPrependOptimisticRecord(normalizedQuery),
    { page: normalizedQuery.page, pageSize: normalizedQuery.pageSize },
  );
}

export function useAdminClubMutations(
  query: AdminClubQuery = {},
): AdminMutationState<AdminClub, AdminClubCreateInput, AdminClubUpdateInput> {
  const normalizedQuery = normalizeClubQuery(query);
  const key = adminCacheKeys.clubs(normalizedQuery);

  return useAdminCollectionMutations(
    "clubs",
    key,
    {
      create: (input) => adminService.createClub(input),
      update: (id, input) => adminService.updateClub(id, input),
      remove: (id) => adminService.deleteClub(id),
      optimisticCreate: createOptimisticClub,
      optimisticUpdate: updateOptimisticClub,
    },
    canPrependOptimisticRecord(normalizedQuery),
    { page: normalizedQuery.page, pageSize: normalizedQuery.pageSize },
  );
}

export function useAdminEventMutations(
  query: AdminEventQuery = {},
): AdminMutationState<AdminEvent, AdminEventCreateInput, AdminEventUpdateInput> {
  const normalizedQuery = normalizeEventQuery(query);
  const key = adminCacheKeys.events(normalizedQuery);

  return useAdminCollectionMutations(
    "events",
    key,
    {
      create: (input) => adminService.createEvent(input),
      update: (id, input) => adminService.updateEvent(id, input),
      remove: (id) => adminService.deleteEvent(id),
      optimisticCreate: createOptimisticEvent,
      optimisticUpdate: updateOptimisticEvent,
    },
    canPrependOptimisticRecord(normalizedQuery),
    { page: normalizedQuery.page, pageSize: normalizedQuery.pageSize },
  );
}

export function useAdminCollection(
  kind: AdminCollectionKind,
  query: AdminListQuery = {},
): AdminResourceState<AdminPage<AdminCollectionRecord>> {
  const search = query.search?.trim() || undefined;
  const status = query.status ?? "all";
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 10;
  const key = ["admin", "collection", kind, search ?? "", status, page, pageSize] as const;
  const loader = useCallback(
    async (signal: AbortSignal): Promise<AdminPage<AdminCollectionRecord>> => {
      const normalizedQuery = { search, status, page, pageSize };
      if (kind === "users") {
        return adminService.getUsers(normalizedQuery, { signal });
      }
      if (kind === "clubs") {
        return adminService.getClubs(normalizedQuery, { signal });
      }
      return adminService.getEvents(normalizedQuery, { signal });
    },
    [kind, page, pageSize, search, status],
  );

  return useAdminResource(key, loader, true);
}

function useAdminResource<T>(
  key: readonly unknown[],
  loader: (signal: AbortSignal) => Promise<T>,
  keepPreviousData: boolean,
): AdminResourceState<T> {
  const controllerRef = useRef<AbortController | null>(null);
  const fetcher = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    try {
      return await loader(controller.signal);
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
    }
  }, [loader]);

  // Unmount-da sorğunu ləğv ETMİRİK: SWR eyni açar üçün 5 saniyə eyni vədi təkrar istifadə
  // edir. Əvvəl komponent yenidən mount olanda (marşrut keçidi, React dev rejimi) ləğv
  // olunmuş vəd paylaşılır, cədvəl "Məlumat alınmadı" göstərirdi. Yalnız yeni sorğu köhnəsini
  // əvəz edəndə ləğv edirik (fetcher-in başında).
  const { data, error, isLoading, isValidating, mutate } = useSWR<T, unknown>(
    key,
    fetcher,
    {
      keepPreviousData,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5_000,
      errorRetryCount: 2,
      errorRetryInterval: 1_200,
      shouldRetryOnError: isRetryableError,
    },
  );
  const refetch = useCallback(() => mutate(), [mutate]);

  return {
    data,
    error: error ? normalizeApiError(error) : undefined,
    isLoading,
    isValidating,
    refetch,
  };
}

type AdminMutationAdapter<TRecord, TCreate, TUpdate> = {
  create: (input: TCreate) => Promise<TRecord>;
  update: (id: string, input: TUpdate) => Promise<TRecord>;
  remove: (id: string) => Promise<void>;
  optimisticCreate: (input: TCreate) => TRecord;
  optimisticUpdate: (record: TRecord, input: TUpdate) => TRecord;
};

function useAdminCollectionMutations<
  TRecord extends AdminCollectionRecord,
  TCreate extends object,
  TUpdate extends object,
>(
  kind: AdminCollectionKind,
  listKey: readonly unknown[],
  adapter: AdminMutationAdapter<TRecord, TCreate, TUpdate>,
  canOptimisticallyCreate: boolean,
  pageMeta: Pick<AdminPage<TRecord>, "page" | "pageSize">,
): AdminMutationState<TRecord, TCreate, TUpdate> {
  const { mutate } = useSWRConfig();
  const createMutation = useSWRMutation<
    TRecord,
    unknown,
    readonly unknown[],
    TCreate
  >(["admin-mutation", kind, "create"], (_key, { arg }) => adapter.create(arg));
  const triggerCreate = createMutation.trigger as (
    input: TCreate,
    options: { throwOnError: true },
  ) => Promise<TRecord>;
  const updateMutation = useSWRMutation<
    TRecord,
    unknown,
    readonly unknown[],
    { id: string; input: TUpdate }
  >(["admin-mutation", kind, "update"], (_key, { arg }) =>
    adapter.update(arg.id, arg.input),
  );
  const deleteMutation = useSWRMutation<
    void,
    unknown,
    readonly unknown[],
    string
  >(["admin-mutation", kind, "delete"], (_key, { arg }) => adapter.remove(arg));

  const resetError = useCallback(() => {
    createMutation.reset();
    updateMutation.reset();
    deleteMutation.reset();
  }, [createMutation, deleteMutation, updateMutation]);

  const revalidateAdminData = useCallback(
    async () => {
      await Promise.allSettled([
        mutate((cacheKey) => isAdminCollectionCacheKey(cacheKey, kind)),
        mutate(adminCacheKeys.overview),
      ]);
    },
    [kind, mutate],
  );

  const create = useCallback(
    async (input: TCreate): Promise<TRecord> => {
      resetError();
      const optimisticRecord = adapter.optimisticCreate(input);
      const emptyPage: AdminPage<TRecord> = {
        items: [],
        total: 0,
        page: pageMeta.page,
        pageSize: pageMeta.pageSize,
      };
      let createdRecord: TRecord | undefined;

      await mutate<AdminPage<TRecord>>(
        listKey,
        async (current) => {
          const result = await triggerCreate(input, { throwOnError: true });
          createdRecord = result;
          const page = current ?? emptyPage;
          if (!canOptimisticallyCreate) return page;
          const includedOptimisticRecord = page.items.some(
            (item) => item.id === optimisticRecord.id,
          );
          return {
            ...page,
            items: [
              result,
              ...page.items.filter(
                (item) => item.id !== result.id && item.id !== optimisticRecord.id,
              ),
            ].slice(0, page.pageSize),
            total: includedOptimisticRecord ? page.total : page.total + 1,
          };
        },
        {
          optimisticData: (current) => {
            const page = current ?? emptyPage;
            return canOptimisticallyCreate
              ? {
                  ...page,
                  items: [optimisticRecord, ...page.items].slice(0, page.pageSize),
                  total: page.total + 1,
                }
              : page;
          },
          populateCache: true,
          revalidate: false,
          rollbackOnError: true,
        },
      );

      await revalidateAdminData();
      if (!createdRecord) {
        throw new ApiError("Yeni qeyd yaradıla bilmədi.", {
          code: "ADMIN_CREATE_EMPTY_RESPONSE",
        });
      }
      return createdRecord;
    },
    [
      adapter,
      canOptimisticallyCreate,
      listKey,
      mutate,
      pageMeta,
      resetError,
      revalidateAdminData,
      triggerCreate,
    ],
  );

  const update = useCallback(
    async (id: string, input: TUpdate): Promise<TRecord> => {
      resetError();
      const emptyPage: AdminPage<TRecord> = {
        items: [],
        total: 0,
        page: pageMeta.page,
        pageSize: pageMeta.pageSize,
      };
      let updatedRecord: TRecord | undefined;

      await mutate<AdminPage<TRecord>>(
        listKey,
        async (current) => {
          const result = await updateMutation.trigger(
            { id, input },
            { throwOnError: true },
          );
          updatedRecord = result;
          const page = current ?? emptyPage;
          return {
            ...page,
            items: page.items.map((item) =>
              item.id === id ? result : item,
            ),
          };
        },
        {
          optimisticData: (current) => {
            const page = current ?? emptyPage;
            return {
                  ...page,
                  items: page.items.map((item) =>
                    item.id === id ? adapter.optimisticUpdate(item, input) : item,
                  ),
                };
          },
          populateCache: true,
          revalidate: false,
          rollbackOnError: true,
        },
      );

      await revalidateAdminData();
      if (!updatedRecord) {
        throw new ApiError("Qeyd yenilənə bilmədi.", {
          code: "ADMIN_UPDATE_EMPTY_RESPONSE",
        });
      }
      return updatedRecord;
    },
    [adapter, listKey, mutate, pageMeta, resetError, revalidateAdminData, updateMutation],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      resetError();
      const emptyPage: AdminPage<TRecord> = {
        items: [],
        total: 0,
        page: pageMeta.page,
        pageSize: pageMeta.pageSize,
      };

      await mutate<AdminPage<TRecord>>(
        listKey,
        async (current) => {
          await deleteMutation.trigger(id, { throwOnError: true });
          const page = current ?? emptyPage;
          const includedRecord = page.items.some((item) => item.id === id);
          return {
            ...page,
            items: page.items.filter((item) => item.id !== id),
            total: includedRecord ? Math.max(0, page.total - 1) : page.total,
          };
        },
        {
          optimisticData: (current) => {
            const page = current ?? emptyPage;
            return {
              ...page,
              items: page.items.filter((item) => item.id !== id),
              total: Math.max(0, page.total - 1),
            };
          },
          populateCache: true,
          revalidate: false,
          rollbackOnError: true,
        },
      );

      await revalidateAdminData();
    },
    [deleteMutation, listKey, mutate, pageMeta, resetError, revalidateAdminData],
  );

  const rawError = createMutation.error ?? updateMutation.error ?? deleteMutation.error;

  return {
    create,
    update,
    remove,
    error: rawError ? normalizeApiError(rawError) : undefined,
    isMutating:
      createMutation.isMutating || updateMutation.isMutating || deleteMutation.isMutating,
    resetError,
  };
}

function normalizeUserQuery(
  query: AdminUserQuery,
): Required<Pick<AdminUserQuery, "page" | "pageSize">> & AdminUserQuery {
  return {
    search: query.search?.trim() || undefined,
    status: query.status ?? "all",
    role: query.role ?? "all",
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  };
}

function normalizeClubQuery(
  query: AdminClubQuery,
): Required<Pick<AdminClubQuery, "page" | "pageSize">> & AdminClubQuery {
  return {
    search: query.search?.trim() || undefined,
    status: query.status ?? "all",
    category: query.category || undefined,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  };
}

function normalizeEventQuery(
  query: AdminEventQuery,
): Required<Pick<AdminEventQuery, "page" | "pageSize">> & AdminEventQuery {
  return {
    search: query.search?.trim() || undefined,
    status: query.status ?? "all",
    category: query.category || undefined,
    from: query.from || undefined,
    to: query.to || undefined,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 10,
  };
}

function canPrependOptimisticRecord(query: AdminListQuery): boolean {
  return (
    query.page === 1 &&
    !query.search &&
    (!query.status || query.status === "all")
  );
}

function isAdminCollectionCacheKey(
  cacheKey: unknown,
  kind: AdminCollectionKind,
): boolean {
  return Array.isArray(cacheKey) && cacheKey[0] === "admin" && cacheKey[1] === kind;
}

function createOptimisticUser(input: AdminUserCreateInput): AdminUser {
  const now = new Date().toISOString();
  return {
    kind: "users",
    id: createOptimisticId("usr"),
    ...input,
    initials: createInitials(input.name),
    connectionCount: 0,
    joinedAt: now,
    lastActiveAt: now,
    detail: `${adminRoleLabels[input.role]} · ${input.faculty}`,
    status: input.status ?? "Gözləmədə",
    metric: "0 əlaqə",
    updatedAt: now,
  };
}

function updateOptimisticUser(
  record: AdminUser,
  input: AdminUserUpdateInput,
): AdminUser {
  const next = { ...record, ...input, updatedAt: new Date().toISOString() };
  return {
    ...next,
    initials: createInitials(next.name),
    detail: `${adminRoleLabels[next.role]} · ${next.faculty}`,
  };
}

function createOptimisticClub(input: AdminClubCreateInput): AdminClub {
  const now = new Date().toISOString();
  return {
    kind: "clubs",
    id: createOptimisticId("club"),
    ...input,
    memberCount: 0,
    eventCount: 0,
    createdAt: now,
    detail: `${input.category} · ${input.coordinatorInitials} tərəfindən idarə olunur`,
    status: input.status ?? "Gözləmədə",
    metric: "0 üzv",
    updatedAt: now,
  };
}

function updateOptimisticClub(
  record: AdminClub,
  input: AdminClubUpdateInput,
): AdminClub {
  const next = { ...record, ...input, updatedAt: new Date().toISOString() };
  return {
    ...next,
    detail: `${next.category} · ${next.coordinatorInitials} tərəfindən idarə olunur`,
  };
}

function createOptimisticEvent(input: AdminEventCreateInput): AdminEvent {
  return {
    kind: "events",
    id: createOptimisticId("event"),
    ...input,
    attendeeCount: 0,
    detail: formatEventDetail(input.startAt, input.place),
    status: input.status ?? "Qaralama",
    metric: `${input.capacity} yer`,
    updatedAt: new Date().toISOString(),
  };
}

function updateOptimisticEvent(
  record: AdminEvent,
  input: AdminEventUpdateInput,
): AdminEvent {
  const next = { ...record, ...input, updatedAt: new Date().toISOString() };
  return {
    ...next,
    detail: formatEventDetail(next.startAt, next.place),
    metric: `${next.attendeeCount} / ${next.capacity} yer`,
  };
}

function createOptimisticId(prefix: string): string {
  return `${prefix}-optimistic-${Date.now().toString(36)}`;
}

function createInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("az") ?? "")
    .join("");
}

function formatEventDetail(startAt: string, place: string): string {
  const date = new Date(startAt);
  const formatted = Number.isNaN(date.getTime())
    ? startAt
    : new Intl.DateTimeFormat("az-AZ", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Baku",
      }).format(date);
  return `${formatted} · ${place}`;
}

function isRetryableError(error: unknown): boolean {
  // Ləğv olunmuş (əvəzlənmiş) sorğu xəta deyil — təkrar cəhd edilir.
  if (isAbortError(error)) return true;
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}

function normalizeApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (isAbortError(error)) {
    return new ApiError("Sorğu dayandırıldı.", { code: "REQUEST_ABORTED" });
  }
  return new ApiError("Məlumatları yükləmək mümkün olmadı.", {
    code: "UNKNOWN_API_ERROR",
    cause: error,
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
