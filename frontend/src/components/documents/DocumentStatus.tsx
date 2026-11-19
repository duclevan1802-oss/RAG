import type { DocumentStatus as Status } from '../../types/document';
const labels: Record<Status, string> = {
  uploaded: 'Đã tải lên',
  queued: 'Chờ xử lý',
  processing: 'Đang xử lý',
  ready: 'Sẵn sàng',
  failed: 'Chưa xử lý',
  deleting: 'Đang xóa',
};
export default function DocumentStatus({ status }: { status: Status }) { return <span className={`status ${status}`}><i/>{labels[status]}</span>; }
