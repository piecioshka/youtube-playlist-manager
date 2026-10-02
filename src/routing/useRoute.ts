import { useCallback, useEffect, useState } from 'react';
import { parseRoute, routeToHash, type Route } from './route';

export type RouteState = {
  route: Route;
  navigate: (route: Route) => void;
};

function currentRoute(): Route {
  return parseRoute(window.location.hash);
}

// Trasa żyje w hashu: działa na GitHub Pages bez przepisywania adresów, a Wstecz cofa widok
export function useRoute(): RouteState {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    function handleHashChange() {
      setRoute(currentRoute());
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Hash zmieniamy, a nie stan wprost, żeby powstał wpis w historii; stan od razu, bez czekania na hashchange
  const navigate = useCallback((next: Route) => {
    window.location.hash = routeToHash(next);
    setRoute(next);
  }, []);

  return { route, navigate };
}
