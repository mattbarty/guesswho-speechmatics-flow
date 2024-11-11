import { fetchCredentials } from '@/lib/fetch-credentials';
import ConversationWindow from './ConversationWindow';
import { fetchPersonas, FlowProvider } from '@speechmatics/flow-client-react';

export default async function Home() {
  // Credentials here are being fetched when rendering the server component.
  // You could instead define an API action to request it on the fly.
  const creds = await fetchCredentials();
  const personas = await fetchPersonas();

  return (
    <FlowProvider appId="nextjs-example">
      <main className="flex overflow-auto transition-transform h-full">
        <div className="flex flex-col items-center justify-center w-full gap-4">
          <ConversationWindow jwt={creds.key_value} personas={personas} />
        </div>
      </main>
    </FlowProvider>
  );
}