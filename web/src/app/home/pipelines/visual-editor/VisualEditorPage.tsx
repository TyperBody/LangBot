import { useSearchParams } from 'react-router-dom';
import VisualEditor from './VisualEditor';

export default function VisualEditorPage() {
  const [searchParams] = useSearchParams();
  const pipelineId = searchParams.get('id') || undefined;

  return (
    <div className="h-screen w-screen">
      <VisualEditor pipelineId={pipelineId} />
    </div>
  );
}
