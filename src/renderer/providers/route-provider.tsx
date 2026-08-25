import { type PropsWithChildren } from "react";
import { RouterProvider } from "react-aria-components";
import { useRouter } from "@tanstack/react-router";
import type { NavigateOptions, RegisteredRouter, ToPathOption } from "@tanstack/react-router";

declare module "react-aria-components" {
  interface RouterConfig {
    routerOptions: Omit<NavigateOptions, "to">;
  }
}

export const RouteProvider = ({ children }: PropsWithChildren) => {
  const router = useRouter();

  return (
    <RouterProvider
      navigate={(to, options) =>
        router.navigate({ ...options, to: to as ToPathOption<RegisteredRouter, "/", "/"> })
      }
      useHref={(to) => router.buildLocation({ to: to as ToPathOption<RegisteredRouter, "/", "/"> }).href}
    >
      {children}
    </RouterProvider>
  );
};
