import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Use hash history in SPA/static builds so GitHub Pages deep-links work
// without a server-side rewrite. Falls back to browser history in SSR context.
const isSPA = typeof window !== "undefined" && !("__TANSTACK_DEHYDRATED__" in window);

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ...(isSPA ? { history: createHashHistory() } : {}),
  });

  return router;
};
