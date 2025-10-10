import { Experience, User } from "@advanced-react/server/database/schema";
import { useParams, useSearch } from "@tanstack/react-router";

import { useCurrentUser } from "@/features/auth/hooks/useCurrentUser";
import { useToast } from "@/features/shared/hooks/useToast";
import { trpc } from "@/router";

type ExperienceMutationsOptions = {
  edit?: {
    onSuccess?: (id: Experience["id"]) => void;
  };
  delete?: {
    onSuccess?: (id: Experience["id"]) => void;
  };
};

export function useExperienceMutations(
  options: ExperienceMutationsOptions = {},
) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { currentUser } = useCurrentUser();

  const { userId: pathUserId } = useParams({ strict: false });

  const { q: pathQ } = useSearch({ strict: false });

  const editMutation = trpc.experiences.edit.useMutation({
    onSuccess: async ({ id }) => {
      await utils.experiences.byId.invalidate({ id });

      toast({
        title: "Experience updated",
        description: "Your experience has been updated",
      });

      options.edit?.onSuccess?.(id);
    },
    onError: (error) => {
      toast({
        title: "Failed to edit experience",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = trpc.experiences.delete.useMutation({
    onSuccess: async (id) => {
      await Promise.all([
        utils.experiences.feed.invalidate(),
        ...(pathUserId
          ? [utils.experiences.byUserId.invalidate({ id: pathUserId })]
          : []),
        ...(pathQ ? [utils.experiences.search.invalidate({ q: pathQ })] : []),
        utils.experiences.favorites.invalidate(),
      ]);

      toast({
        title: "Experience deleted",
        description: "Your experience has been deleted",
      });

      options.delete?.onSuccess?.(id);
    },
    onError: (error) => {
      toast({
        title: "Failed to delete experience",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const attendMutation = trpc.experiences.attend.useMutation({
    // Optimistic update: immediately update UI before server response
    onMutate: async ({ id }) => {
      // Helper function to update experience data with new attendance status
      function updateExperience<
        T extends {
          isAttending: boolean;
          attendeesCount: number;
          attendees?: User[];
        },
      >(oldData: T) {
        return {
          ...oldData,
          isAttending: true,
          attendeesCount: oldData.attendeesCount + 1,
          // Add current user to attendees list if it exists
          ...(oldData.attendees && {
            attendees: [currentUser, ...oldData.attendees],
          }),
        };
      }

      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await Promise.all([
        utils.experiences.byId.cancel({ id }),
        utils.experiences.feed.cancel(),
        ...(pathUserId
          ? [utils.experiences.byUserId.cancel({ id: pathUserId })]
          : []),
        ...(pathQ ? [utils.experiences.search.cancel({ q: pathQ })] : []),
        utils.experiences.favorites.cancel(),
      ]);

      // Snapshot the previous data in case we need to rollback
      const previousData = {
        byId: utils.experiences.byId.getData({ id }),
        feed: utils.experiences.feed.getInfiniteData(),
        byUserId: pathUserId
          ? utils.experiences.byUserId.getInfiniteData({ id: pathUserId })
          : undefined,
        search: pathQ
          ? utils.experiences.search.getInfiniteData({
              q: pathQ,
            })
          : undefined,
        favorites: utils.experiences.favorites.getInfiniteData(),
      };

      // Update the experience detail view
      utils.experiences.byId.setData({ id }, (oldData) => {
        if (!oldData) {
          return;
        }

        return updateExperience(oldData);
      });

      // Update the main feed
      utils.experiences.feed.setInfiniteData({}, (oldData) => {
        if (!oldData) {
          return;
        }

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            experiences: page.experiences.map((e) =>
              e.id === id ? updateExperience(e) : e,
            ),
          })),
        };
      });

      // Update user profile experiences if viewing a user's profile
      if (pathUserId) {
        utils.experiences.byUserId.setInfiniteData(
          { id: pathUserId },
          (oldData) => {
            if (!oldData) {
              return;
            }

            return {
              ...oldData,
              pages: oldData.pages.map((page) => ({
                ...page,
                experiences: page.experiences.map((e) =>
                  e.id === id ? updateExperience(e) : e,
                ),
              })),
            };
          },
        );
      }

      // Update search results if viewing search
      if (pathQ) {
        utils.experiences.search.setInfiniteData({ q: pathQ }, (oldData) => {
          if (!oldData) {
            return;
          }

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              experiences: page.experiences.map((e) =>
                e.id === id ? updateExperience(e) : e,
              ),
            })),
          };
        });
      }

      utils.experiences.favorites.setInfiniteData({}, (oldData) => {
        if (!oldData) {
          return;
        }

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            experiences: page.experiences.map((e) =>
              e.id === id ? updateExperience(e) : e,
            ),
          })),
        };
      });

      return { previousData };
    },
    // Rollback optimistic update if mutation fails
    onError: (error, { id }, context) => {
      utils.experiences.byId.setData({ id }, context?.previousData.byId);

      utils.experiences.feed.setInfiniteData({}, context?.previousData.feed);

      if (pathUserId) {
        utils.experiences.byUserId.setInfiniteData(
          { id: pathUserId },
          context?.previousData.byUserId,
        );
      }

      if (pathQ) {
        utils.experiences.search.setInfiniteData(
          { q: pathQ },
          context?.previousData.search,
        );
      }

      utils.experiences.favorites.setInfiniteData(
        {},
        context?.previousData.favorites,
      );

      toast({
        title: "Failed to attend experience",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unattendMutation = trpc.experiences.unattend.useMutation({
    // Optimistic update: immediately update UI before server response
    onMutate: async ({ id }) => {
      // Helper function to update experience data by removing attendance
      function updateExperience<
        T extends {
          isAttending: boolean;
          attendeesCount: number;
          attendees?: User[];
        },
      >(oldData: T) {
        return {
          ...oldData,
          isAttending: false,
          attendeesCount: Math.max(0, oldData.attendeesCount - 1),
          // Remove current user from attendees list if it exists
          ...(oldData.attendees && {
            attendees: oldData.attendees.filter(
              (a) => a.id !== currentUser?.id,
            ),
          }),
        };
      }

      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await Promise.all([
        utils.experiences.byId.cancel({ id }),
        utils.experiences.feed.cancel(),
        ...(pathUserId
          ? [utils.experiences.byUserId.cancel({ id: pathUserId })]
          : []),
        ...(pathQ ? [utils.experiences.search.cancel({ q: pathQ })] : []),
        utils.experiences.favorites.cancel(),
      ]);

      // Snapshot the previous data in case we need to rollback
      const previousData = {
        byId: utils.experiences.byId.getData({ id }),
        feed: utils.experiences.feed.getInfiniteData(),
        byUserId: pathUserId
          ? utils.experiences.byUserId.getInfiniteData({ id: pathUserId })
          : undefined,
        search: pathQ
          ? utils.experiences.search.getInfiniteData({
              q: pathQ,
            })
          : undefined,
        favorites: utils.experiences.favorites.getInfiniteData(),
      };

      // Update the experience detail view
      utils.experiences.byId.setData({ id }, (oldData) => {
        if (!oldData) {
          return;
        }

        return updateExperience(oldData);
      });

      // Update the main feed
      utils.experiences.feed.setInfiniteData({}, (oldData) => {
        if (!oldData) {
          return;
        }

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            experiences: page.experiences.map((e) =>
              e.id === id ? updateExperience(e) : e,
            ),
          })),
        };
      });

      // Update user profile experiences if viewing a user's profile
      if (pathUserId) {
        utils.experiences.byUserId.setInfiniteData(
          { id: pathUserId },
          (oldData) => {
            if (!oldData) {
              return;
            }

            return {
              ...oldData,
              pages: oldData.pages.map((page) => ({
                ...page,
                experiences: page.experiences.map((e) =>
                  e.id === id ? updateExperience(e) : e,
                ),
              })),
            };
          },
        );
      }

      // Update search results if viewing search
      if (pathQ) {
        utils.experiences.search.setInfiniteData({ q: pathQ }, (oldData) => {
          if (!oldData) {
            return;
          }

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              experiences: page.experiences.map((e) =>
                e.id === id ? updateExperience(e) : e,
              ),
            })),
          };
        });
      }

      utils.experiences.favorites.setInfiniteData({}, (oldData) => {
        if (!oldData) {
          return;
        }

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            experiences: page.experiences.map((e) =>
              e.id === id ? updateExperience(e) : e,
            ),
          })),
        };
      });

      return { previousData };
    },
    // Rollback optimistic update if mutation fails
    onError: (error, { id }, context) => {
      utils.experiences.byId.setData({ id }, context?.previousData.byId);

      utils.experiences.feed.setInfiniteData({}, context?.previousData.feed);

      if (pathUserId) {
        utils.experiences.byUserId.setInfiniteData(
          { id: pathUserId },
          context?.previousData.byUserId,
        );
      }

      if (pathQ) {
        utils.experiences.search.setInfiniteData(
          { q: pathQ },
          context?.previousData.search,
        );
      }

      utils.experiences.favorites.setInfiniteData(
        {},
        context?.previousData.favorites,
      );

      toast({
        title: "Failed to attend experience",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const favoriteMutation = trpc.experiences.favorite.useMutation({
    // Optimistic update: immediately update UI before server response
    onMutate: async ({ id }) => {
      // Helper function to update experience data with new favorite status
      function updateExperience<
        T extends { isFavorited: boolean; favoritesCount: number },
      >(oldData: T) {
        return {
          ...oldData,
          isFavorited: true,
          favoritesCount: oldData.favoritesCount + 1,
        };
      }

      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await Promise.all([
        utils.experiences.byId.cancel({ id }),
        utils.experiences.feed.cancel(),
        pathQ
          ? utils.experiences.search.cancel({
              q: pathQ,
            })
          : undefined,
        pathUserId
          ? utils.experiences.byUserId.cancel({ id: pathUserId })
          : undefined,
      ]);

      // Snapshot the previous data in case we need to rollback
      const previousData = {
        byId: utils.experiences.byId.getData({ id }),
        feed: utils.experiences.feed.getInfiniteData(),
        search: pathQ
          ? utils.experiences.search.getInfiniteData({
              q: pathQ,
            })
          : undefined,
        byUserId: pathUserId
          ? utils.experiences.byUserId.getInfiniteData({ id: pathUserId })
          : undefined,
      };

      // Update the experience detail view
      utils.experiences.byId.setData({ id }, (oldData) => {
        if (!oldData) {
          return;
        }

        return updateExperience(oldData);
      });

      // Update the main feed
      utils.experiences.feed.setInfiniteData({}, (oldData) => {
        if (!oldData) {
          return;
        }

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            experiences: page.experiences.map((e) =>
              e.id === id ? updateExperience(e) : e,
            ),
          })),
        };
      });

      // Update user profile experiences if viewing a user's profile
      if (pathUserId) {
        utils.experiences.byUserId.setInfiniteData(
          { id: pathUserId },
          (oldData) => {
            if (!oldData) {
              return;
            }

            return {
              ...oldData,
              pages: oldData.pages.map((page) => ({
                ...page,
                experiences: page.experiences.map((e) =>
                  e.id === id ? updateExperience(e) : e,
                ),
              })),
            };
          },
        );
      }

      // Update search results if viewing search
      if (pathQ) {
        utils.experiences.search.setInfiniteData({ q: pathQ }, (oldData) => {
          if (!oldData) {
            return;
          }

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              experiences: page.experiences.map((e) =>
                e.id === id ? updateExperience(e) : e,
              ),
            })),
          };
        });
      }

      return { previousData };
    },
    // Rollback optimistic update if mutation fails
    onError: (error, { id }, context) => {
      utils.experiences.byId.setData({ id }, context?.previousData.byId);

      utils.experiences.feed.setInfiniteData({}, context?.previousData.feed);

      if (pathQ) {
        utils.experiences.search.setInfiniteData(
          {
            q: pathQ,
          },
          context?.previousData.search,
        );
      }

      if (pathUserId) {
        utils.experiences.byUserId.setInfiniteData(
          { id: pathUserId },
          context?.previousData.byUserId,
        );
      }

      toast({
        title: "Failed to favorite experience",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const unfavoriteMutation = trpc.experiences.unfavorite.useMutation({
    // Optimistic update: immediately update UI before server response
    onMutate: async ({ id }) => {
      // Helper function to update experience data by removing favorite
      function updateExperience<
        T extends { isFavorited: boolean; favoritesCount: number },
      >(oldData: T) {
        return {
          ...oldData,
          isFavorited: false,
          favoritesCount: Math.max(0, oldData.favoritesCount - 1),
        };
      }

      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await Promise.all([
        utils.experiences.byId.cancel({ id }),
        utils.experiences.feed.cancel(),
        pathQ
          ? utils.experiences.search.cancel({
              q: pathQ,
            })
          : undefined,
        utils.experiences.favorites.cancel(),
        pathUserId
          ? utils.experiences.byUserId.cancel({ id: pathUserId })
          : undefined,
      ]);

      // Snapshot the previous data in case we need to rollback
      const previousData = {
        byId: utils.experiences.byId.getData({ id }),
        feed: utils.experiences.feed.getInfiniteData(),
        search: pathQ
          ? utils.experiences.search.getInfiniteData({
              q: pathQ,
            })
          : undefined,
        favorites: utils.experiences.favorites.getInfiniteData(),
        byUserId: pathUserId
          ? utils.experiences.byUserId.getInfiniteData({ id: pathUserId })
          : undefined,
      };

      // Update the experience detail view
      utils.experiences.byId.setData({ id }, (oldData) => {
        if (!oldData) {
          return;
        }

        return updateExperience(oldData);
      });

      // Update the main feed
      utils.experiences.feed.setInfiniteData({}, (oldData) => {
        if (!oldData) {
          return;
        }

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            experiences: page.experiences.map((e) =>
              e.id === id ? updateExperience(e) : e,
            ),
          })),
        };
      });

      // Update search results if viewing search
      if (pathQ) {
        utils.experiences.search.setInfiniteData(
          {
            q: pathQ,
          },
          (oldData) => {
            if (!oldData) {
              return;
            }

            return {
              ...oldData,
              pages: oldData.pages.map((page) => ({
                ...page,
                experiences: page.experiences.map((e) =>
                  e.id === id ? updateExperience(e) : e,
                ),
              })),
            };
          },
        );
      }

      // Update favorites list by removing the experience
      utils.experiences.favorites.setInfiniteData({}, (oldData) => {
        if (!oldData) {
          return;
        }

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            experiences: page.experiences.filter((e) => e.id !== id),
          })),
        };
      });

      // Update user profile experiences if viewing a user's profile
      if (pathUserId) {
        utils.experiences.byUserId.setInfiniteData(
          { id: pathUserId },
          (oldData) => {
            if (!oldData) {
              return;
            }

            return {
              ...oldData,
              pages: oldData.pages.map((page) => ({
                ...page,
                experiences: page.experiences.map((e) =>
                  e.id === id ? updateExperience(e) : e,
                ),
              })),
            };
          },
        );
      }

      return { previousData };
    },
    // Rollback optimistic update if mutation fails
    onError: (error, { id }, context) => {
      utils.experiences.byId.setData({ id }, context?.previousData.byId);

      utils.experiences.feed.setInfiniteData({}, context?.previousData.feed);

      if (pathQ) {
        utils.experiences.search.setInfiniteData(
          {
            q: pathQ,
          },
          context?.previousData.search,
        );
      }

      utils.experiences.favorites.setInfiniteData(
        {},
        context?.previousData.favorites,
      );

      if (pathUserId) {
        utils.experiences.byUserId.setInfiniteData(
          { id: pathUserId },
          context?.previousData.byUserId,
        );
      }

      toast({
        title: "Failed to unfavorite experience",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    editMutation,
    deleteMutation,
    attendMutation,
    unattendMutation,
    favoriteMutation,
    unfavoriteMutation,
  };
}
