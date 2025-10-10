import { experienceFiltersSchema } from "@advanced-react/shared/schema/experience";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { ExperienceFilters } from "@/features/experiences/components/ExperienceFilters";
import { ExperienceList } from "@/features/experiences/components/ExperienceList";
import { InfiniteScroll } from "@/features/shared/components/InfiniteScroll";
import { trpc } from "@/router";

export const Route = createFileRoute("/search")({
  component: SearchPage,
  validateSearch: experienceFiltersSchema,
  loader: async ({ context: { trpcQueryUtils } }) => {
    await trpcQueryUtils.tags.list.ensureData();
  },
});

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const experiencesQuery = trpc.experiences.search.useInfiniteQuery(search, {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!search.q || !!search.tags || !!search.scheduledAt,
  });

  const [tags] = trpc.tags.list.useSuspenseQuery();

  return (
    <main className="space-y-4">
      <ExperienceFilters
        onFiltersChange={(filters) => {
          navigate({
            search: filters,
          });
        }}
        initialFilters={search}
        tags={tags}
      />
      <InfiniteScroll
        onLoadMore={
          !!search.q || !!search.tags || !!search.scheduledAt
            ? experiencesQuery.fetchNextPage
            : undefined
        }
      >
        <ExperienceList
          experiences={
            experiencesQuery.data?.pages.flatMap((page) => page.experiences) ??
            []
          }
          isLoading={
            experiencesQuery.isLoading || experiencesQuery.isFetchingNextPage
          }
          noExperiencesMessage={
            !!search.q ? "No experiences found" : "Search to find experiences"
          }
        />
      </InfiniteScroll>
    </main>
  );
}
