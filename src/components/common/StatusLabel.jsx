import { Tag } from 'antd';
import { getStatusMeta } from '../../utils/statusLabels';

export default function StatusLabel({ status, className = '' }) {
  const item = getStatusMeta(status);
  return <Tag className={className} color={item.color}>{item.label}</Tag>;
}
