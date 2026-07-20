import './WorkflowUI.css';

export default function MasterDetailLayout({ master, detail, className = '' }) {
  return (
    <div className={`master-detail-layout ${className}`.trim()}>
      <aside className="master-detail-layout__master">{master}</aside>
      <section className="master-detail-layout__detail">{detail}</section>
    </div>
  );
}
