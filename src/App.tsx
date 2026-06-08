import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from '@/routes';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { Toaster } from '@/components/ui/Toaster';
import { restoreSession, subscribeToAuthChanges } from '@/lib/auth';
import { startQueueWorker } from '@/lib/queue/syncer';
import { refreshPendingCount } from '@/lib/db/submissions';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  useEffect(() => {
    void restoreSession();
    const unsubscribe = subscribeToAuthChanges();
    startQueueWorker(queryClient);
    void refreshPendingCount();
    return () => unsubscribe();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider
        router={router}
        future={{
          v7_startTransition: true,
        }}
      />
      <InstallPrompt />
      <Toaster />
    </QueryClientProvider>
  );
}
