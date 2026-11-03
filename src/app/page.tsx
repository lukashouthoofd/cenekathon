import { allRecords, data } from '@/lib/data';
import Chat from './chat';

export default function Page() {
  return <Chat company={data.company} scores={data.scores} records={allRecords()} />;
}
