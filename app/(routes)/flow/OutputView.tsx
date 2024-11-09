import { useErrorBoundary } from 'react-error-boundary';
import { useFlowEventListener } from '@speechmatics/flow-client-react';
import { TranscriptView } from './TranscriptView';

export function OutputView() {
  const { showBoundary } = useErrorBoundary();

  useFlowEventListener('message', ({ data }) => {
    if (data.message === 'Error') {
      showBoundary(data);
    }
  });

  useFlowEventListener('socketError', (e) => {
    showBoundary(e);
  });

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold mb-2">Transcript</h3>
      <TranscriptView />
    </div>
  );
}