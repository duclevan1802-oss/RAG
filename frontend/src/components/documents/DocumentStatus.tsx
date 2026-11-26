// Đổi mã trạng thái tài liệu từ API thành nhãn tiếng Việt.

import type { DocumentStatus as Status } from '../../types/document';
const labels: Record<Status, string> = {
  uploaded: 'Đã tải lên',
  queued: 'Chờ xử lý',
  processing: 'Đang xử lý',
  ready: 'Sẵn sàng',
  failed: 'Xử lý thất bại',
  deleting: 'Đang xóa',
};
export default function DocumentStatus({ status }: { status: Status }) {
  return <span className={`status ${status}`}><i aria-hidden="true" />{labels[status]}</span>;
}
